from __future__ import annotations

from datetime import datetime, time, timezone
import io
import secrets
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.marketing import MarketingContent
from app.services.marketing_asset_service import art_response, read_art_bytes, signed_art_url, store_generated_art
from app.services.marketing_canva_service import build_canva_pptx
from app.services.marketing_content_service import (
    FALLBACK_TOPIC_SUGGESTIONS,
    generate_art,
    generate_caption_only,
    generate_copy_and_prompt,
    normalize_uploaded_art,
    suggest_content_topics,
)
from app.services.meta_marketing_service import MetaMarketingService
from app.core.config import settings

router = APIRouter(prefix="/marketing/content", tags=["marketing-content"])

ALLOWED_CHANNELS = {"instagram", "facebook", "both"}
ALLOWED_FORMATS = {"image"}
ALLOWED_LAYOUTS = {"feed", "story"}
EDITABLE_STATUSES = {"draft", "awaiting_approval", "rejected", "failed", "approved", "scheduled"}
BRAZIL_TZ = ZoneInfo("America/Sao_Paulo")


class ContentCreate(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    brief: str = Field(default="", max_length=4000)
    channel: Literal["instagram", "facebook", "both"] = "instagram"
    format: Literal["image"] = "image"
    layout: Literal["feed", "story"] = "feed"
    scheduled_at: datetime | None = None


class ContentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=180)
    brief: str | None = Field(default=None, max_length=4000)
    caption: str | None = Field(default=None, max_length=10000)
    image_prompt: str | None = Field(default=None, max_length=10000)
    channel: Literal["instagram", "facebook", "both"] | None = None
    scheduled_at: datetime | None = None


class ApprovalRequest(BaseModel):
    scheduled_at: datetime | None = None


class RejectRequest(BaseModel):
    reason: str = Field(default="Ajustes solicitados", max_length=1000)


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _serialize(item: MarketingContent) -> dict:
    error_message = item.error_message or ""
    cloudflare_ready = bool(settings.cloudflare_account_id and settings.cloudflare_api_token)
    legacy_openai_billing = any(
        marker in error_message.lower()
        for marker in ("billing hard limit", "limite de cobrança", "insufficient_quota")
    )
    if cloudflare_ready and legacy_openai_billing:
        error_message = ""
    return {
        "id": item.id,
        "title": item.title,
        "brief": item.brief,
        "caption": item.caption,
        "image_prompt": item.image_prompt,
        "channel": item.channel,
        "format": item.format,
        "layout": item.layout,
        "status": item.status,
        "scheduled_at": _iso(item.scheduled_at),
        "approved_at": _iso(item.approved_at),
        "published_at": _iso(item.published_at),
        "art_ready": bool(item.art_path),
        "meta_container_id": item.meta_container_id,
        "instagram_media_id": item.instagram_media_id,
        "facebook_post_id": item.facebook_post_id,
        "error_message": error_message,
        "created_at": _iso(item.created_at),
        "updated_at": _iso(item.updated_at),
    }


def _get(db: Session, content_id: int) -> MarketingContent:
    item = db.query(MarketingContent).filter(MarketingContent.id == content_id).first()
    if not item:
        raise HTTPException(404, "PublicaÃ§Ã£o nÃ£o encontrada.")
    return item


async def _publish(item: MarketingContent, db: Session) -> MarketingContent:
    if not item.art_path:
        raise HTTPException(409, "Gere a arte antes de publicar.")
    if not item.approved_at:
        raise HTTPException(409, "A publicaÃ§Ã£o precisa ser aprovada antes do envio.")
    if item.status == "published":
        return item

    item.status = "publishing"
    item.error_message = ""
    db.commit()
    db.refresh(item)
    try:
        image_url = await signed_art_url(item.art_path)
        meta = MetaMarketingService()
        if item.layout == "story":
            result = await meta.publish_instagram_story(image_url)
            item.meta_container_id = result["container_id"]
            item.instagram_media_id = result["media_id"]
        else:
            if item.channel in {"instagram", "both"}:
                result = await meta.publish_instagram_image(image_url, item.caption)
                item.meta_container_id = result["container_id"]
                item.instagram_media_id = result["media_id"]
            if item.channel in {"facebook", "both"}:
                item.facebook_post_id = await meta.publish_facebook_image(image_url, item.caption)
        item.status = "published"
        item.published_at = datetime.now(timezone.utc)
    except HTTPException as exc:
        item.status = "failed"
        item.error_message = str(exc.detail)
        db.commit()
        raise
    except Exception as exc:
        item.status = "failed"
        item.error_message = "Falha inesperada ao publicar na Meta."
        db.commit()
        raise HTTPException(502, item.error_message) from exc
    db.commit()
    db.refresh(item)
    return item


