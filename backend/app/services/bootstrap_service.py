from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User


def ensure_bootstrap_admin(db: Session) -> None:
    if db.query(User).count() > 0:
        return
    if not settings.bootstrap_admin_email or not settings.bootstrap_admin_password:
        return

    db.add(
        User(
            full_name=settings.bootstrap_admin_name or "Admin 4Core",
            email=settings.bootstrap_admin_email,
            hashed_password=get_password_hash(settings.bootstrap_admin_password),
        )
    )
    db.commit()
