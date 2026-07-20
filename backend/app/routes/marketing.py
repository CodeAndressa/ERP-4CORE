import json
import secrets
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.models.marketing import ExternalScheduledPost, InstagramMessage
from app.services import instagram_dm_service
from app.services.meta_marketing_service import MetaMarketingService, mask_token

router = APIRouter(prefix="/marketing", tags=["marketing"])

svc = MetaMarketingService


# ─── Status & OAuth ───────────────────────────────────────────────────────────

@router.get("/meta/status")
async def meta_status():
    from app.core.config import settings
    from app.services.token_store import aget as ts_aget
    # Checar token_store (Supabase ou arquivo) além das env vars
    stored_page_id = await ts_aget("meta_page_id")
    stored_token = await ts_aget("meta_page_access_token")
    page_id = stored_page_id or settings.meta_page_id
    token = stored_token or settings.meta_page_access_token or settings.meta_access_token
    return {
        "configured": bool(settings.meta_app_id and settings.meta_app_secret),
        "app_id": settings.meta_app_id,
        "redirect_uri": settings.meta_redirect_uri,
        "page_connected": bool(page_id and token),
        "page_id": page_id,
        "token": mask_token(token),
        "token_source": "supabase/file" if stored_token else "env",
        "graph_version": settings.meta_graph_version,
        "required_env": ["META_APP_ID", "META_APP_SECRET", "META_REDIRECT_URI", "META_PAGE_ID", "META_PAGE_ACCESS_TOKEN"],
    }


@router.get("/meta/auth-url")
def meta_auth_url(redirect_uri: str | None = Query(default=None)):
    return {"url": svc().auth_url(redirect_uri)}


@router.get("/meta/callback")
async def meta_callback(code: str, redirect_uri: str | None = Query(default=None)):
    return await svc().exchange_code_and_pages(code, redirect_uri)


@router.get("/meta/pages")
async def meta_pages(user_access_token: str):
    return {"pages": await svc().list_pages(user_access_token)}


# ─── Facebook Page ────────────────────────────────────────────────────────────

@router.get("/meta/posts")
async def meta_posts():
    posts = await svc().page_posts()
    return {"posts": posts}


# Alias usado pelo Dashboard — retorna posts do Instagram no formato legado
@router.get("/posts")
async def posts_compat():
    try:
        media = await svc().instagram_media()
    except Exception:
        return []
    return [
        {
            "id": p.get("id"),
            "title": (p.get("caption") or "").replace("\n", " ")[:80] or "(sem legenda)",
            "channel": "Instagram",
            "status": "publicado",
            "format": (
                "Reels" if p.get("media_product_type") == "REELS"
                else "Carrossel" if p.get("media_type") == "CAROUSEL_ALBUM"
                else "Vídeo" if p.get("media_type") == "VIDEO"
                else "Foto"
            ),
            "date": p.get("timestamp", "")[:10],
        }
        for p in media
    ]


@router.get("/meta/insights")
async def meta_insights():
    return await svc().page_insights_full()


# ─── Instagram Business Account ───────────────────────────────────────────────

@router.get("/meta/instagram/profile")
async def instagram_profile():
    return await svc().instagram_profile()


@router.get("/meta/instagram/posts")
async def instagram_posts():
    media = await svc().instagram_media()
    return {"posts": media}


@router.get("/meta/instagram/insights")
async def instagram_insights():
    return await svc().instagram_account_insights()


@router.get("/meta/instagram/follower-growth")
async def follower_growth():
    return await svc().instagram_follower_growth()


@router.get("/meta/instagram/messages")
async def instagram_messages():
    return await svc().instagram_messages()


# ─── AI (Groq) ────────────────────────────────────────────────────────────────

def _groq_headers() -> dict:
    if not settings.groq_api_key:
        raise HTTPException(503, "GROQ_API_KEY não configurado.")
    return {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"}


@router.post("/meta/ai/ideas")
async def ai_ideas():
    try:
        media = await svc().instagram_media()
    except Exception:
        media = []

    captions = [
        (p.get("caption") or "").replace("\n", " ").strip()[:300]
        for p in media[:20]
        if (p.get("caption") or "").strip()
    ]

    system = (
        "Você é um estrategista de conteúdo B2B para consultorias trabalhistas brasileiras. "
        "Analise os posts existentes do Instagram e crie 6 novas ideias criativas, diversas e "
        "alinhadas ao nicho. Não repita temas já abordados. "
        'Responda SOMENTE JSON: {"ideas": [{"title": string, "angle": string, "format": string, '
        '"channel": string, "tags": [string]}]} '
        "Formatos válidos: Carrossel, Reels, Artigo, Newsletter, Estático, Vídeo. "
        "Canais válidos: Instagram, LinkedIn, E-mail."
    )
    context = {
        "existing_posts": captions,
        "niche": "consultoria trabalhista, departamento pessoal, compliance trabalhista",
        "audience": "gestores de RH, empresários, DP de PMEs",
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=_groq_headers(),
            json={
                "model": settings.groq_model,
                "temperature": 0.72,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
                ],
            },
        )
        resp.raise_for_status()

    return json.loads(resp.json()["choices"][0]["message"]["content"])


