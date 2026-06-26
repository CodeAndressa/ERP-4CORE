from __future__ import annotations

from collections import Counter
from datetime import date
from typing import Any

import httpx

from app.core.config import settings


class AsaasUnavailable(Exception):
    pass


class AsaasService:
    def __init__(self):
        if not settings.asaas_api_key:
            raise AsaasUnavailable("Configure ASAAS_API_KEY no backend.")
        self.base_url = settings.asaas_base_url.rstrip("/")
        self.headers = {"access_token": settings.asaas_api_key}

    async def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        async with httpx.AsyncClient(base_url=self.base_url, headers=self.headers, timeout=25.0) as client:
            response = await client.get(path, params=params or {})
            if response.status_code >= 400:
                raise AsaasUnavailable("Não foi possível consultar o ASAAS.")
            return response.json()

    async def payments(self, limit: int = 100) -> dict[str, Any]:
        return await self._get("/payments", {"limit": limit, "offset": 0, "sort": "dueDate", "order": "desc"})

    async def overview(self) -> dict[str, Any]:
        result = await self.payments()
        payments = result.get("data", [])
        statuses = Counter(item.get("status", "UNKNOWN") for item in payments)
        received_states = {"RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"}
        open_states = {"PENDING", "AWAITING_RISK_ANALYSIS", "AWAITING_CHARGEBACK_REVERSAL"}
        overdue_states = {"OVERDUE"}
        value = lambda items: round(sum(float(item.get("value") or 0) for item in items), 2)
        received = [item for item in payments if item.get("status") in received_states]
        pending = [item for item in payments if item.get("status") in open_states]
        overdue = [item for item in payments if item.get("status") in overdue_states]
        customers = await self._get("/customers", {"limit": 1})
        return {
            "source": "asaas",
            "updated_at": date.today().isoformat(),
            "customers_total": customers.get("totalCount", 0),
            "payments_total": result.get("totalCount", len(payments)),
            "sample_size": len(payments),
            "received_value": value(received),
            "pending_value": value(pending),
            "overdue_value": value(overdue),
            "received_count": len(received),
            "pending_count": len(pending),
            "overdue_count": len(overdue),
            "status_counts": dict(statuses),
            "payments": [
                {"id": item.get("id"), "customer": item.get("customerName") or "Cliente", "description": item.get("description") or "Cobrança ASAAS", "value": item.get("value", 0), "status": item.get("status"), "due_date": item.get("dueDate"), "payment_date": item.get("paymentDate")}
                for item in payments[:20]
            ],
        }
    async def customers(self, limit: int = 100) -> list[dict[str, Any]]:
        result = await self._get("/customers", {"limit": limit, "offset": 0, "sort": "name", "order": "asc"})
        return [
            {"id": item.get("id"), "name": item.get("name"), "email": item.get("email"), "phone": item.get("phone") or item.get("mobilePhone"), "created_at": item.get("dateCreated")}
            for item in result.get("data", [])
        ]

    async def insights(self) -> dict[str, Any]:
        base = await self.overview()
        raw = (await self.payments()).get("data", [])
        received_states = {"RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"}
        daily: dict[str, dict[str, float]] = {}
        billing: dict[str, float] = {}
        for item in raw:
            status = item.get("status", "PENDING")
            event_date = item.get("paymentDate") if status in received_states else item.get("dueDate")
            if event_date:
                day = daily.setdefault(event_date, {"received": 0, "confirmed": 0, "pending": 0, "overdue": 0})
                key = "received" if status == "RECEIVED" else "confirmed" if status in {"CONFIRMED", "RECEIVED_IN_CASH"} else "overdue" if status == "OVERDUE" else "pending"
                day[key] += float(item.get("value") or 0)
            payment_type = item.get("billingType") or "OUTROS"
            billing[payment_type] = billing.get(payment_type, 0) + float(item.get("value") or 0)
        base["daily_status"] = [{"date": date, **values} for date, values in sorted(daily.items())]
        base["billing_types"] = [{"type": key, "value": round(value, 2)} for key, value in sorted(billing.items(), key=lambda row: row[1], reverse=True)]
        monthly: dict[str, float] = {}
        for item in raw:
            due = item.get("dueDate")
            if due:
                month = due[:7]
                monthly[month] = monthly.get(month, 0) + float(item.get("value") or 0)
        base["forecast_6_months"] = [{"month": month, "value": round(value, 2)} for month, value in sorted(monthly.items())[:6]]
        recurring = [item for item in raw if item.get("subscription")]
        base["recurring_value"] = round(sum(float(item.get("value") or 0) for item in recurring), 2)
        base["recurring_count"] = len(recurring)
        return base