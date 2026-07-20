"""Mensagens diretas do Instagram via "Instagram API com Login do Instagram".

Produto separado do Meta app de Facebook Login já usado pelo resto do marketing
(meta_marketing_service.py, que fala com graph.facebook.com usando token de Página).
Este serviço fala com graph.instagram.com usando um Instagram User Access Token
gerado direto no painel de desenvolvedor da Meta (app "4Core ERP-IG"), guardado
via token_store — não existe fluxo de OAuth próprio aqui, o token chega pronto.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.services import token_store

GRAPH_VERSION = "v23.0"
BASE_URL = f"https://graph.instagram.com/{GRAPH_VERSION}"


async def _stored(key: str, fallback: str = "") -> str:
    value = await token_store.aget(f"instagram_login_{key}")
    return value or fallback


async def credentials() -> tuple[str, str]:
    """Retorna (access_token, ig_user_id) — token_store tem prioridade sobre o .env."""
    token = await _stored("access_token", settings.instagram_login_access_token)
    user_id = await _stored("user_id", settings.instagram_login_user_id)
    return token, user_id


async def is_configured() -> bool:
    token, user_id = await credentials()
    return bool(token and user_id)


async def status() -> dict[str, Any]:
    token, user_id = await credentials()
    username = await _stored("username")
    expires_at = await _stored("expires_at")
    return {
        "configured": bool(token and user_id),
        "user_id": user_id,
        "username": username,
        "token": f"{token[:6]}...{token[-4:]}" if len(token) > 12 else ("***" if token else ""),
        "expires_at": expires_at or None,
    }


async def _resolve_profile(token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{BASE_URL}/me", params={"fields": "user_id,username", "access_token": token})
    if r.status_code >= 400:
        raise HTTPException(502, f"Não foi possível validar o token com a Meta: {r.text[:220]}")
    return r.json()


async def _exchange_long_lived(short_token: str) -> dict[str, Any]:
    if not settings.instagram_login_app_secret:
        raise HTTPException(503, "Configure INSTAGRAM_LOGIN_APP_SECRET no backend antes de conectar.")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            "https://graph.instagram.com/access_token",
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": settings.instagram_login_app_secret,
                "access_token": short_token,
            },
        )
    if r.status_code >= 400:
        raise HTTPException(502, f"Falha ao gerar token de longa duração: {r.text[:220]}")
    return r.json()


async def connect(raw_token: str) -> dict[str, Any]:
    """Troca o token colado na tela por um de longa duração (~60 dias), resolve o
    usuário do Instagram e persiste tudo via token_store. Se a troca falhar (ex.: app
    ainda sem o "Login da empresa no Instagram" configurado no painel da Meta), cai
    de volta pro token curto original — ele funciona normalmente até expirar, só não
    dura ~60 dias."""
    long_token = raw_token
    expires_in: int | None = None
    exchange_warning = ""
    try:
        exchanged = await _exchange_long_lived(raw_token)
        long_token = exchanged.get("access_token") or raw_token
        expires_in = exchanged.get("expires_in")
    except HTTPException as exc:
        exchange_warning = str(exc.detail)

    profile = await _resolve_profile(long_token)
    user_id = str(profile.get("user_id") or "")
    username = str(profile.get("username") or "")
    if not user_id:
        raise HTTPException(502, "A Meta não retornou o ID da conta do Instagram para este token.")

    expires_at = (
        (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))).isoformat()
        if expires_in else ""
    )
    await token_store.asave({
        "instagram_login_access_token": long_token,
        "instagram_login_user_id": user_id,
        "instagram_login_username": username,
        "instagram_login_expires_at": expires_at,
    })
    result = await status()
    if exchange_warning:
        result["exchange_warning"] = (
            "Conectado com o token original (curta duração) — a troca por um token de "
            f"~60 dias falhou: {exchange_warning}"
        )
    return result


async def refresh() -> dict[str, Any]:
    token, _ = await credentials()
    if not token:
        raise HTTPException(409, "Nenhum token conectado ainda.")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            "https://graph.instagram.com/refresh_access_token",
            params={"grant_type": "ig_refresh_token", "access_token": token},
        )
    if r.status_code >= 400:
        raise HTTPException(502, f"Falha ao renovar o token: {r.text[:220]}")
    body = r.json()
    new_token = body.get("access_token", token)
    expires_in = body.get("expires_in")
    expires_at = (
        (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))).isoformat()
        if expires_in else ""
    )
    await token_store.asave({"instagram_login_access_token": new_token, "instagram_login_expires_at": expires_at})
    return await status()


async def list_conversations() -> list[dict[str, Any]]:
    token, my_id = await credentials()
    if not token or not my_id:
        raise HTTPException(409, "Conecte o token de mensagens do Instagram antes de listar conversas.")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{BASE_URL}/{my_id}/conversations",
            params={
                "platform": "instagram",
                "fields": "participants,messages.limit(20){id,message,from,created_time}",
                "access_token": token,
            },
        )
    if r.status_code >= 400:
        raise HTTPException(502, f"Falha ao listar conversas: {r.text[:220]}")

    conversations = []
    for item in r.json().get("data", []):
        participants = (item.get("participants") or {}).get("data", [])
        other = next((p for p in participants if str(p.get("id")) != my_id), None)
        messages = (item.get("messages") or {}).get("data", [])
        messages_sorted = sorted(messages, key=lambda m: m.get("created_time") or "", reverse=True)
        last = messages_sorted[0] if messages_sorted else None
        conversations.append({
            "id": item.get("id"),
            "participant_id": other.get("id") if other else None,
            "participant_username": other.get("username") if other else None,
            "last_message": last.get("message") if last else "",
            "last_message_at": last.get("created_time") if last else None,
            "last_from_me": bool(last and str((last.get("from") or {}).get("id")) == my_id),
        })
    conversations.sort(key=lambda c: c.get("last_message_at") or "", reverse=True)
    return conversations


async def conversation_messages(conversation_id: str) -> list[dict[str, Any]]:
    token, my_id = await credentials()
    if not token:
        raise HTTPException(409, "Conecte o token de mensagens do Instagram antes de abrir uma conversa.")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{BASE_URL}/{conversation_id}",
            params={"fields": "messages.limit(50){id,message,from,created_time}", "access_token": token},
        )
    if r.status_code >= 400:
        raise HTTPException(502, f"Falha ao abrir a conversa: {r.text[:220]}")
    messages = (r.json().get("messages") or {}).get("data", [])
    return [
        {
            "id": m.get("id"),
            "text": m.get("message", ""),
            "created_at": m.get("created_time"),
            "from_me": str((m.get("from") or {}).get("id")) == my_id,
        }
        for m in sorted(messages, key=lambda m: m.get("created_time") or "")
    ]


async def send_message(recipient_id: str, text: str) -> dict[str, Any]:
    token, my_id = await credentials()
    if not token or not my_id:
        raise HTTPException(409, "Conecte o token de mensagens do Instagram antes de responder.")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"{BASE_URL}/{my_id}/messages",
            data={
                "recipient": json.dumps({"id": recipient_id}),
                "message": json.dumps({"text": text}),
                "access_token": token,
            },
        )
    if r.status_code >= 400:
        raise HTTPException(502, f"Falha ao enviar a resposta: {r.text[:220]}")
    return r.json()


def verify_webhook_signature(app_secret: str, body: bytes, signature_header: str | None) -> bool:
    if not app_secret or not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.removeprefix("sha256="))
