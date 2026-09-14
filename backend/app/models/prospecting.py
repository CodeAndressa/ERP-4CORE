import uuid

from sqlalchemy import Boolean, Column, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from sqlalchemy.types import Uuid

from app.database.session import Base


class ProspectingCampaign(Base):
    __tablename__ = "prospecting_campaigns"

    id = Column(Integer, primary_key=True)
    name = Column(String(160), nullable=False, default="Empresas novas 4Core")
    status = Column(String(24), nullable=False, default="active")
    seller_ids = Column(Text, nullable=False, default="[]")
    daily_per_seller = Column(Integer, nullable=False, default=5)
    opened_min_months = Column(Integer, nullable=False, default=3)
    opened_max_months = Column(Integer, nullable=False, default=24)
    priority_min_months = Column(Integer, nullable=False, default=6)
    priority_max_months = Column(Integer, nullable=False, default=18)
    monthly_budget_cents = Column(Integer, nullable=False, default=5000)
    spent_month = Column(String(7), nullable=False, default="")
    spent_cents = Column(Integer, nullable=False, default=0)
    last_discovery_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Prospect(Base):
    __tablename__ = "prospects"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(Integer, ForeignKey("prospecting_campaigns.id"), index=True)
    cnpj = Column(String(14), nullable=False, unique=True, index=True)
    company_name = Column(String(220), nullable=False)
    trade_name = Column(String(220))
    cnae_code = Column(String(12), index=True)
    cnae_description = Column(String(255))
    segment = Column(String(80), index=True)
    opened_at = Column(Date)
    company_size = Column(String(80))
    capital_social = Column(Float, default=0)
    city = Column(String(120))
    state = Column(String(2))
    address = Column(String(320))
    email = Column(String(180), index=True)
    phone = Column(String(60), index=True)
    website = Column(String(255))
    contact_name = Column(String(180))
    contact_role = Column(String(120))
    employee_confidence = Column(String(20), nullable=False, default="medium")
    employee_evidence = Column(Text, nullable=False, default="[]")
    score = Column(Integer, nullable=False, default=0, index=True)
    score_reasons = Column(Text, nullable=False, default="[]")
    status = Column(String(30), nullable=False, default="new", index=True)
    contact_permission = Column(Boolean, nullable=False, default=False)
    contact_permission_at = Column(DateTime(timezone=True))
    contact_permission_source = Column(String(120))
    assigned_to_id = Column(Integer, ForeignKey("users.id"), index=True)
    assigned_to_name = Column(String(120))
    assigned_at = Column(DateTime(timezone=True))
    source = Column(String(80), nullable=False, default="Casa dos Dados")
    source_url = Column(String(500))
    source_collected_at = Column(DateTime(timezone=True), server_default=func.now())
    last_contact_at = Column(DateTime(timezone=True))
    next_action_at = Column(DateTime(timezone=True))
    follow_up_step = Column(Integer, nullable=False, default=0)
    converted_lead_id = Column(Uuid(as_uuid=False), ForeignKey("leads.id"), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class ProspectingActivity(Base):
    __tablename__ = "prospecting_activities"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    prospect_id = Column(Uuid(as_uuid=False), ForeignKey("prospects.id"), nullable=False, index=True)
    kind = Column(String(40), nullable=False, index=True)
    channel = Column(String(24), nullable=False, default="system")
    direction = Column(String(16), nullable=False, default="internal")
    subject = Column(String(255))
    body = Column(Text)
    message_id = Column(String(255), unique=True, index=True)
    thread_key = Column(String(255), index=True)
    status = Column(String(24), nullable=False, default="completed")
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_by_name = Column(String(120))
    occurred_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ProspectingSuppression(Base):
    __tablename__ = "prospecting_suppressions"

    id = Column(Uuid(as_uuid=False), primary_key=True, default=lambda: str(uuid.uuid4()))
    cnpj = Column(String(14), index=True)
    email = Column(String(180), index=True)
    phone = Column(String(60), index=True)
    reason = Column(String(255), nullable=False, default="Solicitou não receber contatos")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