@router.get("")
def list_content(
    status: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(MarketingContent)
    if status:
        query = query.filter(MarketingContent.status == status)
    items = query.order_by(MarketingContent.scheduled_at.asc(), MarketingContent.created_at.desc()).all()
    return {"items": [_serialize(item) for item in items], "total": len(items)}


@router.post("", status_code=201)
def create_content(payload: ContentCreate, db: Session = Depends(get_db)):
    item = MarketingContent(
        title=payload.title.strip(),
        brief=payload.brief.strip(),
        channel=payload.channel,
        format=payload.format,
        layout=payload.layout,
        scheduled_at=_utc(payload.scheduled_at),
        status="draft",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.get("/config/status")
def content_config_status():
    cloudflare_ready = bool(settings.cloudflare_account_id and settings.cloudflare_api_token)
    return {
        "art_generation": bool(cloudflare_ready or settings.openai_api_key),
        "art_provider": "Cloudflare Workers AI" if cloudflare_ready else "OpenAI" if settings.openai_api_key else None,
        "storage": bool(settings.site_supabase_url and settings.site_supabase_service_role_key),
        "meta": bool(
            (settings.meta_page_access_token or settings.meta_access_token)
            and (settings.meta_page_id or settings.instagram_business_account_id)
        ),
        "scheduler": bool(settings.marketing_cron_secret or settings.cron_secret),
    }


@router.post("/topic-suggestions")
async def topic_suggestions(db: Session = Depends(get_db)):
    existing_titles = [row[0] for row in db.query(MarketingContent.title).order_by(MarketingContent.created_at.desc()).limit(40).all()]
    try:
        recent = await MetaMarketingService().instagram_media()
        captions = [str(post.get("caption", ""))[:700] for post in recent if post.get("caption")]
    except Exception:
        captions = []
    return {"suggestions": await suggest_content_topics(captions, existing_titles)}


@router.post("/process-due")
async def process_due(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    due = (
        db.query(MarketingContent)
        .filter(MarketingContent.status == "scheduled")
        .filter(MarketingContent.scheduled_at.isnot(None))
        .filter(MarketingContent.scheduled_at <= now)
        .order_by(MarketingContent.scheduled_at.asc())
        .limit(10)
        .all()
    )
    published: list[int] = []
    failed: list[dict] = []
    for item in due:
        try:
            await _publish(item, db)
            published.append(item.id)
        except HTTPException as exc:
            failed.append({"id": item.id, "error": str(exc.detail)})
    return {"processed": len(due), "published": published, "failed": failed}


@router.post("/stories/ensure-daily")
async def ensure_daily_story(request: Request, db: Session = Depends(get_db)):
    """Cron diário — se não houver post de feed agendado/publicado pra hoje,
    gera um rascunho de Story por IA e deixa esperando aprovação no Estúdio.
    Não publica sozinho: a usuária revisa e agenda como qualquer outro item."""
    cron_secret = settings.marketing_cron_secret or settings.cron_secret
    authorization = request.headers.get('authorization', '')
    if not cron_secret or not secrets.compare_digest(authorization, f'Bearer {cron_secret}'):
        raise HTTPException(403, "Secret inválido.")

    today = datetime.now(BRAZIL_TZ).date()
    start = datetime.combine(today, time.min, tzinfo=BRAZIL_TZ).astimezone(timezone.utc)
    end = datetime.combine(today, time.max, tzinfo=BRAZIL_TZ).astimezone(timezone.utc)

    has_feed_today = (
        db.query(MarketingContent)
        .filter(
            MarketingContent.layout == "feed",
            MarketingContent.status.in_(["scheduled", "publishing", "published"]),
            MarketingContent.scheduled_at.isnot(None),
            MarketingContent.scheduled_at >= start,
            MarketingContent.scheduled_at <= end,
        )
        .first()
    )
    if has_feed_today:
        return {"created": False, "reason": "já existe um post de feed para hoje"}

    has_story_today = (
        db.query(MarketingContent)
        .filter(
            MarketingContent.layout == "story",
            MarketingContent.created_at >= start,
            MarketingContent.created_at <= end,
        )
        .first()
    )
    if has_story_today:
        return {"created": False, "reason": "o story de hoje já foi gerado"}

    existing_titles = [row[0] for row in db.query(MarketingContent.title).order_by(MarketingContent.created_at.desc()).limit(40).all()]
    try:
        recent = await MetaMarketingService().instagram_media()
        captions = [str(post.get("caption", ""))[:600] for post in recent if post.get("caption")]
    except Exception:
        captions = []
    suggestions = await suggest_content_topics(captions, existing_titles)
    topic = suggestions[0] if suggestions else FALLBACK_TOPIC_SUGGESTIONS[0]

    item = MarketingContent(
        title=topic["title"][:180],
        brief=topic.get("brief", "")[:4000],
        channel="instagram",
        format="image",
        layout="story",
        status="generating",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    try:
        generated = await generate_copy_and_prompt(item.title, item.brief, captions)
        item.caption = generated["caption"]
        item.image_prompt = generated["image_prompt"]
        db.commit()
        item.art_path = await generate_art(item.image_prompt, generated["headline"])
        item.status = "awaiting_approval"
    except HTTPException as exc:
        item.status = "failed"
        item.error_message = str(exc.detail)
    db.commit()
    db.refresh(item)
    return {"created": True, "id": item.id}


@router.get("/{content_id}")
def get_content(content_id: int, db: Session = Depends(get_db)):
    return _serialize(_get(db, content_id))


@router.patch("/{content_id}")
def update_content(content_id: int, payload: ContentUpdate, db: Session = Depends(get_db)):
    item = _get(db, content_id)
    if item.status not in EDITABLE_STATUSES:
        raise HTTPException(409, "Esta publicaÃ§Ã£o nÃ£o pode mais ser editada.")
    values = payload.model_dump(exclude_unset=True)
    if "scheduled_at" in values:
        values["scheduled_at"] = _utc(values["scheduled_at"])
    for key, value in values.items():
        setattr(item, key, value.strip() if isinstance(value, str) else value)
    if item.status in {"approved", "scheduled"} and item.scheduled_at:
        item.status = "scheduled"
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.get("/{content_id}/art")
async def get_art(content_id: int, db: Session = Depends(get_db)):
    item = _get(db, content_id)
    return await art_response(item.art_path)


@router.get("/{content_id}/canva-export")
async def export_for_canva(content_id: int, db: Session = Depends(get_db)):
    item = _get(db, content_id)
    art_content, _ = await read_art_bytes(item.art_path)
    try:
        content = await build_canva_pptx(art_content, item.title)
    except Exception as exc:
        raise HTTPException(502, "Não foi possível montar o arquivo editável para o Canva.") from exc
    filename = f"4core-conteudo-{item.id}-canva-editavel.pptx"
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/{content_id}/art/upload")
async def upload_edited_art(
    content_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    item = _get(db, content_id)
    if item.status in {"generating", "publishing", "published"}:
        raise HTTPException(409, "Esta publicação não pode receber uma nova arte agora.")
    if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(422, "Envie a arte exportada do Canva em PNG, JPG ou WEBP.")
    content = await file.read(15 * 1024 * 1024 + 1)
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(413, "A imagem deve ter no máximo 15 MB.")
    normalized = normalize_uploaded_art(content)
    item.art_path = await store_generated_art(normalized, "image/png")
    item.status = "awaiting_approval"
    item.approved_at = None
    item.error_message = ""
    item.meta_container_id = ""
    item.instagram_media_id = ""
    item.facebook_post_id = ""
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.post("/{content_id}/generate")
async def generate_content(content_id: int, db: Session = Depends(get_db)):
    item = _get(db, content_id)
    if item.layout != "story":
        raise HTTPException(409, "GeraÃ§Ã£o de arte por IA agora Ã© sÃ³ para Stories. Publicações de feed usam arte enviada pronta.")
    if item.status in {"publishing", "published"}:
        raise HTTPException(409, "Uma publicaÃ§Ã£o enviada nÃ£o pode ser regenerada.")
    item.status = "generating"
    item.error_message = ""
    db.commit()
    try:
        try:
            recent = await MetaMarketingService().instagram_media()
            captions = [str(post.get("caption", ""))[:600] for post in recent if post.get("caption")]
        except Exception:
            captions = []
        generated = await generate_copy_and_prompt(item.title, item.brief, captions)
        item.caption = generated["caption"]
        item.image_prompt = generated["image_prompt"]
        db.commit()
        item.art_path = await generate_art(item.image_prompt, generated["headline"])
        item.status = "awaiting_approval"
    except HTTPException as exc:
        item.status = "draft"
        item.error_message = str(exc.detail)
        db.commit()
        raise
    db.commit()
    db.refresh(item)
    return _serialize(item)


class CaptionRequest(BaseModel):
    caption_reference: str = Field(default="", max_length=4000)


@router.post("/{content_id}/generate-caption")
async def generate_content_caption(content_id: int, payload: CaptionRequest, db: Session = Depends(get_db)):
    """Só a legenda — usada quando a arte já existe (gerada aqui ou enviada
    pronta pela usuária) e não precisa passar pelo gerador de imagem de novo.
    Se caption_reference vier preenchida, a IA imita o tom/estrutura dela
    (trocando qualquer nome de empresa mencionado por "4Core")."""
    item = _get(db, content_id)
    if item.status in {"generating", "publishing", "published"}:
        raise HTTPException(409, "Esta publicação não pode ter a legenda gerada agora.")
    try:
        recent = await MetaMarketingService().instagram_media()
        captions = [str(post.get("caption", ""))[:600] for post in recent if post.get("caption")]
    except Exception:
        captions = []
    item.caption = await generate_caption_only(item.title, item.brief, payload.caption_reference, captions)
    item.error_message = ""
    if item.art_path:
        item.status = "awaiting_approval"
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.post("/{content_id}/approve")
def approve_content(content_id: int, payload: ApprovalRequest, db: Session = Depends(get_db)):
    item = _get(db, content_id)
    if not item.art_path or not item.caption:
        raise HTTPException(409, "Gere e revise a arte antes de aprovar.")
    if payload.scheduled_at is not None:
        item.scheduled_at = _utc(payload.scheduled_at)
    item.approved_at = datetime.now(timezone.utc)
    item.error_message = ""
    item.status = "scheduled" if item.scheduled_at else "approved"
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.post("/{content_id}/reject")
def reject_content(content_id: int, payload: RejectRequest, db: Session = Depends(get_db)):
    item = _get(db, content_id)
    if item.status == "published":
        raise HTTPException(409, "Uma publicaÃ§Ã£o enviada nÃ£o pode ser rejeitada.")
    item.status = "rejected"
    item.approved_at = None
    item.error_message = payload.reason.strip()
    db.commit()
    db.refresh(item)
    return _serialize(item)


@router.post("/{content_id}/publish")
async def publish_now(content_id: int, db: Session = Depends(get_db)):
    item = _get(db, content_id)
    return _serialize(await _publish(item, db))


@router.delete("/{content_id}", status_code=204)
def delete_content(content_id: int, db: Session = Depends(get_db)):
    item = _get(db, content_id)
    if item.status in {"publishing", "published"}:
        raise HTTPException(409, "PublicaÃ§Ãµes enviadas nÃ£o podem ser excluÃ­das.")
    db.delete(item)
    db.commit()