@router.post("/meta/ai/planning")
async def ai_planning():
    try:
        media = await svc().instagram_media()
    except Exception:
        media = []

    captions = [
        (p.get("caption") or "").replace("\n", " ").strip()[:300]
        for p in media[:20]
        if (p.get("caption") or "").strip()
    ]

    system = (
        "Você é um estrategista de conteúdo B2B. Para cada pilar fornecido, sugira 2 posts "
        "específicos com título, formato, ângulo e data sugerida em julho de 2026. "
        "Base as sugestões no histórico de posts. "
        'Responda SOMENTE JSON: {"suggestions": [{"pillar": string, "title": string, '
        '"format": string, "angle": string, "suggested_date": string}]} '
        "Formato: Carrossel, Reels, Artigo, Estático, Vídeo, Newsletter. "
        "Data no formato YYYY-MM-DD."
    )
    context = {
        "pillars": ["Educação", "Cases", "Autoridade", "Engajamento", "Prospecção"],
        "existing_posts": captions,
        "month": "julho 2026",
        "niche": "consultoria trabalhista",
    }

    async with httpx.AsyncClient(timeout=45.0) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers=_groq_headers(),
            json={
                "model": settings.groq_model,
                "temperature": 0.6,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": json.dumps(context, ensure_ascii=False)},
                ],
            },
        )
        resp.raise_for_status()

    return json.loads(resp.json()["choices"][0]["message"]["content"])


# ─── Instagram DM (produto "API do Instagram com Login do Instagram") ────────
# App separado do Facebook Login acima; ver instagram_dm_service.py.

class ConnectInstagramLoginRequest(BaseModel):
    access_token: str = Field(min_length=10, max_length=4000)


@router.post("/meta/instagram-login/connect")
async def connect_instagram_login(payload: ConnectInstagramLoginRequest):
    return await instagram_dm_service.connect(payload.access_token)


@router.get("/meta/instagram-login/status")
async def instagram_login_status():
    return await instagram_dm_service.status()


@router.post("/meta/instagram-login/refresh")
async def refresh_instagram_login():
    return await instagram_dm_service.refresh()


@router.get("/meta/instagram/conversations")
async def list_instagram_conversations():
    return {"conversations": await instagram_dm_service.list_conversations()}


@router.get("/meta/instagram/conversations/{conversation_id}/messages")
async def get_conversation_messages(conversation_id: str):
    return {"messages": await instagram_dm_service.conversation_messages(conversation_id)}


class ReplyRequest(BaseModel):
    recipient_id: str = Field(min_length=1, max_length=64)
    text: str = Field(min_length=1, max_length=1000)


@router.post("/meta/instagram/conversations/{conversation_id}/reply")
async def send_conversation_reply(conversation_id: str, payload: ReplyRequest):
    return await instagram_dm_service.send_message(payload.recipient_id, payload.text)


# ─── Webhook (chamado direto pela Meta, fora do SPA — ver server.py) ─────────

@router.get("/meta/webhook")
async def verify_webhook(request: Request):
    params = request.query_params
    challenge = params.get("hub.challenge", "")
    verify_token = params.get("hub.verify_token", "")
    if (
        params.get("hub.mode") == "subscribe"
        and settings.meta_webhook_verify_token
        and secrets.compare_digest(verify_token, settings.meta_webhook_verify_token)
    ):
        return PlainTextResponse(challenge)
    raise HTTPException(403, "Verificação do webhook falhou.")


@router.post("/meta/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    body = await request.body()
    signature = request.headers.get("x-hub-signature-256")
    if not instagram_dm_service.verify_webhook_signature(settings.instagram_login_app_secret, body, signature):
        raise HTTPException(403, "Assinatura do webhook inválida.")

    try:
        payload = json.loads(body or b"{}")
    except json.JSONDecodeError:
        return {"status": "ignored"}

    _, my_id = await instagram_dm_service.credentials()
    for entry in payload.get("entry", []) or []:
        for event in entry.get("messaging", []) or []:
            sender_id = str((event.get("sender") or {}).get("id") or "")
            recipient_id = str((event.get("recipient") or {}).get("id") or "")
            message = event.get("message") or {}
            mid = str(message.get("mid") or "")
            text = str(message.get("text") or "")
            if not mid or not sender_id:
                continue
            if db.query(InstagramMessage).filter(InstagramMessage.mid == mid).first():
                continue
            direction = "outbound" if my_id and sender_id == my_id else "inbound"
            conversation_id = recipient_id if direction == "outbound" else sender_id
            db.add(InstagramMessage(
                conversation_id=conversation_id or sender_id,
                sender_id=sender_id,
                direction=direction,
                text=text,
                mid=mid,
            ))
    db.commit()
    return {"status": "ok"}
