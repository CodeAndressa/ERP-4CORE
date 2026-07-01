"""Armazenamento persistente de tokens OAuth.
Prioridade: Supabase (produção) → arquivo local (desenvolvimento) → settings .env.
"""
from __future__ import annotations

import json
import os

import httpx

_FILE_PATH = os.path.join(os.path.dirname(__file__), '..', '..', '.meta_tokens.json')
_TABLE = "app_settings"


def _supabase_info() -> tuple[str, dict] | tuple[None, None]:
    from app.core.config import settings
    url = getattr(settings, 'site_supabase_url', '')
    key = getattr(settings, 'site_supabase_service_role_key', '')
    if not url or not key:
        return None, None
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    return url, headers


# ─── Async (usa Supabase quando disponível) ───────────────────────────────────

async def aget(key: str, default: str = '') -> str:
    url, headers = _supabase_info()
    if url:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(
                    f"{url}/rest/v1/{_TABLE}",
                    params={"key": f"eq.{key}", "select": "value"},
                    headers=headers,
                )
            if r.status_code == 200 and r.json():
                return r.json()[0].get("value", default)
        except Exception:
            pass
    return _file_get(key, default)


async def asave(data: dict) -> None:
    url, headers = _supabase_info()
    if url:
        rows = [{"key": k, "value": str(v)} for k, v in data.items()]
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                await client.post(f"{url}/rest/v1/{_TABLE}", json=rows, headers=headers)
        except Exception:
            pass
    _file_save(data)


# ─── Sync fallback (lê arquivo local — usado no _page_token síncrono) ─────────

def get(key: str, default: str = '') -> str:
    return _file_get(key, default)


def save(data: dict) -> None:
    _file_save(data)


# ─── Arquivo local ────────────────────────────────────────────────────────────

def _file_load() -> dict:
    try:
        with open(_FILE_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _file_get(key: str, default: str = '') -> str:
    return _file_load().get(key, default)


def _file_save(data: dict) -> None:
    try:
        existing = _file_load()
        existing.update(data)
        with open(_FILE_PATH, 'w', encoding='utf-8') as f:
            json.dump(existing, f, indent=2, ensure_ascii=False)
    except Exception:
        pass
