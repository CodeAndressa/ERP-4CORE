from fastapi import APIRouter, HTTPException, Query

from app.services.asaas_service import AsaasService, AsaasUnavailable
from app.services.manual_financial_service import manual_financial_snapshot

router = APIRouter(prefix="/financial", tags=["financial"])


@router.get("/overview")
async def financial_overview(days: int = Query(default=180, ge=1)):
    try:
        return await AsaasService().insights(days=days)
    except AsaasUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/transactions")
async def list_transactions():
    try:
        return (await AsaasService().insights())["payments"]
    except AsaasUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/categories")
def list_categories():
    return []

@router.get("/manual")
def manual_financial():
    return manual_financial_snapshot()


@router.get("/expenses")
def list_expenses():
    return manual_financial_snapshot()["expenses"]


@router.get("/direct-sales")
async def list_direct_sales():
    try:
        payments = (await AsaasService().payments()).get("data", [])
    except AsaasUnavailable:
        payments = []
    return manual_financial_snapshot(payments)["direct_sales"]