"""Envio transacional de e-mail via Resend. Se RESEND_API_KEY/EMAIL_FROM não
estiverem configurados, ou se dry_run=True, apenas simula o envio (não bate
na API da Resend) — usado pro modo de teste da cobrança automática."""
from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings


def is_configured() -> bool:
    return bool(settings.resend_api_key and settings.email_from)


async def send(to: str, subject: str, html: str, dry_run: bool = False, sender_name: str = "Financeiro - 4Core") -> dict[str, Any]:
    if dry_run or not is_configured():
        return {
            "sent": False,
            "dry_run": True,
            "reason": "" if dry_run else "RESEND_API_KEY ou EMAIL_FROM não configurados",
            "to": to,
            "subject": subject,
        }
    sender = f"{sender_name} <{settings.email_from}>" if sender_name else settings.email_from
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
            json={"from": sender, "to": [to], "subject": subject, "html": html},
        )
    if r.status_code >= 400:
        raise HTTPException(502, f"Falha ao enviar e-mail via Resend: {r.text[:220]}")
    return {"sent": True, "dry_run": False, "to": to, "subject": subject, **r.json()}
