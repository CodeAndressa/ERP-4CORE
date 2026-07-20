from sqlalchemy import Column, DateTime, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.database.session import Base


class MarketingContent(Base):
    __tablename__ = "marketing_content"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False)
    brief = Column(Text, nullable=False, default="")
    caption = Column(Text, nullable=False, default="")
    image_prompt = Column(Text, nullable=False, default="")
    channel = Column(String(30), nullable=False, default="instagram")
    format = Column(String(30), nullable=False, default="image")
    layout = Column(String(20), nullable=False, default="feed")
    status = Column(String(40), nullable=False, default="draft", index=True)
    scheduled_at = Column(DateTime(timezone=True), nullable=True, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    art_path = Column(String(500), nullable=False, default="")
    meta_container_id = Column(String(180), nullable=False, default="")
    instagram_media_id = Column(String(180), nullable=False, default="")
    facebook_post_id = Column(String(180), nullable=False, default="")
    error_message = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class InstagramMessage(Base):
    """Log local das DMs do Instagram — alimentado pelo webhook (inbound) e pelo envio
    de respostas pelo ERP (outbound). O Graph API é a fonte de verdade das conversas;
    esta tabela existe pra sobreviver a picos/atraso de entrega do webhook e pra dar
    contagem de "novas mensagens" sem precisar repolling constante."""

    __tablename__ = "instagram_messages"
    __table_args__ = (Index("ix_instagram_messages_mid_unique", "mid", unique=True),)

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String(64), nullable=False, index=True)
    sender_id = Column(String(64), nullable=False, default="")
    sender_username = Column(String(120), nullable=False, default="")
    direction = Column(String(10), nullable=False, default="inbound")
    text = Column(Text, nullable=False, default="")
    mid = Column(String(160), nullable=False, default="")
    seen_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class ExternalScheduledPost(Base):
    """Registro manual de posts agendados fora do ERP (ex.: composer do Meta
    Business Suite). A Meta não expõe via Graph API o que foi agendado pelo
    Business Suite para apps de terceiros — isso só existe pra dar visibilidade
    no Calendário, não dispara publicação nenhuma (é só um lembrete visual)."""

    __tablename__ = "external_scheduled_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False)
    channel = Column(String(30), nullable=False, default="instagram")
    scheduled_at = Column(DateTime(timezone=True), nullable=False, index=True)
    notes = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
