from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db

router = APIRouter(prefix="/proposals", tags=["proposals"])


@router.get("")
def list_proposals(db: Session = Depends(get_db)):
    return [{"id": 1, "title": "Proposta inicial", "status": "enviada", "value_total": 18000}]
