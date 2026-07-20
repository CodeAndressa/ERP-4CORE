"""Cobrança automática por e-mail para cobranças ASAAS vencidas.

Regra: a partir de 3 dias de atraso, reenvia a cada 2 dias. Para sozinho
quando o ASAAS deixa de listar o pagamento como OVERDUE (foi pago, cancelado
ou estornado) — não precisa de flag de "parar", é só reconsultar o ASAAS a
cada rodada e comparar com quem já recebeu (ver DunningLog).
"""
from __future__ import annotations

import io
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from PIL import Image
from sqlalchemy.orm import Session

from app.models.financial import DunningEvent, DunningLog
from app.services import email_service
from app.services.asaas_service import AsaasService

DUNNING_START_DAYS = 3
DUNNING_INTERVAL_DAYS = 2

_LOGO_CACHE: bytes | None = None


MONTHS_PT = ["", "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]


def _competencia(due_date: str | None) -> str:
    """A ASAAS não tem um campo de competência — deriva do mês/ano do
    vencimento original, que é a convenção mais comum pra mensalidade/serviço."""
    if not due_date or len(due_date) < 7:
        return ""
    try:
        year, month = due_date[:4], int(due_date[5:7])
        return f"{MONTHS_PT[month]}/{year}"
    except (ValueError, IndexError):
        return ""


def _due_for_send(log: DunningLog | None) -> bool:
    if log is None or log.last_sent_at is None:
        return True
    last = log.last_sent_at
    if last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - last) >= timedelta(days=DUNNING_INTERVAL_DAYS)


BRAND_LOGO_URL = (
    "https://erp-4-core.vercel.app/"
    "Logo%20com%20Tipografia%204Core%20-%20Principal%20Transparente.png"
)
# URL pública e estável usada dentro do e-mail — clientes de e-mail (Gmail etc.)
# buscam a imagem direto do servidor, precisa ser um endereço real de internet.
EMAIL_LOGO_URL = "https://4core-backend.vercel.app/financial/collections/logo.png"


async def cropped_logo_bytes() -> bytes:
    """O arquivo original é um canvas 3000x3000 com bastante espaço transparente
    ao redor do desenho — sem recortar, a logo aparece minúscula em qualquer
    altura fixa de e-mail. Recorta pro conteúdo visível e cacheia em memória."""
    global _LOGO_CACHE
    if _LOGO_CACHE is not None:
        return _LOGO_CACHE
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.get(BRAND_LOGO_URL)
    response.raise_for_status()
    image = Image.open(io.BytesIO(response.content)).convert("RGBA")
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    _LOGO_CACHE = output.getvalue()
    return _LOGO_CACHE


