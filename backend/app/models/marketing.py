from sqlalchemy import Column, DateTime, Index, Integer, String, Text
from sqlalchemy.sql import func

from app.database.session import Base


class MarketingContent(Base):
    __tablename__ = "marketing_content"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(180), nullable=False)
    brief = Column(Text, nullable=False, default="")
    caption = Column(Text, nullable=False, default="")
    # Frase que foi desenhada na arte. Sem guardar isso o texto visível do story
    # ficava irrecuperável depois de gerar, e tanto o feedback quanto a próxima
    # versão precisam saber o que estava escrito lá.
    headline = Column(String(200), nullable=False, default="")
    image_prompt = Column(Text, nullable=False, default="")
    # O que foi pedido de ajuste nesta peça, acumulado. Vale só para ela: o
    # aprendizado que vale para todos os stories mora em MarketingArtFeedback.
    revision_notes = Column(Text, nullable=False, default="")
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


class MarketingArtFeedback(Base):
    """Feedback da equipe sobre uma arte de story já gerada. É a matéria-prima do
    aprendizado: cada registro entra no prompt das gerações seguintes, então um
    "não gostei do fundo azulado" passa a valer para todos os stories futuros, e
    não só para a peça em que foi escrito.

    aspects guarda as tags marcadas na tela (imagem, cores, texto, tom,
    legibilidade, marca) separadas por vírgula — é o que decide se a lição vai
    para o prompt da imagem ou para o prompt da redação."""

    __tablename__ = "marketing_art_feedback"

    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(Integer, nullable=False, index=True)
    sentiment = Column(String(10), nullable=False, default="disliked")
    aspects = Column(String(200), nullable=False, default="")
    notes = Column(Text, nullable=False, default="")
    headline = Column(String(200), nullable=False, default="")
    image_prompt = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)


class MarketingArtLesson(Base):
    """Destilação do feedback acumulado em regras curtas. Existe por dois motivos:
    o prompt não pode crescer para sempre conforme o histórico aumenta, e feedbacks
    contraditórios ("escurece mais" em março, "clareia o rosto" em junho) precisam
    ser resolvidos em uma regra só, em vez de despejar os dois no modelo.

    feedback_count é a marca d'água: quantos feedbacks já estavam destilados nesta
    versão. Serve para redestilar só quando entrou feedback novo o suficiente."""

    __tablename__ = "marketing_art_lesson"

    id = Column(Integer, primary_key=True, index=True)
    copy_rules = Column(Text, nullable=False, default="")
    image_rules = Column(Text, nullable=False, default="")
    feedback_count = Column(Integer, nullable=False, default=0)
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
