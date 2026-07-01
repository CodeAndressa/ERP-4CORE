import uuid

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from sqlalchemy.types import Uuid

from app.database.session import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(180), nullable=False)
    company = Column(String(180))
    email = Column(String(180))
    phone = Column(String(60))
    status = Column(String(30), nullable=False, default="novo")
    stage = Column(String(30), nullable=False, default="novo")
    origin = Column(String(80), default="Manual")
    value_potential = Column(Float, default=0)
    notes = Column(Text)
    next_action = Column(String(255))
    last_contact_date = Column(Date)
    next_contact_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True)
    lead_id = Column(Uuid(as_uuid=False), ForeignKey("leads.id"), nullable=True, index=True)
    code = Column(String(40), nullable=False, unique=True)
    title = Column(String(180), nullable=False, default="Proposta comercial")
    client = Column(String(180), nullable=False)
    value_total = Column(Float, default=0)
    status = Column(String(30), nullable=False, default="elaboracao")
    next_action = Column(String(255))
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
