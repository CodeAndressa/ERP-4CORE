from fastapi import APIRouter, HTTPException
from app.services.asaas_service import AsaasService, AsaasUnavailable

router = APIRouter(prefix="/clients", tags=["clients"])

@router.get("")
async def list_clients():
    try:
        return {"source": "asaas", "data": await AsaasService().customers()}
    except AsaasUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc