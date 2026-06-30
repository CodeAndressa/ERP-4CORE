from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.commercial import Lead, Proposal

router = APIRouter(prefix="/proposals", tags=["proposals"])

VALID_STATUSES = {"elaboracao", "enviada", "aprovada", "perdida"}


class ProposalCreate(BaseModel):
    client: str = Field(min_length=1, max_length=180)
    value_total: float | None = 0
    status: str = "elaboracao"
    next_action: str | None = None
    title: str | None = "Proposta comercial"
    lead_id: int | None = None
    notes: str | None = None


class ProposalUpdate(BaseModel):
    client: str | None = None
    value_total: float | None = None
    status: str | None = None
    next_action: str | None = None
    title: str | None = None
    lead_id: int | None = None
    notes: str | None = None


def _normalize(payload: dict) -> dict:
    status = payload.get("status")
    if status is not None and status not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Status de proposta invalido.")
    if payload.get("value_total") is None:
        payload["value_total"] = 0
    if payload.get("title") is None:
        payload["title"] = "Proposta comercial"
    return payload


def _next_code(db: Session) -> str:
    year = datetime.now().year
    count = db.query(Proposal).count() + 1
    return f"{count:03d}/{year}"


@router.get("")
def list_proposals(db: Session = Depends(get_db)):
    return db.query(Proposal).order_by(Proposal.created_at.desc()).all()


@router.post("")
def create_proposal(payload: ProposalCreate, db: Session = Depends(get_db)):
    data = _normalize(payload.model_dump())
    lead_id = data.get("lead_id")
    if lead_id and not db.get(Lead, lead_id):
        raise HTTPException(status_code=404, detail="Lead nao encontrado.")

    item = Proposal(**data, code=_next_code(db))
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.patch("/{proposal_id}")
def update_proposal(proposal_id: int, payload: ProposalUpdate, db: Session = Depends(get_db)):
    item = db.get(Proposal, proposal_id)
    if not item:
        raise HTTPException(status_code=404, detail="Proposta nao encontrada.")

    data = _normalize(payload.model_dump(exclude_unset=True))
    lead_id = data.get("lead_id")
    if lead_id and not db.get(Lead, lead_id):
        raise HTTPException(status_code=404, detail="Lead nao encontrado.")

    for key, value in data.items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item
