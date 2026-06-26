from sqlalchemy import Column, Date, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func
from app.database.session import Base
class Contract(Base):
    __tablename__="contracts"; id=Column(Integer,primary_key=True); client_name=Column(String(180),nullable=False); title=Column(String(180),nullable=False); status=Column(String(30),default="ativo"); value=Column(Float); start_date=Column(Date); end_date=Column(Date); notes=Column(Text); file_name=Column(String(255)); file_path=Column(String(500)); created_at=Column(DateTime(timezone=True),server_default=func.now())
class Order(Base):
    __tablename__="orders"; id=Column(Integer,primary_key=True); client_name=Column(String(180),nullable=False); contract_id=Column(Integer); description=Column(Text,nullable=False); status=Column(String(30),default="fechado"); value=Column(Float,nullable=False); closed_at=Column(Date); delivery_date=Column(Date); notes=Column(Text); created_at=Column(DateTime(timezone=True),server_default=func.now())