from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.commercial import Lead, Proposal

router = APIRouter(prefix="/leads", tags=["leads"])

VALID_STATUSES = {"novo", "contato", "qualificado", "perdido"}
VALID_STAGES = {"novo", "contato", "qualificado", "proposta", "negociacao", "fechado", "perdido"}


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=180)
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    status: str = "novo"
    stage: str = "novo"
    origin: str | None = "Manual"
    value_potential: float | None = 0
    notes: str | None = None
    next_action: str | None = None
    last_contact_date: date | None = None
    next_contact_date: date | None = None


class LeadUpdate(BaseModel):
    name: str | None = None
    company: str | None = None
    email: str | None = None
    phone: str | None = None
    status: str | None = None
    stage: str | None = None
    origin: str | None = None
    value_potential: float | None = None
    notes: str | None = None
    next_action: str | None = None
    last_contact_date: date | None = None
    next_contact_date: date | None = None


def _normalize(payload: dict) -> dict:
    status = payload.get("status")
    stage = payload.get("stage")
    if status is not None and status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Status de lead invalido.")
    if stage is not None and stage not in VALID_STAGES:
        raise HTTPException(status_code=422, detail="Etapa de pipeline invalida.")
    if payload.get("origin") is None:
        payload["origin"] = "Manual"
    if payload.get("value_potential") is None:
        payload["value_potential"] = 0
    return payload


def _database_unavailable(message: str, exc: SQLAlchemyError) -> HTTPException:
    return HTTPException(status_code=503, detail=message)


@router.get("")
def list_leads(soft: bool = Query(default=False), db: Session = Depends(get_db)):
    try:
        return db.query(Lead).order_by(Lead.created_at.desc()).all()
    except SQLAlchemyError as exc:
        if soft:
            return []
        raise _database_unavailable("Banco de leads indisponivel ou sem schema aplicado.", exc) from exc


@router.post("")
def create_lead(payload: LeadCreate, db: Session = Depends(get_db)):
    data = _normalize(payload.model_dump())
    item = Lead(**data)
    try:
        db.add(item)
        db.commit()
        db.refresh(item)
        return item
    except SQLAlchemyError as exc:
        db.rollback()
        raise _database_unavailable("Nao foi possivel salvar o lead. Verifique DATABASE_URL e schema do banco em producao.", exc) from exc


@router.patch("/{lead_id}")
def update_lead(lead_id: str, payload: LeadUpdate, db: Session = Depends(get_db)):
    try:
        item = db.get(Lead, lead_id)
        if not item:
            raise HTTPException(status_code=404, detail="Lead nao encontrado.")

        data = _normalize(payload.model_dump(exclude_unset=True))
        for key, value in data.items():
            setattr(item, key, value)
        db.commit()
        db.refresh(item)
        return item
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise _database_unavailable("Nao foi possivel atualizar o lead. Verifique o banco em producao.", exc) from exc


@router.delete("/{lead_id}")
def delete_lead(lead_id: str, db: Session = Depends(get_db)):
    try:
        item = db.get(Lead, lead_id)
        if not item:
            raise HTTPException(status_code=404, detail="Lead nao encontrado.")
        db.query(Proposal).filter(Proposal.lead_id == lead_id).update({Proposal.lead_id: None})
        db.delete(item)
        db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise _database_unavailable("Nao foi possivel excluir o lead. Verifique o banco em producao.", exc) from exc
