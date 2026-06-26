from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db

router = APIRouter(prefix="/leads", tags=["leads"])


@router.get("")
def list_leads(db: Session = Depends(get_db)):
    return [{"id": 1, "name": "Maria", "status": "novo", "origin": "Instagram", "value_potential": 15000}]
