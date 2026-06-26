from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


@router.get("")
def list_knowledge_entries(db: Session = Depends(get_db)):
    return [{"id": 1, "category": "produtos", "title": "Descrição da 4Core"}]
