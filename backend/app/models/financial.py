from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.database.session import Base


class DunningLog(Base):
    """Controle de cobrança automática por e-mail. Não guarda a cobrança em si
    (isso vive no ASAAS) — só quando foi o último lembrete pra cada payment_id,
    pra respeitar o intervalo de reenvio. O ASAAS deixar de listar o pagamento
    como OVERDUE (pago/cancelado) já encerra os lembretes sozinho, sem precisar
    de uma flag aqui."""

    __tablename__ = "dunning_log"

    id = Column(Integer, primary_key=True, index=True)
    payment_id = Column(String(64), nullable=False, unique=True, index=True)
    send_count = Column(Integer, nullable=False, default=0)
    last_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
