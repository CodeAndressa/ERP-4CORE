from app.database.session import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash


def seed():
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add(
                User(
                    full_name="Sócia 4Core",
                    email="socia@4core.com.br",
                    hashed_password=get_password_hash("123456"),
                )
            )
            db.commit()
    finally:
        db.close()
