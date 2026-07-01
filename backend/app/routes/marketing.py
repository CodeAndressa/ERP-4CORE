import json

import httpx
from fastapi import APIRouter, HTTPException, Query

from app.core.config import settings
from app.services.meta_marketing_service import MetaMarketingService, mask_token

router = APIRouter(prefix="/marketing", tags=["marketing"])

svc = MetaMarketingService


# ─── Status & OAuth ───────────────────────────────────────────────────────────

@router.get("/meta/status")
def meta_status():
    from app.core.config import settings
    return {
        "configured": bool(settings.meta_app_id and settings.meta_app_secret),
        "app_id": settings.meta_app_id,
        "redirect_uri": settings.meta_redirect_uri,
        "page_connected": bool(settings.meta_page_id and (settings.meta_page_access_token or settings.meta_access_token)),
        "page_id": settings.meta_page_id,
        "token": mask_token(settings.meta_page_access_token or settings.meta_access_token),
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
