from __future__ import annotations

import logging
from collections import Counter
from datetime import date, datetime, timedelta
from time import monotonic
from typing import Any

import httpx

from app.core.config import settings
from app.services.manual_financial_service import manual_financial_snapshot

logger = logging.getLogger(__name__)


class AsaasUnavailable(Exception):
    pass


BILLING_TYPE_LABELS = {
    'BOLETO': 'Boleto',
    'CREDIT_CARD': 'Cartão de crédito',
    'DEBIT_CARD': 'Cartão de débito',
    'PIX': 'Pix',
    'TRANSFER': 'Transferência',
    'DEPOSIT': 'Depósito',
    'UNDEFINED': 'A definir',
}

PAYMENT_STATUS_LABELS = {
    'PENDING': 'Aguardando pagamento',
    'RECEIVED': 'Recebida',
    'CONFIRMED': 'Confirmada',
    'OVERDUE': 'Vencida',
    'REFUNDED': 'Estornada',
    'RECEIVED_IN_CASH': 'Recebida em dinheiro',
    'REFUND_REQUESTED': 'Estorno solicitado',
    'REFUND_IN_PROGRESS': 'Estorno em processamento',
    'CHARGEBACK_REQUESTED': 'Chargeback solicitado',
    'CHARGEBACK_DISPUTE': 'Chargeback em disputa',
    'AWAITING_CHARGEBACK_REVERSAL': 'Aguardando reversao de chargeback',
    'DUNNING_REQUESTED': 'Negativacao solicitada',
    'DUNNING_RECEIVED': 'Negativada',
    'AWAITING_RISK_ANALYSIS': 'Em analise de risco',
}

TRANSACTION_TYPE_LABELS = {
    'PAYMENT_RECEIVED': 'Cobrança recebida',
    'PAYMENT_FEE': 'Taxa de cobrança',
    'PAYMENT_MESSAGING_NOTIFICATION_FEE': 'Taxa de mensageria',
    'TRANSFER': 'Transferência',
    'BILL_PAYMENT': 'Pagamento de conta',
    'CREDIT_BUREAU_REPORT_FEE': 'Consulta de crédito',
}

RECEIVED_STATES = {'RECEIVED', 'RECEIVED_IN_CASH'}
CONFIRMED_STATES = {'CONFIRMED'}
PENDING_STATES = {'PENDING'}
OVERDUE_STATES = {'OVERDUE'}


def _payment_method_label(billing_type: str | None) -> str:
    return BILLING_TYPE_LABELS.get((billing_type or '').upper(), billing_type or 'Outro')


# Mantem a operacao financeira atual sem transformar a listagem em polling.
# O botao "Atualizar ASAAS" ignora este cache quando a equipe precisa conferir agora.
_CACHE_TTL_SECONDS = 5 * 60
_CACHE: dict[tuple[str, tuple[tuple[str, Any], ...]], tuple[float, dict[str, Any]]] = {}


def _cache_key(path: str, params: dict[str, Any] | None) -> tuple[str, tuple[tuple[str, Any], ...]]:
    return (path.lstrip('/'), tuple(sorted((params or {}).items())))


def _clear_cache() -> None:
    _CACHE.clear()


