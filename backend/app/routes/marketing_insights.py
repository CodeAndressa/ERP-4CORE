from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.marketing_insights_service import build_insights, schedule_coverage

router = APIRouter(prefix="/marketing", tags=["marketing-insights"])


@router.get("/schedule-coverage")
def marketing_schedule_coverage(db: Session = Depends(get_db)):
    """Até quando as redes estão cobertas por agendamento. Consultada tanto pela área
    de Marketing quanto pela Visão geral, por isso mora fora das duas."""
    return schedule_coverage(db)


@router.get("/insights")
async def marketing_insights(db: Session = Depends(get_db)):
    return await build_insights(db)
