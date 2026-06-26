from fastapi import APIRouter, HTTPException

from app.services.asaas_service import AsaasService, AsaasUnavailable

router = APIRouter(prefix="/financial", tags=["financial"])


@router.get("/overview")
async def financial_overview():
    try:
        return await AsaasService().insights()
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