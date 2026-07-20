from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.ai_service import AIService, AIUnavailable

router = APIRouter(prefix="/ai", tags=["ai"])


class AnalyzeRequest(BaseModel):
    scope: Literal["operacao", "financeiro", "comercial", "marketing", "site", "clientes", "propostas"] = "operacao"
    instructions: str = Field(default="", max_length=2000)


@router.post("/analyze")
async def analyze_operation(payload: AnalyzeRequest, db: Session = Depends(get_db)):
    try:
        return await AIService().analyze(payload.scope, payload.instructions, db)
    except AIUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Não foi possível concluir a análise com IA.") from exc


@router.get("/capabilities")
def capabilities():
    return {"scopes": ["operacao", "financeiro", "comercial", "marketing", "site", "clientes", "propostas"]}
