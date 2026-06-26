from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database.session import get_db

router = APIRouter(prefix="/marketing", tags=["marketing"])


@router.get("/posts")
def list_posts(db: Session = Depends(get_db)):
    return [{"id": 1, "title": "Post inicial", "channel": "Instagram", "status": "agendado"}]