class AsaasService:
    def __init__(self, force_refresh: bool = False):
        if not settings.asaas_api_key:
            raise AsaasUnavailable('Configure ASAAS_API_KEY no backend.')
        self.base_url = settings.asaas_base_url.rstrip('/') + '/'
        self.headers = {'access_token': settings.asaas_api_key}
        self.force_refresh = force_refresh

    async def _delete(self, path: str) -> dict[str, Any]:
        async with httpx.AsyncClient(base_url=self.base_url, headers=self.headers, timeout=25.0) as client:
            response = await client.delete(path.lstrip('/'))
            if response.status_code >= 400:
                raise AsaasUnavailable(f'ASAAS retornou {response.status_code}: {response.text[:200]}')
            _clear_cache()
            return response.json() if response.content else {'deleted': True}

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        key = _cache_key(path, params)
        now = monotonic()
        cached = _CACHE.get(key)
        if cached and not self.force_refresh and now - cached[0] < _CACHE_TTL_SECONDS:
            return cached[1]

        async with httpx.AsyncClient(base_url=self.base_url, headers=self.headers, timeout=25.0) as client:
            response = await client.get(path.lstrip('/'), params=params or {})
            if response.status_code >= 400:
                raise AsaasUnavailable(f'ASAAS retornou {response.status_code}: {response.text[:200]}')
            data = response.json()
            _CACHE[key] = (now, data)
            return data

    async def _get_all(self, path: str, params: dict[str, Any] | None = None, max_items: int = 5000) -> list[dict[str, Any]]:
        """Percorre endpoints paginados do ASAAS em lotes de 100 registros."""
        offset = 0
        items: list[dict[str, Any]] = []
        while len(items) < max_items:
            page_params = {**(params or {}), 'limit': 100, 'offset': offset}
            page = await self._get(path, page_params)
            batch = page.get('data', [])
            if not isinstance(batch, list):
                break
            items.extend(batch)
            if not page.get('hasMore') or not batch:
                break
            offset += len(batch)
        return items[:max_items]

    async def payments(self, limit: int = 100) -> dict[str, Any]:
        return await self._get('payments', {'limit': limit, 'offset': 0, 'sort': 'dueDate', 'order': 'desc'})

    async def all_payments(self) -> list[dict[str, Any]]:
        return await self._get_all('payments', {'sort': 'dueDate', 'order': 'desc'})

    async def payments_by_customer(self, customer_id: str) -> list[dict[str, Any]]:
        return await self._get_all('payments', {'customer': customer_id, 'sort': 'dueDate', 'order': 'desc'})

    async def _customers_page(self, limit: int = 100) -> dict[str, Any]:
        return await self._get('customers', {'limit': limit, 'offset': 0})

    async def balance(self) -> float | None:
        # Endpoint separado da conta ASAAS: se a chave de API nao tiver
        # permissao pra isso (ou o endpoint mudar), nao pode derrubar o
        # resto da Visao Geral, que ja funcionava antes desse campo existir.
        try:
            result = await self._get('finance/balance')
            return float(result.get('balance', 0) or 0)
        except (AsaasUnavailable, TypeError, ValueError) as exc:
            logger.warning("ASAAS balance fetch failed: %s", exc)
            return None

    async def subscriptions(self) -> list[dict[str, Any]]:
        all_subs = await self._get_all('subscriptions')
        return [subscription for subscription in all_subs if (subscription.get('status') or '').upper() == 'ACTIVE']

    async def timeline(self, days: int = 30, limit: int = 60) -> list[dict[str, Any]]:
        """Extrato da conta ASAAS — mesmo endpoint que alimenta o extrato
        nativo deles (financialTransactions): todo lancamento (recebimento,
        taxa, Pix enviado, saque, pagamento de conta...) com saldo corrente
        apos cada um, mais recente primeiro."""
        since = (date.today() - timedelta(days=days)).isoformat()
        items = await self._get_all('financialTransactions', {'startDate': since}, max_items=limit)
        entries = [
            {
                'date': item.get('date'),
                'value': float(item.get('value') or 0),
                'balance': float(item.get('balance') or 0),
                'description': item.get('description') or TRANSACTION_TYPE_LABELS.get(item.get('type'), item.get('type') or 'Movimentação'),
                'type': item.get('type'),
            }
            for item in items
        ]
        entries.sort(key=lambda entry: entry['date'], reverse=True)
        return entries[:limit]

    async def _customer_map(self) -> dict[str, dict[str, Any]]:
        customers = await self._get_all('customers', {'sort': 'name', 'order': 'asc'})
        return {item['id']: item for item in customers if item.get('id')}

    @staticmethod
    def _charge_kind(item: dict[str, Any]) -> str:
        return 'subscription' if item.get('subscription') else 'one_off'

    @staticmethod
    def _days_overdue(item: dict[str, Any]) -> int:
        if item.get('status') != 'OVERDUE' or not item.get('dueDate'):
            return 0
        try:
            return max(0, (date.today() - date.fromisoformat(item['dueDate'])).days)
        except (TypeError, ValueError):
            return 0

    def _serialize_charge(self, item: dict[str, Any], customers: dict[str, dict[str, Any]]) -> dict[str, Any]:
        customer = customers.get(item.get('customer'), {})
        status = (item.get('status') or 'UNKNOWN').upper()
        return {
            'id': item.get('id'),
            'customer_id': item.get('customer'),
            'customer': item.get('customerName') or customer.get('name') or 'Cliente',
            'customer_email': customer.get('email'),
            'customer_phone': customer.get('mobilePhone') or customer.get('phone'),
            'customer_document': customer.get('cpfCnpj'),
            'description': item.get('description') or 'Cobranca ASAAS',
            'value': float(item.get('value') or 0),
            'net_value': float(item.get('netValue') or 0),
            'status': status,
            'status_label': PAYMENT_STATUS_LABELS.get(status, status.replace('_', ' ').title()),
            'billing_type': item.get('billingType'),
            'payment_method': _payment_method_label(item.get('billingType')),
            'due_date': item.get('dueDate'),
            'original_due_date': item.get('originalDueDate'),
            'payment_date': item.get('paymentDate'),
            'client_payment_date': item.get('clientPaymentDate'),
            'estimated_credit_date': item.get('estimatedCreditDate'),
            'subscription_id': item.get('subscription'),
            'installment_id': item.get('installment'),
            'installment_number': item.get('installmentNumber'),
            'invoice_url': item.get('invoiceUrl'),
            'bank_slip_url': item.get('bankSlipUrl'),
            'invoice_number': item.get('invoiceNumber'),
            'external_reference': item.get('externalReference'),
            'charge_kind': self._charge_kind(item),
            'days_overdue': self._days_overdue(item),
            'last_invoice_viewed_date': item.get('lastInvoiceViewedDate'),
            'last_bank_slip_viewed_date': item.get('lastBankSlipViewedDate'),
        }

    async def charges(
        self,
        kind: str = 'all',
        status_group: str = 'all',
        search: str = '',
        start_date: str | None = None,
        end_date: str | None = None,
        offset: int = 0,
        limit: int = 50,
    ) -> dict[str, Any]:
        raw = await self.all_payments()
        customers = await self._customer_map()
        serialized = [self._serialize_charge(item, customers) for item in raw]

        if start_date:
            serialized = [item for item in serialized if (item.get('due_date') or '') >= start_date]
        if end_date:
            serialized = [item for item in serialized if (item.get('due_date') or '') <= end_date]
        if kind in {'one_off', 'subscription'}:
            serialized = [item for item in serialized if item['charge_kind'] == kind]
        if search.strip():
            needle = search.strip().casefold()
            serialized = [
                item for item in serialized
                if needle in ' '.join(str(item.get(field) or '') for field in ('customer', 'description', 'customer_email', 'customer_phone', 'invoice_number')).casefold()
            ]

        def metrics(states: set[str]) -> dict[str, Any]:
            selected = [item for item in serialized if item['status'] in states]
            return {'count': len(selected), 'value': round(sum(item['value'] for item in selected), 2)}

        status_sets = {
            'received': RECEIVED_STATES,
            'confirmed': CONFIRMED_STATES,
            'pending': PENDING_STATES,
            'overdue': OVERDUE_STATES,
        }
        summary = {name: metrics(states) for name, states in status_sets.items()}
        summary['total'] = {'count': len(serialized), 'value': round(sum(item['value'] for item in serialized), 2)}

        if status_group in status_sets:
            serialized = [item for item in serialized if item['status'] in status_sets[status_group]]

        # Vencidas primeiro; depois, vencimentos mais proximos.
        serialized.sort(key=lambda item: (item['status'] != 'OVERDUE', item.get('due_date') or '9999-12-31'))
        account_balance = await self.balance()
        return {
            'source': 'asaas',
            'updated_at': datetime.now().isoformat(timespec='seconds'),
            'account_balance': account_balance,
            'summary': summary,
            'total': len(serialized),
            'offset': offset,
            'limit': limit,
            'data': serialized[offset:offset + limit],
        }

    async def charge_detail(self, payment_id: str) -> dict[str, Any]:
        if not payment_id or '/' in payment_id:
            raise AsaasUnavailable('Cobranca ASAAS invalida.')
        payment = await self._get(f'payments/{payment_id}')
        customer_id = payment.get('customer')
        customers: dict[str, dict[str, Any]] = {}
        if customer_id:
            customers[customer_id] = await self._get(f'customers/{customer_id}')
        return self._serialize_charge(payment, customers)

    async def overview(self) -> dict[str, Any]:
        result = await self.payments()
        payments = result.get('data', [])
        statuses = Counter(item.get('status', 'UNKNOWN') for item in payments)
        received_states = RECEIVED_STATES
        confirmed_states = CONFIRMED_STATES
        open_states = PENDING_STATES
        overdue_states = OVERDUE_STATES
        value = lambda items: round(sum(float(item.get('value') or 0) for item in items), 2)
        received = [item for item in payments if item.get('status') in received_states]
        confirmed = [item for item in payments if item.get('status') in confirmed_states]
        pending = [item for item in payments if item.get('status') in open_states]
        overdue = [item for item in payments if item.get('status') in overdue_states]
        customers = await self._customers_page()
        customer_names = {
            item.get('id'): item.get('name')
            for item in customers.get('data', [])
            if item.get('id') and item.get('name')
        }
        account_balance = await self.balance()
        return {
            'source': 'asaas',
            'updated_at': datetime.now().isoformat(timespec='seconds'),
            'cache_ttl_seconds': _CACHE_TTL_SECONDS,
            'account_balance': account_balance,
            'customers_total': customers.get('totalCount', 0),
            'payments_total': result.get('totalCount', len(payments)),
            'sample_size': len(payments),
            'received_value': value(received),
            'confirmed_value': value(confirmed),
            'pending_value': value(pending),
            'overdue_value': value(overdue),
            'received_count': len(received),
            'confirmed_count': len(confirmed),
            'pending_count': len(pending),
            'overdue_count': len(overdue),
            'status_counts': dict(statuses),
            'payments': [
                {
                    'id': item.get('id'),
                    'customer': item.get('customerName') or customer_names.get(item.get('customer')) or 'Cliente',
                    'description': item.get('description') or 'Cobrança ASAAS',
                    'value': item.get('value', 0),
                    'status': item.get('status'),
                    'due_date': item.get('dueDate'),
                    'payment_date': item.get('paymentDate'),
                    'payment_method': _payment_method_label(item.get('billingType')),
                }
                for item in payments[:20]
            ],
        }

    async def delete_customer(self, customer_id: str) -> dict[str, Any]:
        if not customer_id or '/' in customer_id:
            raise AsaasUnavailable('Cliente ASAAS inv?lido.')
        return await self._delete(f'customers/{customer_id}')

    async def customers(self, limit: int = 100) -> list[dict[str, Any]]:
        result = await self._get('customers', {'limit': limit, 'offset': 0, 'sort': 'name', 'order': 'asc'})
        return [
            {
                'id': item.get('id'),
                'name': item.get('name'),
                'email': item.get('email'),
                'phone': item.get('phone') or item.get('mobilePhone'),
                'created_at': item.get('dateCreated'),
            }
            for item in result.get('data', [])
        ]

    async def insights(self, days: int = 180, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
        base = await self.overview()
        raw = (await self.payments()).get('data', [])
        received_states = RECEIVED_STATES
        confirmed_states = CONFIRMED_STATES

        start = start_date or (date.today() - timedelta(days=days)).isoformat()
        end = end_date or date.today().isoformat()

        def event_date(item: dict[str, Any]) -> str:
            status = item.get('status', 'PENDING')
            return (item.get('paymentDate') if status in received_states | confirmed_states else item.get('dueDate')) or ''

        filtered = [item for item in raw if start <= event_date(item) <= end]
        value = lambda items: round(sum(float(item.get('value') or 0) for item in items), 2)
        open_states = PENDING_STATES
        overdue_states = OVERDUE_STATES
        received = [item for item in filtered if item.get('status') in received_states]
        confirmed = [item for item in filtered if item.get('status') in confirmed_states]
        pending = [item for item in filtered if item.get('status') in open_states]
        overdue = [item for item in filtered if item.get('status') in overdue_states]
        base['received_value'] = value(received)
        base['confirmed_value'] = value(confirmed)
        base['pending_value'] = value(pending)
        base['overdue_value'] = value(overdue)
        base['received_count'] = len(received)
        base['confirmed_count'] = len(confirmed)
        base['pending_count'] = len(pending)
        base['overdue_count'] = len(overdue)
        customers = await self._customers_page()
        customer_names = {
            item.get('id'): item.get('name')
            for item in customers.get('data', [])
            if item.get('id') and item.get('name')
        }
        base['payments'] = [
            {
                'id': item.get('id'),
                'customer': item.get('customerName') or customer_names.get(item.get('customer')) or 'Cliente',
                'description': item.get('description') or 'Cobrança ASAAS',
                'value': item.get('value', 0),
                'status': item.get('status'),
                'due_date': item.get('dueDate'),
                'payment_date': item.get('paymentDate'),
                'payment_method': _payment_method_label(item.get('billingType')),
            }
            for item in filtered[:20]
        ]
        daily: dict[str, dict[str, float]] = {}
        billing: dict[str, float] = {}
        for item in filtered:
            status = item.get('status', 'PENDING')
            event_date = item.get('paymentDate') if status in received_states else item.get('dueDate')
            if event_date:
                day = daily.setdefault(event_date, {'received': 0, 'confirmed': 0, 'pending': 0, 'overdue': 0})
                key = 'received' if status in RECEIVED_STATES else 'confirmed' if status in CONFIRMED_STATES else 'overdue' if status == 'OVERDUE' else 'pending'
                day[key] += float(item.get('value') or 0)
            payment_type = item.get('billingType') or 'OUTROS'
            billing[payment_type] = billing.get(payment_type, 0) + float(item.get('value') or 0)

        base['daily_status'] = [{'date': day, **values} for day, values in sorted(daily.items())]
        base['billing_types'] = [{'type': key, 'value': round(value, 2)} for key, value in sorted(billing.items(), key=lambda row: row[1], reverse=True)]
        active_subscriptions = await self.subscriptions()
        base['recurring_value'] = round(sum(float(item.get('value') or 0) for item in active_subscriptions), 2)
        base['recurring_count'] = len(active_subscriptions)
        base['subscriptions'] = active_subscriptions
        base['manual_financial'] = manual_financial_snapshot(raw, start_date=start, end_date=end)
        base['summary'] = {
            'total_received': base['received_value'],
            'total_confirmed': base['confirmed_value'],
            'total_pending': base['pending_value'],
            'total_overdue': base['overdue_value'],
            'mrr': base['recurring_value'],
            'expenses_total': base['manual_financial']['summary']['expenses_total'],
            'direct_sales_total': base['manual_financial']['summary']['direct_sales_total'],
        }
        return base
