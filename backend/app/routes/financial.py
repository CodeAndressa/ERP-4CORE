import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.services import collections_service, email_service
from app.services.asaas_service import AsaasService, AsaasUnavailable
from app.services.manual_financial_service import manual_financial_snapshot

router = APIRouter(prefix='/financial', tags=['financial'])


@router.get('/overview')
async def financial_overview(days: int = Query(default=180, ge=1), refresh: bool = Query(default=False), start_date: str | None = Query(default=None), end_date: str | None = Query(default=None)):
    try:
        return await AsaasService(force_refresh=refresh).insights(days=days, start_date=start_date, end_date=end_date)
    except AsaasUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get('/transactions')
async def list_transactions(refresh: bool = Query(default=False)):
    try:
        return (await AsaasService(force_refresh=refresh).insights())['payments']
    except AsaasUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get('/categories')
def list_categories():
    return []


@router.get('/manual')
def manual_financial():
    return manual_financial_snapshot()


@router.get('/expenses')
def list_expenses():
    return manual_financial_snapshot()['expenses']


@router.get('/direct-sales')
async def list_direct_sales(refresh: bool = Query(default=False)):
    try:
        payments = (await AsaasService(force_refresh=refresh).payments()).get('data', [])
    except AsaasUnavailable:
        payments = []
    return manual_financial_snapshot(payments)['direct_sales']


@router.get('/charges')
async def list_charges(
    kind: Literal['all', 'one_off', 'subscription'] = Query(default='all'),
    status: Literal['all', 'received', 'confirmed', 'pending', 'overdue'] = Query(default='all'),
    search: str = Query(default='', max_length=120),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    refresh: bool = Query(default=False),
):
    try:
        return await AsaasService(force_refresh=refresh).charges(
            kind=kind,
            status_group=status,
            search=search,
            start_date=start_date,
            end_date=end_date,
            offset=offset,
            limit=limit,
        )
    except AsaasUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get('/charges/{payment_id}')
async def get_charge(payment_id: str, refresh: bool = Query(default=False)):
    try:
        return await AsaasService(force_refresh=refresh).charge_detail(payment_id)
    except AsaasUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


# ─── Cobrança automática por e-mail (vencidas há 3+ dias, a cada 2 dias) ─────

@router.get('/collections/logo.png')
async def collections_logo():
    """Público (sem auth) — clientes de e-mail buscam a imagem direto do
    servidor deles, sem anexar o token do ERP. Sem dado sensível, só a logo."""
    content = await collections_service.cropped_logo_bytes()
    return Response(content=content, media_type='image/png', headers={'Cache-Control': 'public, max-age=86400'})


@router.get('/collections/status')
def collections_status():
    return {
        "configured": email_service.is_configured(),
        "dry_run": settings.collections_dry_run,
        "start_days": collections_service.DUNNING_START_DAYS,
        "interval_days": collections_service.DUNNING_INTERVAL_DAYS,
    }


@router.get('/collections/payment-pattern/{customer_id}')
async def collections_payment_pattern(customer_id: str):
    """Sob demanda (chamado só quando a usuária expande um cliente) — evita
    bater no ASAAS pra todo mundo do histórico a cada carregamento da tela."""
    try:
        pattern = await collections_service.customer_payment_pattern(customer_id)
    except AsaasUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return pattern or {"sample_size": 0}


@router.get('/collections/history')
def collections_history(db: Session = Depends(get_db)):
    """Histórico de cobranças automáticas disparadas — inclui quando cada
    payment_id foi identificado como pago (resolved_at)."""
    return {"items": collections_service.history(db)}


@router.get('/collections/preview')
async def collections_preview(db: Session = Depends(get_db)):
    """Só leitura — nunca envia e-mail nem grava no controle de reenvio."""
    try:
        return await collections_service.run_dunning(db, dry_run=True, persist=False)
    except AsaasUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get('/collections/preview-email', response_class=HTMLResponse)
async def collections_preview_email():
    """Renderiza o HTML exato que seria enviado, com a primeira cobrança
    vencida elegível de verdade — só pra conferência visual, não envia nada."""
    try:
        charges = await collections_service.eligible_overdue_charges()
    except AsaasUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    if not charges:
        return HTMLResponse(
            "<p style='font-family:Arial,sans-serif;padding:40px;color:#5f5872;'>"
            "Nenhuma cobrança vencida elegível agora pra gerar um preview real.</p>"
        )
    _, html = collections_service._build_email(charges[0])
    return HTMLResponse(html)


@router.post('/collections/run')
async def collections_run(request: Request, db: Session = Depends(get_db)):
    """Chamado pelo cron diário via Authorization: Bearer <secret> — mesmo
    padrão do cron de marketing. Respeita COLLECTIONS_DRY_RUN pra decidir se
    envia de verdade ou só simula (ver server.py pro bypass de autenticação
    deste path específico)."""
    cron_secret = settings.collections_cron_secret
    authorization = request.headers.get('authorization', '')
    if not cron_secret or not secrets.compare_digest(authorization, f'Bearer {cron_secret}'):
        raise HTTPException(403, "Secret inválido.")
    try:
        return await collections_service.run_dunning(db, dry_run=settings.collections_dry_run)
    except AsaasUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
