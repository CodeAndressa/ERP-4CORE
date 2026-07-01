from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.core.config import settings
from app.services.meta_marketing_service import MetaMarketingService, mask_token

router = APIRouter(prefix="/marketing", tags=["marketing"])


@router.get("/posts")
def list_posts(db: Session = Depends(get_db)):
    return [{"id": 1, "title": "Post inicial", "channel": "Instagram", "status": "agendado"}]


@router.get("/meta/status")
def meta_status():
    return {
        "configured": bool(settings.meta_app_id and settings.meta_app_secret),
        "app_id": settings.meta_app_id,
        "redirect_uri": settings.meta_redirect_uri,
        "page_connected": bool(settings.meta_page_id and (settings.meta_page_access_token or settings.meta_access_token)),
        "page_id": settings.meta_page_id,
        "token": mask_token(settings.meta_page_access_token or settings.meta_access_token),
        "graph_version": settings.meta_graph_version,
        "required_env": [
            "META_APP_ID",
            "META_APP_SECRET",
            "META_REDIRECT_URI",
            "META_PAGE_ID",
            "META_PAGE_ACCESS_TOKEN",
        ],
    }


@router.get("/meta/auth-url")
def meta_auth_url(redirect_uri: str | None = Query(default=None)):
    return {"url": MetaMarketingService().auth_url(redirect_uri)}


@router.get("/meta/callback")
async def meta_callback(code: str, redirect_uri: str | None = Query(default=None)):
    return await MetaMarketingService().exchange_code_and_pages(code, redirect_uri)


@router.get("/meta/pages")
async def meta_pages(user_access_token: str):
    return {"pages": await MetaMarketingService().list_pages(user_access_token)}


@router.get("/meta/insights")
async def meta_insights():
    return await MetaMarketingService().page_insights()