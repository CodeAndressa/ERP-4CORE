from sqlalchemy import CheckConstraint, Column, DateTime, Float, Integer, String, Text
from sqlalchemy.sql import func

from app.database.session import Base


class DunningLog(Base):
    """Controle e histórico da cobrança automática por e-mail. Não guarda a
    cobrança em si (isso vive no ASAAS) — só o ritmo de lembretes por
    payment_id e, quando o ASAAS deixa de listar como OVERDUE, o momento em
    que isso foi detectado (`resolved_at`) — é assim que a tela de
    acompanhamento sabe "identificamos o pagamento em tal dia"."""

    __tablename__ = "dunning_log"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(String(64), nullable=False, unique=True, index=True)
    customer = Column(String(200), nullable=False, default="")
    customer_id = Column(String(64), nullable=False, default="")
    due_date = Column(String(20), nullable=False, default="")
    value = Column(Float, nullable=False, default=0)
    send_count = Column(Integer, nullable=False, default=0)
    last_sent_at = Column(DateTime(timezone=True), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolved_status = Column(String(40), nullable=False, default="")
    resolved_payment_date = Column(String(20), nullable=False, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class DunningEvent(Base):
    """Um registro por disparo real de lembrete — DunningLog só guarda o
    resumo (contador + último envio). Esta tabela existe pra tela de
    histórico poder expandir um cliente e ver cada disparo individual."""

    __tablename__ = "dunning_event"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(String(64), nullable=False, index=True)
    sent_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    days_overdue = Column(Integer, nullable=False, default=0)


class TopdataAccessControl(Base):
    """Estado da ação manual feita na Topdata por cliente.

    O ASAAS informa quando a dívida foi paga, mas não sabe se a equipe chegou a
    bloquear o acesso na Topdata. Este registro fecha essa lacuna: guarda quais
    cobranças motivaram o bloqueio e mantém o alerta de desbloqueio ativo até a
    equipe confirmar que executou a ação manual.
    """

    __tablename__ = "topdata_access_control"
    __table_args__ = (
        CheckConstraint("status IN ('blocked', 'unblocked')", name="ck_topdata_access_control_status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    customer_id = Column(String(64), nullable=False, unique=True, index=True)
    customer = Column(String(200), nullable=False, default="")
    status = Column(String(20), nullable=False, default="blocked", index=True)
    charge_ids = Column(Text, nullable=False, default="[]")
    blocked_at = Column(DateTime(timezone=True), nullable=True)
    unblocked_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
