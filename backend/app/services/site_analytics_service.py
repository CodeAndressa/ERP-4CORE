from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

from app.core.config import settings


class SiteAnalyticsNotConfigured(Exception):
    pass


def _iso_start(days: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()


def _headers() -> dict[str, str]:
    key = settings.site_supabase_service_role_key
    return {"apikey": key, "Authorization": f"Bearer {key}"}


async def _fetch_table(table: str, params: dict[str, str]) -> list[dict[str, Any]]:
    if not settings.site_supabase_url or not settings.site_supabase_service_role_key:
        raise SiteAnalyticsNotConfigured

    url = f"{settings.site_supabase_url.rstrip('/')}/rest/v1/{table}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url, headers=_headers(), params=params)
        response.raise_for_status()
        return response.json()


async def get_site_dashboard(days: int = 30) -> dict[str, Any]:
    start = _iso_start(days)
    events = await _fetch_table(
        "events",
        {
            "select": "type,session_id,created_at,page,source,device",
            "created_at": f"gte.{start}",
            "order": "created_at.desc",
            "limit": "10000",
        },
    )
    leads = await _fetch_table(
        "leads",
        {
            "select": "id,name,email,phone,company,source_page,source_channel,interest,status,created_at,last_contact_at",
            "created_at": f"gte.{start}",
            "order": "created_at.desc",
            "limit": "100",
        },
    )

    page_views = [event for event in events if event.get("type") == "page_view"]
    sessions = {event.get("session_id") for event in events if event.get("session_id")}
    page_sessions: dict[str, set[str]] = defaultdict(set)
    page_counts: Counter[str] = Counter()
    source_sessions: dict[str, set[str]] = defaultdict(set)
    source_conversions: Counter[str] = Counter()
    devices: Counter[str] = Counter()
    daily: dict[str, dict[str, Any]] = defaultdict(lambda: {"pageviews": 0, "visitors": set(), "conversions": 0, "leads": 0})

    conversion_types = {"whatsapp_click", "form_submit", "lead_captured"}
    for event in events:
        source = event.get("source") or "direct"
        session_id = event.get("session_id")
        if session_id:
            source_sessions[source].add(session_id)
        if event.get("type") in conversion_types:
            source_conversions[source] += 1
        if event.get("device"):
            devices[event["device"]] += 1
        created_at = event.get("created_at", "")
        date = created_at[:10]
        if date:
            if event.get("type") == "page_view":
                daily[date]["pageviews"] += 1
                if session_id:
                    daily[date]["visitors"].add(session_id)
            if event.get("type") in conversion_types:
                daily[date]["conversions"] += 1

    for event in page_views:
        page = event.get("page") or "/"
        page_counts[page] += 1
        if event.get("session_id"):
            page_sessions[page].add(event["session_id"])

    for lead in leads:
        date = (lead.get("created_at") or "")[:10]
        if date:
            daily[date]["leads"] += 1

    total_conversions = sum(1 for event in events if event.get("type") in conversion_types)
    total_sessions = len(sessions)
    session_view_counts = Counter(event.get("session_id") for event in page_views if event.get("session_id"))
    bounce_rate = round((sum(1 for count in session_view_counts.values() if count == 1) / len(session_view_counts) * 100), 1) if session_view_counts else 0

    return {
        "configured": True,
        "period_days": days,
        "synced_at": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "unique_visitors": total_sessions,
            "pageviews": len(page_views),
            "conversions": total_conversions,
            "leads": len(leads),
            "conversion_rate": round(total_conversions / total_sessions * 100, 1) if total_sessions else 0,
            "bounce_rate": bounce_rate,
        },
        "daily": [
            {"date": date, "pageviews": values["pageviews"], "visitors": len(values["visitors"]), "conversions": values["conversions"], "leads": values["leads"]}
            for date, values in sorted(daily.items())
        ],
        "top_pages": [
            {"page": page, "pageviews": count, "visitors": len(page_sessions[page])}
            for page, count in page_counts.most_common(8)
        ],
        "sources": [
            {"source": source, "visitors": len(visitor_ids), "conversions": source_conversions[source], "conversion_rate": round(source_conversions[source] / len(visitor_ids) * 100, 1) if visitor_ids else 0}
            for source, visitor_ids in sorted(source_sessions.items(), key=lambda item: len(item[1]), reverse=True)
        ],
        "devices": [{"device": device, "events": count} for device, count in devices.most_common()],
        "recent_leads": leads,
    }
