from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.database.session import Base


class CompanySettings(Base):
    __tablename__ = "company_settings"

    id = Column(Integer, primary_key=True)
    company_name = Column(String(180), nullable=False, default="4Core Consultoria Estratégica")
    cnpj = Column(String(30))
    financial_email = Column(String(180))
    phone = Column(String(60))
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
