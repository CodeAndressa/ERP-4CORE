from __future__ import annotations

from typing import Any
from urllib.parse import urlencode

import httpx
from fastapi import HTTPException

from app.core.config import settings


META_SCOPES = [
    "pages_show_list",
    "pages_read_engagement",
    "pages_read_user_content",
]


class MetaMarketingService:
    def __init__(self) -> None:
        self.graph_version = settings.meta_graph_version or "v20.0"
        self.base_url = f"https://graph.facebook.com/{self.graph_version}"

    def _require_app(self) -> None:
        if not settings.meta_app_id or not settings.meta_app_secret:
            raise HTTPException(400, "Configure META_APP_ID e META_APP_SECRET no backend.")

    def auth_url(self, redirect_uri: str | None = None) -> str:
        self._require_app()
        target_redirect = redirect_uri or settings.meta_redirect_uri
        if not target_redirect:
            raise HTTPException(400, "Informe redirect_uri ou configure META_REDIRECT_URI.")
        params = {
            "client_id": settings.meta_app_id,
            "redirect_uri": target_redirect,
            "scope": ",".join(META_SCOPES),
            "response_type": "code",
        }
        return f"https://www.facebook.com/{self.graph_version}/dialog/oauth?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str | None = None) -> dict[str, Any]:
        self._require_app()
        target_redirect = redirect_uri or settings.meta_redirect_uri
        if not target_redirect:
            raise HTTPException(400, "Informe redirect_uri ou configure META_REDIRECT_URI.")
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{self.base_url}/oauth/access_token",
                params={
                    "client_id": settings.meta_app_id,
                    "client_secret": settings.meta_app_secret,
                    "redirect_uri": target_redirect,
                    "code": code,
                },
            )
        if response.status_code >= 400:
            raise HTTPException(response.status_code, response.text)
        return response.json()

    async def list_pages(self, user_access_token: str) -> list[dict[str, Any]]:
        if not user_access_token:
            raise HTTPException(400, "Token de usuário ausente.")
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{self.base_url}/me/accounts",
                params={
                    "access_token": user_access_token,
                    "fields": "id,name,category,access_token,tasks,instagram_business_account{id,username}",
                },
            )
        if response.status_code >= 400:
            raise HTTPException(response.status_code, response.text)
        return response.json().get("data", [])

    async def exchange_code_and_pages(self, code: str, redirect_uri: str | None = None) -> dict[str, Any]:
        token_payload = await self.exchange_code(code, redirect_uri)
        user_token = token_payload.get("access_token", "")
        pages = await self.list_pages(user_token)
        return {"user_access_token": user_token, "pages": pages}

    async def page_insights(self, page_id: str | None = None, page_access_token: str | None = None) -> dict[str, Any]:
        target_page_id = page_id or settings.meta_page_id
        token = page_access_token or settings.meta_page_access_token or settings.meta_access_token
        if not target_page_id or not token:
            raise HTTPException(400, "Configure META_PAGE_ID e META_PAGE_ACCESS_TOKEN.")
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                f"{self.base_url}/{target_page_id}/insights",
                params={
                    "access_token": token,
                    "metric": "page_impressions,page_post_engagements,page_fans",
                    "period": "day",
                },
            )
        if response.status_code >= 400:
            raise HTTPException(response.status_code, response.text)
        return response.json()


def mask_token(token: str) -> str:
    if not token:
        return ""
    if len(token) <= 12:
        return "***"
    return f"{token[:6]}...{token[-4:]}"