def _build_email(charge: dict[str, Any]) -> tuple[str, str]:
    link = charge.get("invoice_url") or charge.get("bank_slip_url") or ""
    value = f"R$ {charge['value']:.2f}".replace(".", ",")
    days = charge["days_overdue"]
    due_date = charge.get("due_date", "")
    company_name = charge["customer"] or "cliente"
    subject = "Quite sua dívida com a 4Core e mantenha o controle"

    cta_button = f"""
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px auto 4px;">
          <tr>
            <td style="border-radius: 12px; background: #2b165c;">
              <a href="{link}" style="display:inline-block; padding: 14px 32px; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 12px;">
                Acessar link de pagamento
              </a>
            </td>
          </tr>
        </table>
    """ if link else ""

    html = f"""<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#f8f7fb;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8f7fb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%; background:#ffffff; border-radius:20px; border:1px solid rgba(43,22,92,0.13); overflow:hidden; font-family: Arial, Helvetica, sans-serif;">

          <tr>
            <td style="padding: 40px 36px 32px; border-bottom:1px solid rgba(43,22,92,0.13); text-align:center;" align="center">
              <img src="{EMAIL_LOGO_URL}" alt="4Core" height="96" style="display:inline-block; height:96px; width:auto;" />
            </td>
          </tr>

          <tr>
            <td style="padding: 32px 36px 8px;">
              <p style="margin:0 0 16px; font-size:15px; line-height:1.6; color:#151127;">Olá, {company_name}!</p>
              <p style="margin:0 0 20px; font-size:14px; line-height:1.7; color:#5f5872;">
                Identificamos que o pagamento abaixo está em aberto há <strong style="color:#be123c;">{days} {'dia' if days == 1 else 'dias'}</strong>.
                Se já foi feito, pode desconsiderar este lembrete automático.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 0 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f2f8; border-radius:16px;">
                <tr>
                  <td style="padding: 20px 24px;">
                    <p style="margin:0 0 4px; font-size:11px; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#9189a3;">Valor em aberto</p>
                    <p style="margin:0 0 14px; font-size:28px; font-weight:700; color:#151127;">{value}</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; color:#5f5872;">
                      <tr><td style="padding:3px 0;">Descrição</td><td style="padding:3px 0; text-align:right; font-weight:600; color:#151127;">{charge['description']}</td></tr>
                      <tr><td style="padding:3px 0;">Vencimento original</td><td style="padding:3px 0; text-align:right; font-weight:600; color:#151127;">{due_date}</td></tr>
                      <tr><td style="padding:3px 0;">Dias em atraso</td><td style="padding:3px 0; text-align:right; font-weight:600; color:#be123c;">{days}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding: 4px 36px 8px; text-align:center;">
              {cta_button}
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 36px 32px;">
              <p style="margin:0 0 2px; font-size:14px; color:#151127;">Atenciosamente,</p>
              <p style="margin:0 0 20px; font-size:14px; font-weight:700; color:#151127;">Equipe Financeiro 4Core</p>
              <p style="margin:0; font-size:11px; line-height:1.6; color:#9189a3; border-top:1px solid rgba(43,22,92,0.13); padding-top:16px;">
                Mensagem automática do sistema de cobrança da 4Core Consultoria Estratégica.
                Em caso de dúvidas, entre em contato com o e-mail
                <a href="mailto:4coreconsultoria@gmail.com" style="color:#2b165c;">4coreconsultoria@gmail.com</a>
                ou acesse o suporte pelo site <a href="http://4core.site/" style="color:#2b165c;">4core.site</a>.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""
    return subject, html


async def _all_overdue_charges() -> list[dict[str, Any]]:
    result = await AsaasService().charges(status_group="overdue", limit=500)
    return result["data"]


async def eligible_overdue_charges() -> list[dict[str, Any]]:
    charges = await _all_overdue_charges()
    return [
        item for item in charges
        if item.get("days_overdue", 0) >= DUNNING_START_DAYS and item.get("customer_email")
    ]


async def customer_payment_pattern(customer_id: str) -> dict[str, Any] | None:
    """Olha o histórico de pagamentos já recebidos desse cliente no ASAAS e
    estima o dia em que ele costuma pagar — útil pra saber se vale a pena
    insistir ou só esperar mais alguns dias."""
    if not customer_id:
        return None
    payments = await AsaasService().payments_by_customer(customer_id)
    received_states = {"RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"}
    diffs: list[int] = []
    days_of_month: list[int] = []
    for item in payments:
        if (item.get("status") or "").upper() not in received_states:
            continue
        due = item.get("dueDate")
        paid = item.get("paymentDate") or item.get("clientPaymentDate")
        if not due or not paid:
            continue
        try:
            due_date = datetime.fromisoformat(due).date()
            paid_date = datetime.fromisoformat(paid[:10]).date()
        except ValueError:
            continue
        diffs.append((paid_date - due_date).days)
        days_of_month.append(paid_date.day)

    if not diffs:
        return {"sample_size": 0}

    avg_days = round(sum(diffs) / len(diffs), 1)
    usual_day = max(set(days_of_month), key=days_of_month.count)
    return {
        "sample_size": len(diffs),
        "avg_days_after_due": avg_days,
        "usual_payment_day_of_month": usual_day,
        "typically_on_time": avg_days <= 0,
    }


async def _resolve_stale_logs(db: Session, current_overdue_ids: set[str]) -> None:
    """Todo payment_id que já recebeu lembrete e não está mais na lista de
    vencidas do ASAAS foi resolvido (pago, cancelado ou estornado) — é assim
    que a tela de histórico sabe "identificamos o pagamento em tal dia"."""
    pending = db.query(DunningLog).filter(DunningLog.resolved_at.is_(None)).all()
    for log in pending:
        if log.payment_id in current_overdue_ids:
            continue
        log.resolved_at = datetime.now(timezone.utc)
        try:
            detail = await AsaasService().charge_detail(log.payment_id)
            log.resolved_status = detail.get("status", "")
            log.resolved_payment_date = detail.get("payment_date") or detail.get("client_payment_date") or ""
        except Exception:
            log.resolved_status = "DESCONHECIDO"


async def run_dunning(db: Session, dry_run: bool, persist: bool = True) -> dict[str, Any]:
    """persist=False é usado pelo /preview — nunca grava em DunningLog nem
    conta como um envio, só mostra o que aconteceria numa rodada real."""
    all_overdue = await _all_overdue_charges()
    charges = [
        item for item in all_overdue
        if item.get("days_overdue", 0) >= DUNNING_START_DAYS and item.get("customer_email")
    ]
    sent: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []

    for charge in charges:
        payment_id = charge["id"]
        log = db.query(DunningLog).filter(DunningLog.payment_id == payment_id).first()
        if not _due_for_send(log):
            skipped.append({
                "payment_id": payment_id,
                "customer": charge["customer"],
                "days_overdue": charge["days_overdue"],
                "reason": "aguardando intervalo de 2 dias",
            })
            continue

        next_send_count = (log.send_count if log else 0) + 1

        if persist:
            subject, html = _build_email(charge)
            await email_service.send(charge["customer_email"], subject, html, dry_run=dry_run)
            if log is None:
                log = DunningLog(payment_id=payment_id, send_count=0)
                db.add(log)
            log.customer = charge["customer"]
            log.customer_id = charge.get("customer_id") or ""
            log.due_date = charge.get("due_date") or ""
            log.value = charge["value"]
            log.send_count += 1
            log.last_sent_at = datetime.now(timezone.utc)
            db.add(DunningEvent(payment_id=payment_id, days_overdue=charge["days_overdue"]))

        sent.append({
            "payment_id": payment_id,
            "customer": charge["customer"],
            "customer_email": charge["customer_email"],
            "value": charge["value"],
            "days_overdue": charge["days_overdue"],
            "send_count": next_send_count,
        })

    if persist:
        current_ids = {item["id"] for item in all_overdue}
        await _resolve_stale_logs(db, current_ids)
        db.commit()
    return {
        "dry_run": dry_run,
        "total_overdue_eligible": len(charges),
        "sent": sent,
        "skipped": skipped,
    }


def history(db: Session) -> list[dict[str, Any]]:
    logs = db.query(DunningLog).order_by(DunningLog.last_sent_at.desc().nullslast()).all()
    events_by_payment: dict[str, list[DunningEvent]] = {}
    if logs:
        payment_ids = [log.payment_id for log in logs]
        all_events = (
            db.query(DunningEvent)
            .filter(DunningEvent.payment_id.in_(payment_ids))
            .order_by(DunningEvent.sent_at.asc())
            .all()
        )
        for event in all_events:
            events_by_payment.setdefault(event.payment_id, []).append(event)

    return [
        {
            "payment_id": log.payment_id,
            "customer": log.customer,
            "customer_id": log.customer_id,
            "competencia": _competencia(log.due_date),
            "value": log.value,
            "send_count": log.send_count,
            "last_sent_at": log.last_sent_at.isoformat() if log.last_sent_at else None,
            "resolved_at": log.resolved_at.isoformat() if log.resolved_at else None,
            "resolved_status": log.resolved_status,
            "resolved_payment_date": log.resolved_payment_date,
            "status": "resolvido" if log.resolved_at else "em cobrança",
            "events": [
                {"sent_at": event.sent_at.isoformat(), "days_overdue": event.days_overdue}
                for event in events_by_payment.get(log.payment_id, [])
            ],
        }
        for log in logs
    ]
