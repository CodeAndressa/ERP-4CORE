from __future__ import annotations

"""Quando publicar.

Duas perguntas separadas, e misturar as duas é o erro fácil:

- **Que horas?** Sai do histórico do próprio perfil, cruzando a hora em que cada
  post foi publicado com o engajamento que ele teve. Tabela genérica de "melhores
  horários do Instagram" não serve: o público da 4Core é decisor de PME e RH, que
  não tem a mesma rotina do público de moda ou de entretenimento.
- **Que dia?** Cadência fixa, a cada N dias, contada a partir da última publicação
  já agendada ou publicada, para o agente não empilhar duas peças no mesmo dia nem
  abrir buraco de uma semana.

Enquanto não houver histórico suficiente, devolve um horário padrão e diz que é
estimativa, em vez de fingir que mediu.
"""

from collections import defaultdict
from datetime import datetime, time, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.marketing import ExternalScheduledPost, MarketingContent

BRAZIL_TZ = ZoneInfo("America/Sao_Paulo")

# Horário usado enquanto o histórico não sustenta uma conclusão. Meio da manhã em
# dia útil é quando decisor de PME costuma estar no celular entre uma coisa e outra.
DEFAULT_HOUR = 9

# Abaixo disso a média por hora vira ruído: um único post viral aleatório decidiria
# o horário de todas as publicações seguintes.
MIN_POSTS_FOR_MEASURED_HOUR = 8

# Fim de semana fica de fora: é público B2B, e a conversa acontece em dia útil.
BUSINESS_DAYS = {0, 1, 2, 3, 4}


def _engagement(post: dict[str, Any]) -> float:
    return float(post.get("like_count") or 0) + float(post.get("comments_count") or 0) * 3


def best_hour(posts: list[dict[str, Any]]) -> dict[str, Any]:
    """Hora do dia com melhor engajamento médio, no fuso de São Paulo.

    Usa média e não soma: somar premiaria a hora em que o perfil mais publicou, que
    é justamente o viés que a conta quer corrigir."""
    dated = [post for post in posts if post.get("posted_at") and _engagement(post) > 0]
    if len(dated) < MIN_POSTS_FOR_MEASURED_HOUR:
        return {
            "hour": DEFAULT_HOUR,
            "measured": False,
            "posts_considered": len(dated),
            "reason": (
                f"Só {len(dated)} publicações com engajamento no histórico. "
                f"A partir de {MIN_POSTS_FOR_MEASURED_HOUR} o horário passa a sair do seu próprio desempenho."
            ),
            "by_hour": {},
        }

    buckets: dict[int, list[float]] = defaultdict(list)
    for post in dated:
        posted = post["posted_at"]
        if posted.tzinfo is None:
            posted = posted.replace(tzinfo=timezone.utc)
        buckets[posted.astimezone(BRAZIL_TZ).hour].append(_engagement(post))

    averages = {hour: sum(values) / len(values) for hour, values in buckets.items()}
    hour = max(averages, key=lambda key: averages[key])
    return {
        "hour": hour,
        "measured": True,
        "posts_considered": len(dated),
        "reason": (
            f"Média de engajamento mais alta às {hour}h, sobre {len(dated)} publicações "
            f"em {len(averages)} horários diferentes."
        ),
        "by_hour": {str(key): round(value, 1) for key, value in sorted(averages.items())},
    }


def _last_committed_slot(db: Session) -> datetime | None:
    """A publicação mais distante já comprometida, do ERP ou registrada como externa.
    Conta o agendamento externo também: senão o agente marcaria em cima de um post
    que já vai sair pelo Business Suite."""
    latest = (
        db.query(MarketingContent.scheduled_at)
        .filter(
            MarketingContent.scheduled_at.isnot(None),
            or_(
                MarketingContent.status.in_(["approved", "scheduled", "publishing", "published"]),
                MarketingContent.status == "awaiting_approval",
            ),
        )
        .order_by(MarketingContent.scheduled_at.desc())
        .first()
    )
    external = (
        db.query(ExternalScheduledPost.scheduled_at)
        .order_by(ExternalScheduledPost.scheduled_at.desc())
        .first()
    )
    candidates = [value[0] for value in (latest, external) if value and value[0]]
    if not candidates:
        return None
    return max(value if value.tzinfo else value.replace(tzinfo=timezone.utc) for value in candidates)


def next_slots(
    db: Session,
    count: int,
    hour: int,
    cadence_days: int = 2,
    now: datetime | None = None,
) -> list[datetime]:
    """Os próximos horários livres, respeitando a cadência e pulando fim de semana.

    Parte do que já está comprometido, não de hoje: rodar o agente duas vezes no
    mesmo dia não pode gerar duas publicações para a mesma data."""
    reference = (now or datetime.now(timezone.utc)).astimezone(BRAZIL_TZ)
    last = _last_committed_slot(db)
    if last:
        cursor = last.astimezone(BRAZIL_TZ)
    else:
        cursor = reference - timedelta(days=cadence_days)

    slots: list[datetime] = []
    guard = 0
    while len(slots) < count and guard < 200:
        guard += 1
        cursor = cursor + timedelta(days=cadence_days)
        candidate = datetime.combine(cursor.date(), time(hour=hour), tzinfo=BRAZIL_TZ)
        while candidate.weekday() not in BUSINESS_DAYS:
            candidate += timedelta(days=1)
        # Precisa sobrar tempo entre o agendamento e a publicação para alguém aprovar.
        if candidate <= reference + timedelta(hours=2):
            cursor = candidate
            continue
        slots.append(candidate)
        cursor = candidate
    return slots


def plan(db: Session, posts: list[dict[str, Any]], count: int, cadence_days: int = 2) -> dict[str, Any]:
    timing = best_hour(posts)
    slots = next_slots(db, count, timing["hour"], cadence_days)
    return {
        **timing,
        "cadence_days": cadence_days,
        "slots": [slot.isoformat() for slot in slots],
        "_slots": slots,
    }
