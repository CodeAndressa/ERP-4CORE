import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.settings import CompanySettings

router = APIRouter(prefix="/settings", tags=["settings"])
logger = logging.getLogger(__name__)

DEFAULTS = {
    "company_name": "4Core Consultoria Estratégica",
    "cnpj": "",
    "financial_email": "",
    "phone": "",
}


class CompanySettingsIn(BaseModel):
    company_name: str
    cnpj: str | None = None
    financial_email: str | None = None
    phone: str | None = None


def _get_or_create(db: Session) -> CompanySettings:
    row = db.get(CompanySettings, 1)
    if row is None:
        row = CompanySettings(id=1, **DEFAULTS)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@router.get("/company")
def get_company_settings(db: Session = Depends(get_db)):
    try:
        return _get_or_create(db)
    except SQLAlchemyError as exc:
        logger.exception("Failed to load company settings")
        raise HTTPException(status_code=503, detail="Nao foi possivel carregar os dados da empresa.") from exc


@router.put("/company")
def update_company_settings(payload: CompanySettingsIn, db: Session = Depends(get_db)):
    try:
        row = _get_or_create(db)
        for key, value in payload.model_dump().items():
            setattr(row, key, value)
        db.commit()
        db.refresh(row)
        return row
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Failed to save company settings")
        raise HTTPException(status_code=503, detail="Nao foi possivel salvar os dados da empresa.") from exc
