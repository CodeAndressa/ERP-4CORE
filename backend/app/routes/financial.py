from typing import Literal

from fastapi import APIRouter, HTTPException, Query

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
