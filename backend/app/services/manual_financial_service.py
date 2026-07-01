from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
import re
import unicodedata
from typing import Any, Literal

ExpenseKind = Literal["fixed", "recurring"]


@dataclass(frozen=True)
class ManualExpense:
    id: str
    month: str
    date: str
    category: str
    description: str
    value: Decimal
    vendor: str
    kind: ExpenseKind
    recurrence: str
    notes: str | None = None


@dataclass(frozen=True)
class DirectSaleInstallment:
    id: str
    month: str
    date: str
    description: str
    customer: str
    value: Decimal
    contract_total: Decimal
    source: str = "Reposicao de caixa"


EXPENSES = [
    ManualExpense("exp-topdata-software-2026-06", "2026-06", "2026-06-15", "Software", "Software Topdata", Decimal("220.00"), "Topdata", "recurring", "Mensal"),
    ManualExpense("exp-emprestimo-2026-06", "2026-06", "2026-06-24", "Financeiro", "Emprestimo", Decimal("1368.00"), "Instituicao financeira", "recurring", "Mensal"),
    ManualExpense("exp-imposto-2026-06", "2026-06", "2026-06-22", "Impostos", "Imposto", Decimal("86.50"), "Governo", "fixed", "Pontual"),
    ManualExpense("exp-correios-2026-06", "2026-06", "2026-06-22", "Logistica", "Correios", Decimal("90.00"), "Correios", "fixed", "Pontual"),
    ManualExpense("exp-contabilidade-2026-06", "2026-06", "2026-06-16", "Contabilidade", "Contabilidade", Decimal("315.00"), "Contabilidade", "recurring", "Mensal", "Faturamento de maio"),
]


DIRECT_SALE_INSTALLMENTS = [
    DirectSaleInstallment("sale-balestrin-2026-04", "2026-04", "2026-04-30", "Leitor facial", "BALESTRIN INDUSTRIA ELETRICA E MECANICA LTDA", Decimal("461.66"), Decimal("3921.66")),
    DirectSaleInstallment("sale-balestrin-2026-05", "2026-05", "2026-05-31", "Leitor facial", "BALESTRIN INDUSTRIA ELETRICA E MECANICA LTDA", Decimal("461.66"), Decimal("3921.66")),
    DirectSaleInstallment("sale-balestrin-2026-06", "2026-06", "2026-06-30", "Leitor facial", "BALESTRIN INDUSTRIA ELETRICA E MECANICA LTDA", Decimal("461.66"), Decimal("3921.66")),
    DirectSaleInstallment("sale-gineclin-2026-05", "2026-05", "2026-05-31", "Leitor facial", "GINECLIN SERVICOS ESPECIALIZADOS EM GINECOLOGIA LTDA", Decimal("480.56"), Decimal("2536.68")),
    DirectSaleInstallment("sale-gineclin-2026-06", "2026-06", "2026-06-30", "Leitor facial", "GINECLIN SERVICOS ESPECIALIZADOS EM GINECOLOGIA LTDA", Decimal("480.56"), Decimal("2536.68")),
    DirectSaleInstallment("sale-gineclin-2026-07", "2026-07", "2026-07-31", "Leitor facial", "GINECLIN SERVICOS ESPECIALIZADOS EM GINECOLOGIA LTDA", Decimal("480.56"), Decimal("2536.68")),
    DirectSaleInstallment("sale-biovida-2026-07", "2026-07", "2026-07-31", "Leitor facial", "FARMACIAS BIOVIDA II LTDA", Decimal("547.50"), Decimal("1095.00")),
    DirectSaleInstallment("sale-biovida-2026-08", "2026-08", "2026-08-31", "Leitor facial", "FARMACIAS BIOVIDA II LTDA", Decimal("547.50"), Decimal("1095.00")),
]


def _money(value: Decimal) -> float:
    return float(round(value, 2))


def _normalize(text: str | None) -> str:
    value = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^a-zA-Z0-9]+", " ", value).lower()
    return re.sub(r"\s+", " ", value).strip()


def _customer_matches(manual_customer: str, payment_customer: str | None) -> bool:
    left = _normalize(manual_customer)
    right = _normalize(payment_customer)
    if not left or not right:
        return False
    return left in right or right in left or left[:18] in right


def _payment_month(payment: dict[str, Any]) -> str:
    event_date = payment.get("payment_date") or payment.get("paymentDate") or payment.get("due_date") or payment.get("dueDate") or ""
    return event_date[:7]


