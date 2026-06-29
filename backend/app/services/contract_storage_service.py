from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from app.core.config import settings

LOCAL_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "contracts"
MAX_CONTRACT_BYTES = 10 * 1024 * 1024
STORAGE_PREFIX = "supabase:"
_BUCKET_READY = False


@dataclass
class StoredContractFile:
    file_name: str
    file_path: str


def _supabase_configured() -> bool:
    return bool(settings.site_supabase_url and settings.site_supabase_service_role_key and settings.contract_storage_bucket)


def _headers(content_type: str | None = None) -> dict[str, str]:
    key = settings.site_supabase_service_role_key
    headers = {"apikey": key, "Authorization": f"Bearer {key}"}
    if content_type:
        headers["Content-Type"] = content_type
    return headers



def _bucket_url() -> str:
    base = settings.site_supabase_url.rstrip('/')
    bucket = settings.contract_storage_bucket.strip('/')
    return f"{base}/storage/v1/bucket/{bucket}"


def _ensure_bucket() -> None:
    global _BUCKET_READY
    if _BUCKET_READY or not _supabase_configured():
        return

    bucket = settings.contract_storage_bucket.strip('/')
    get_response = httpx.get(_bucket_url(), headers=_headers(), timeout=20.0)
    if get_response.status_code == 200:
        _BUCKET_READY = True
        return

    create_response = httpx.post(
        f"{settings.site_supabase_url.rstrip('/')}/storage/v1/bucket",
        headers={**_headers('application/json')},
        json={"id": bucket, "name": bucket, "public": False},
        timeout=20.0,
    )
    if create_response.status_code not in {200, 201, 409}:
        raise HTTPException(502, f'Falha ao preparar bucket de contratos no Supabase: {create_response.text[:200]}')
    _BUCKET_READY = True


def _object_url(object_path: str) -> str:
    base = settings.site_supabase_url.rstrip('/')
    bucket = settings.contract_storage_bucket.strip('/')
    return f"{base}/storage/v1/object/{bucket}/{object_path}"


def _validate_pdf(file: UploadFile) -> bytes:
    suffix = Path(file.filename or '').suffix.lower()
    if suffix != '.pdf':
        raise HTTPException(400, 'Envie apenas arquivos PDF.')
    content = file.file.read()
    if len(content) > MAX_CONTRACT_BYTES:
        raise HTTPException(400, 'Máximo de 10 MB.')
    if not content.startswith(b'%PDF'):
        raise HTTPException(400, 'O arquivo enviado não parece ser um PDF válido.')
    return content


def store_contract_file(file: UploadFile, client_name: str) -> StoredContractFile:
    content = _validate_pdf(file)
    original_name = file.filename or 'contrato.pdf'
    safe_client = ''.join(ch.lower() if ch.isalnum() else '-' for ch in client_name).strip('-') or 'cliente'
    object_path = f"{safe_client}/{uuid4().hex}.pdf"

    if _supabase_configured():
        _ensure_bucket()
        response = httpx.post(
            _object_url(object_path),
            headers={**_headers('application/pdf'), 'x-upsert': 'false'},
            content=content,
            timeout=30.0,
        )
        if response.status_code >= 400:
            raise HTTPException(502, f'Falha ao salvar contrato no Supabase: {response.text[:200]}')
        return StoredContractFile(file_name=original_name, file_path=f'{STORAGE_PREFIX}{object_path}')

    LOCAL_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    target = LOCAL_UPLOAD_DIR / f'{uuid4().hex}.pdf'
    target.write_bytes(content)
    return StoredContractFile(file_name=original_name, file_path=str(target))


def contract_file_response(file_path: str, file_name: str | None):
    if file_path.startswith(STORAGE_PREFIX):
        if not _supabase_configured():
            raise HTTPException(500, 'Supabase Storage não configurado.')
        object_path = file_path.removeprefix(STORAGE_PREFIX)
        response = httpx.get(_object_url(object_path), headers=_headers(), timeout=30.0)
        if response.status_code == 404:
            raise HTTPException(404, 'Arquivo não encontrado.')
        if response.status_code >= 400:
            raise HTTPException(502, f'Falha ao ler contrato no Supabase: {response.text[:200]}')
        headers = {'Content-Disposition': f'inline; filename="{file_name or "contrato.pdf"}"'}
        return Response(content=response.content, media_type='application/pdf', headers=headers)

    path = Path(file_path)
    if not path.exists():
        raise HTTPException(404, 'Arquivo não encontrado.')
    return FileResponse(path, filename=file_name, media_type='application/pdf')
