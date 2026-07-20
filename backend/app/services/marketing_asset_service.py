from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import HTTPException
from fastapi.responses import FileResponse, Response

from app.core.config import settings

LOCAL_ASSET_DIR = Path(__file__).resolve().parents[2] / "uploads" / "marketing"
STORAGE_PREFIX = "supabase:"
_BUCKET_READY = False


def _configured() -> bool:
    return bool(
        settings.site_supabase_url
        and settings.site_supabase_service_role_key
        and settings.marketing_assets_bucket
    )


def _headers(content_type: str | None = None) -> dict[str, str]:
    key = settings.site_supabase_service_role_key
    result = {"apikey": key, "Authorization": f"Bearer {key}"}
    if content_type:
        result["Content-Type"] = content_type
    return result


def _object_url(object_path: str) -> str:
    base = settings.site_supabase_url.rstrip("/")
    bucket = settings.marketing_assets_bucket.strip("/")
    return f"{base}/storage/v1/object/{bucket}/{object_path}"


async def _ensure_bucket(client: httpx.AsyncClient) -> None:
    global _BUCKET_READY
    if _BUCKET_READY or not _configured():
        return
    base = settings.site_supabase_url.rstrip("/")
    bucket = settings.marketing_assets_bucket.strip("/")
    response = await client.get(f"{base}/storage/v1/bucket/{bucket}", headers=_headers())
    if response.status_code == 200:
        _BUCKET_READY = True
        return
    response = await client.post(
        f"{base}/storage/v1/bucket",
        headers=_headers("application/json"),
        json={"id": bucket, "name": bucket, "public": False},
    )
    if response.status_code not in {200, 201, 409}:
        raise HTTPException(502, f"Falha ao preparar o Storage de marketing: {response.text[:200]}")
    _BUCKET_READY = True


async def store_generated_art(content: bytes, content_type: str = "image/png") -> str:
    extension = ".jpg" if content_type == "image/jpeg" else ".webp" if content_type == "image/webp" else ".png"
    object_path = f"generated/{uuid4().hex}{extension}"
    if _configured():
        async with httpx.AsyncClient(timeout=40.0) as client:
            await _ensure_bucket(client)
            response = await client.post(
                _object_url(object_path),
                headers={**_headers(content_type), "x-upsert": "false"},
                content=content,
            )
        if response.status_code >= 400:
            raise HTTPException(502, f"Falha ao salvar a arte no Storage: {response.text[:200]}")
        return f"{STORAGE_PREFIX}{object_path}"

    LOCAL_ASSET_DIR.mkdir(parents=True, exist_ok=True)
    target = LOCAL_ASSET_DIR / f"{uuid4().hex}{extension}"
    target.write_bytes(content)
    return str(target)


async def art_response(art_path: str):
    if not art_path:
        raise HTTPException(404, "Esta publicaÃ§Ã£o ainda nÃ£o possui arte.")
    if art_path.startswith(STORAGE_PREFIX):
        if not _configured():
            raise HTTPException(500, "Supabase Storage nÃ£o configurado.")
        object_path = art_path.removeprefix(STORAGE_PREFIX)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(_object_url(object_path), headers=_headers())
        if response.status_code == 404:
            raise HTTPException(404, "Arte nÃ£o encontrada.")
        if response.status_code >= 400:
            raise HTTPException(502, f"Falha ao ler a arte: {response.text[:200]}")
        return Response(content=response.content, media_type=response.headers.get("content-type", "image/png"))

    path = Path(art_path)
    if not path.exists():
        raise HTTPException(404, "Arte nÃ£o encontrada.")
    return FileResponse(path)


async def read_art_bytes(art_path: str) -> tuple[bytes, str]:
    if not art_path:
        raise HTTPException(404, "A publicação ainda não possui arte.")
    if art_path.startswith(STORAGE_PREFIX):
        if not _configured():
            raise HTTPException(500, "Supabase Storage não configurado.")
        object_path = art_path.removeprefix(STORAGE_PREFIX)
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(_object_url(object_path), headers=_headers())
        if response.status_code == 404:
            raise HTTPException(404, "Arte não encontrada.")
        if response.status_code >= 400:
            raise HTTPException(502, f"Falha ao ler a arte: {response.text[:200]}")
        return response.content, response.headers.get("content-type", "image/png")

    path = Path(art_path)
    if not path.exists():
        raise HTTPException(404, "Arte não encontrada.")
    extension = path.suffix.lower()
    content_type = "image/jpeg" if extension in {".jpg", ".jpeg"} else "image/webp" if extension == ".webp" else "image/png"
    return path.read_bytes(), content_type


async def signed_art_url(art_path: str, expires_in: int = 3600) -> str:
    """Gera uma URL curta para a Meta baixar a arte somente durante a publicaÃ§Ã£o."""
    if not art_path.startswith(STORAGE_PREFIX) or not _configured():
        raise HTTPException(
            409,
            "Para publicar na Meta, configure o Supabase Storage; arquivos locais nÃ£o possuem URL pÃºblica segura.",
        )
    object_path = art_path.removeprefix(STORAGE_PREFIX)
    base = settings.site_supabase_url.rstrip("/")
    bucket = settings.marketing_assets_bucket.strip("/")
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.post(
            f"{base}/storage/v1/object/sign/{bucket}/{object_path}",
            headers=_headers("application/json"),
            json={"expiresIn": expires_in},
        )
    if response.status_code >= 400:
        raise HTTPException(502, f"Falha ao liberar a arte para publicaÃ§Ã£o: {response.text[:200]}")
    signed = response.json().get("signedURL") or response.json().get("signedUrl")
    if not signed:
        raise HTTPException(502, "O Storage nÃ£o retornou a URL temporÃ¡ria da arte.")
    if signed.startswith("http"):
        return signed
    if not signed.startswith("/storage/v1"):
        signed = f"/storage/v1{signed}" if signed.startswith("/") else f"/storage/v1/{signed}"
    return f"{base}{signed}"