def _payment_value(payment: dict[str, Any]) -> Decimal:
    return Decimal(str(payment.get("value") or 0))


def _match_installment(installment: DirectSaleInstallment, payments: list[dict[str, Any]]) -> dict[str, Any] | None:
    for payment in payments:
        same_month = _payment_month(payment) == installment.month
        same_value = abs(_payment_value(payment) - installment.value) <= Decimal("0.02")
        same_customer = _customer_matches(installment.customer, payment.get("customer") or payment.get("customerName"))
        if same_month and same_value and same_customer:
            return {
                "payment_id": payment.get("id"),
                "status": payment.get("status"),
                "due_date": payment.get("due_date") or payment.get("dueDate"),
                "payment_date": payment.get("payment_date") or payment.get("paymentDate"),
            }
    return None


def _expense_payload(item: ManualExpense) -> dict[str, Any]:
    return {
        "id": item.id,
        "month": item.month,
        "date": item.date,
        "category": item.category,
        "description": item.description,
        "value": _money(item.value),
        "vendor": item.vendor,
        "kind": item.kind,
        "recurrence": item.recurrence,
        "notes": item.notes,
    }


def manual_financial_snapshot(asaas_payments: list[dict[str, Any]] | None = None, start_date: str | None = None, end_date: str | None = None) -> dict[str, Any]:
    payments = asaas_payments or []
    expenses = [_expense_payload(item) for item in EXPENSES if (not start_date or item.date >= start_date) and (not end_date or item.date <= end_date)]

    direct_sales = []
    for item in DIRECT_SALE_INSTALLMENTS:
        if (start_date and item.date < start_date) or (end_date and item.date > end_date):
            continue
        match = _match_installment(item, payments)
        direct_sales.append(
            {
                "id": item.id,
                "month": item.month,
                "date": item.date,
                "description": item.description,
                "customer": item.customer,
                "value": _money(item.value),
                "contract_total": _money(item.contract_total),
                "source": item.source,
                "asaas_match": match,
                "matched": match is not None,
            }
        )

    monthly: dict[str, dict[str, float]] = {}
    for item in expenses:
        bucket = monthly.setdefault(item["month"], {"month": item["month"], "manual_revenue": 0.0, "expenses": 0.0, "fixed_costs": 0.0, "recurring_costs": 0.0, "unmatched_direct_sales": 0.0})
        bucket["expenses"] += item["value"]
        bucket["fixed_costs" if item["kind"] == "fixed" else "recurring_costs"] += item["value"]
    for item in direct_sales:
        bucket = monthly.setdefault(item["month"], {"month": item["month"], "manual_revenue": 0.0, "expenses": 0.0, "fixed_costs": 0.0, "recurring_costs": 0.0, "unmatched_direct_sales": 0.0})
        bucket["manual_revenue"] += item["value"]
        if not item["matched"]:
            bucket["unmatched_direct_sales"] += item["value"]

    fixed_total = sum(Decimal(str(item["value"])) for item in expenses if item["kind"] == "fixed")
    recurring_total = sum(Decimal(str(item["value"])) for item in expenses if item["kind"] == "recurring")
    return {
        "source": "manual",
        "updated_at": date.today().isoformat(),
        "expenses": expenses,
        "fixed_costs": [item for item in expenses if item["kind"] == "fixed"],
        "recurring_costs": [item for item in expenses if item["kind"] == "recurring"],
        "direct_sales": direct_sales,
        "monthly": [{**row, "expenses": round(row["expenses"], 2), "fixed_costs": round(row["fixed_costs"], 2), "recurring_costs": round(row["recurring_costs"], 2), "manual_revenue": round(row["manual_revenue"], 2), "unmatched_direct_sales": round(row["unmatched_direct_sales"], 2)} for row in sorted(monthly.values(), key=lambda row: row["month"])],
        "summary": {
            "expenses_total": _money(fixed_total + recurring_total),
            "fixed_expenses_total": _money(fixed_total),
            "recurring_expenses_total": _money(recurring_total),
            "variable_expenses_total": 0.0,
            "direct_sales_total": round(sum(item["value"] for item in direct_sales), 2),
            "unmatched_direct_sales_total": round(sum(item["value"] for item in direct_sales if not item["matched"]), 2),
            "matched_direct_sales_count": sum(1 for item in direct_sales if item["matched"]),
            "direct_sales_count": len(direct_sales),
        },
    }