from __future__ import annotations

from collections import Counter
from datetime import date, datetime, timedelta
from time import monotonic
from typing import Any

import httpx

from app.core.config import settings
from app.services.manual_financial_service import manual_financial_snapshot


class AsaasUnavailable(Exception):
    pass


_CACHE_TTL_SECONDS = 60 * 60
_CACHE: dict[tuple[str, tuple[tuple[str, Any], ...]], tuple[float, dict[str, Any]]] = {}


def _cache_key(path: str, params: dict[str, Any] | None) -> tuple[str, tuple[tuple[str, Any], ...]]:
    return (path.lstrip('/'), tuple(sorted((params or {}).items())))


class AsaasService:
    def __init__(self, force_refresh: bool = False):
        if not settings.asaas_api_key:
            raise AsaasUnavailable('Configure ASAAS_API_KEY no backend.')
        self.base_url = settings.asaas_base_url.rstrip('/') + '/'
        self.headers = {'access_token': settings.asaas_api_key}
        self.force_refresh = force_refresh

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

    async def payments(self, limit: int = 100) -> dict[str, Any]:
        return await self._get('payments', {'limit': limit, 'offset': 0, 'sort': 'dueDate', 'order': 'desc'})

    async def subscriptions(self) -> list[dict[str, Any]]:
        result = await self._get('subscriptions', {'limit': 100})
        all_subs = result.get('data', [])
        return [subscription for subscription in all_subs if (subscription.get('status') or '').upper() == 'ACTIVE']

    async def overview(self) -> dict[str, Any]:
        result = await self.payments()
        payments = result.get('data', [])
        statuses = Counter(item.get('status', 'UNKNOWN') for item in payments)
        received_states = {'RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'}
        open_states = {'PENDING', 'AWAITING_RISK_ANALYSIS', 'AWAITING_CHARGEBACK_REVERSAL'}
        overdue_states = {'OVERDUE'}
        value = lambda items: round(sum(float(item.get('value') or 0) for item in items), 2)
        received = [item for item in payments if item.get('status') in received_states]
        pending = [item for item in payments if item.get('status') in open_states]
        overdue = [item for item in payments if item.get('status') in overdue_states]
        customers = await self._get('customers', {'limit': 1})
        return {
            'source': 'asaas',
            'updated_at': datetime.now().isoformat(timespec='seconds'),
            'cache_ttl_seconds': _CACHE_TTL_SECONDS,
            'customers_total': customers.get('totalCount', 0),
            'payments_total': result.get('totalCount', len(payments)),
            'sample_size': len(payments),
            'received_value': value(received),
            'pending_value': value(pending),
            'overdue_value': value(overdue),
            'received_count': len(received),
            'pending_count': len(pending),
            'overdue_count': len(overdue),
            'status_counts': dict(statuses),
            'payments': [
                {
                    'id': item.get('id'),
                    'customer': item.get('customerName') or 'Cliente',
                    'description': item.get('description') or 'Cobrança ASAAS',
                    'value': item.get('value', 0),
                    'status': item.get('status'),
                    'due_date': item.get('dueDate'),
                    'payment_date': item.get('paymentDate'),
                }
                for item in payments[:20]
            ],
        }

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

    async def insights(self, days: int = 180) -> dict[str, Any]:
        base = await self.overview()
        raw = (await self.payments()).get('data', [])
        received_states = {'RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'}

        cutoff = (date.today() - timedelta(days=days)).isoformat()
        filtered = [
            item for item in raw
            if (item.get('dueDate') or '') >= cutoff or (item.get('paymentDate') or '') >= cutoff
        ]

        daily: dict[str, dict[str, float]] = {}
        billing: dict[str, float] = {}
        for item in filtered:
            status = item.get('status', 'PENDING')
            event_date = item.get('paymentDate') if status in received_states else item.get('dueDate')
            if event_date:
                day = daily.setdefault(event_date, {'received': 0, 'confirmed': 0, 'pending': 0, 'overdue': 0})
                key = 'received' if status == 'RECEIVED' else 'confirmed' if status in {'CONFIRMED', 'RECEIVED_IN_CASH'} else 'overdue' if status == 'OVERDUE' else 'pending'
                day[key] += float(item.get('value') or 0)
            payment_type = item.get('billingType') or 'OUTROS'
            billing[payment_type] = billing.get(payment_type, 0) + float(item.get('value') or 0)

        base['daily_status'] = [{'date': day, **values} for day, values in sorted(daily.items())]
        base['billing_types'] = [{'type': key, 'value': round(value, 2)} for key, value in sorted(billing.items(), key=lambda row: row[1], reverse=True)]
        active_subscriptions = await self.subscriptions()
        base['recurring_value'] = round(sum(float(item.get('value') or 0) for item in active_subscriptions), 2)
        base['recurring_count'] = len(active_subscriptions)
        base['subscriptions'] = active_subscriptions
        base['manual_financial'] = manual_financial_snapshot(raw)
        base['summary'] = {
            'total_received': base['received_value'],
            'total_pending': base['pending_value'],
            'total_overdue': base['overdue_value'],
            'mrr': base['recurring_value'],
            'expenses_total': base['manual_financial']['summary']['expenses_total'],
            'direct_sales_total': base['manual_financial']['summary']['direct_sales_total'],
        }
        return base
