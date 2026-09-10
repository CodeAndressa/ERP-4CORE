"""Cobertura de agendamento e insights sobre site e Instagram.

Duas funções distintas que compartilham a mesma disciplina: nada aqui inventa
número. Os sinais são calculados a partir dos dados reais das integrações e a IA
só entra depois, para interpretar sinais que já existem. Quando uma fonte não
responde, isso é declarado em vez de virar generalização.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from sqlalchemy import inspect
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.groq_service import groq_error_detail, groq_model_id
from app.models.marketing import ExternalScheduledPost, MarketingContent
from app.services.marketing_brand_system import sentence_case
from app.services.meta_marketing_service import MetaMarketingService
from app.services.site_analytics_service import get_site_dashboard


logger = logging.getLogger(__name__)


# Abaixo de CRITICAL a fila está prestes a secar; abaixo de WARNING já é hora de
# produzir. GAP olha o outro lado do problema: horizonte longo não resolve nada se
# não houver nada saindo nos próximos dias.
COVERAGE_CRITICAL_DAYS = 2
COVERAGE_WARNING_DAYS = 7
GAP_WARNING_DAYS = 3

SCHEDULED_STATUSES = ("approved", "scheduled")


def _days_between(start: datetime, end: datetime) -> float:
    return round((end - start).total_seconds() / 86400, 1)


def schedule_coverage(db: Session) -> dict[str, Any]:
    """Até quando a rede social está coberta por agendamento.

    Considera as duas origens: as peças que o próprio ERP publica pelo cron e os
    lembretes de posts agendados fora dele (Business Suite), porque para a pergunta
    "vou ficar sem post?" as duas contam igual."""
    now = datetime.now(timezone.utc)

    upcoming: list[dict[str, Any]] = []
    source_errors: dict[str, str] = {}

    # Selecionar o modelo inteiro faz o SQL incluir todas as colunas declaradas.
    # Em uma implantação cujo migration de `layout` ainda não rodou, isso derruba
    # a consulta mesmo que id, título e data — o necessário para a contagem — já
    # estejam disponíveis. A inspeção mantém compatibilidade e assume feed para
    # registros do schema antigo.
    for model, source in ((MarketingContent, "erp"), (ExternalScheduledPost, "externo")):
        try:
            table_columns = {
                column["name"]
                for column in inspect(db.get_bind()).get_columns(model.__tablename__)
            }
            selected = [model.id, model.title, model.scheduled_at]
            if "layout" in table_columns:
                selected.append(model.layout)
            query = db.query(*selected)
            if model is MarketingContent:
                query = query.filter(MarketingContent.status.in_(SCHEDULED_STATUSES))
                query = query.filter(MarketingContent.scheduled_at.isnot(None))

            for item in query.all():
                when = item.scheduled_at if item.scheduled_at.tzinfo else item.scheduled_at.replace(tzinfo=timezone.utc)
                if when > now:
                    upcoming.append(
                        {
                            "id": item.id,
                            "title": item.title,
                            "kind": "story" if getattr(item, "layout", "feed") == "story" else "feed",
                            "source": source,
                            "scheduled_at": when.isoformat().replace("+00:00", "Z"),
                            "_when": when,
                        }
                    )
        except Exception as exc:
            db.rollback()
            logger.exception("schedule coverage: %s source failed", source)
            source_errors[source] = type(exc).__name__

    upcoming.sort(key=lambda entry: entry["_when"])
    # Contado aqui, sobre a lista inteira, porque `upcoming` sai truncado no payload.
    # Quem consome não tem como recalcular sem subestimar.
    week_limit = now + timedelta(days=7)
    in_next_7_days = sum(1 for entry in upcoming if entry["_when"] <= week_limit)
    covered_until = upcoming[-1]["_when"] if upcoming else None
    next_at = upcoming[0]["_when"] if upcoming else None
    days_ahead = _days_between(now, covered_until) if covered_until else 0.0
    days_to_next = _days_between(now, next_at) if next_at else None

    if source_errors and not upcoming:
        level = "warning"
    elif not upcoming or days_ahead < COVERAGE_CRITICAL_DAYS:
        level = "critical"
    elif days_ahead < COVERAGE_WARNING_DAYS or (days_to_next is not None and days_to_next > GAP_WARNING_DAYS):
        level = "warning"
    else:
        level = "ok"

    if source_errors and not upcoming:
        message = "Não foi possível verificar todos os agendamentos agora. Atualize novamente em instantes."
    elif not upcoming:
        message = "Nenhum post ou story agendado. A partir de agora a conta fica sem publicação."
    elif days_ahead < COVERAGE_CRITICAL_DAYS:
        message = f"A fila acaba em {days_ahead:.1f} dia(s). Agende novas peças hoje."
    elif days_to_next is not None and days_to_next > GAP_WARNING_DAYS:
        message = f"A próxima publicação só sai em {days_to_next:.1f} dia(s), mesmo com a fila indo até {days_ahead:.1f} dia(s)."
    elif days_ahead < COVERAGE_WARNING_DAYS:
        message = f"Agendamento cobre só os próximos {days_ahead:.1f} dia(s)."
    else:
        message = f"Agendamento coberto pelos próximos {days_ahead:.1f} dia(s)."

    if source_errors and upcoming:
        message += " Uma fonte do calendário não pôde ser verificada."

    for entry in upcoming:
        entry.pop("_when", None)

    return {
        "level": level,
        "message": message,
        "covered_until": covered_until.isoformat().replace("+00:00", "Z") if covered_until else None,
        "days_ahead": days_ahead,
        "next_at": next_at.isoformat().replace("+00:00", "Z") if next_at else None,
        "days_to_next": days_to_next,
        "total_upcoming": len(upcoming),
        "in_next_7_days": in_next_7_days,
        "partial": bool(source_errors),
        "errors": source_errors,
        "by_kind": {kind: sum(1 for entry in upcoming if entry["kind"] == kind) for kind in ("story", "feed")},
        "by_source": {
            source: sum(1 for entry in upcoming if entry["source"] == source) for source in ("erp", "externo")
        },
        "upcoming": upcoming[:8],
        "thresholds": {
            "critical_days": COVERAGE_CRITICAL_DAYS,
            "warning_days": COVERAGE_WARNING_DAYS,
            "gap_days": GAP_WARNING_DAYS,
        },
        "checked_at": now.isoformat().replace("+00:00", "Z"),
    }


def safe_schedule_coverage(db: Session, errors: dict[str, str]) -> dict[str, Any]:
    """Mantém os insights disponíveis se a agenda estiver temporariamente indisponível."""
    try:
        coverage = schedule_coverage(db)
        for source, error in coverage.get("errors", {}).items():
            errors[f"agendamento_{source}"] = error
        return coverage
    except Exception as exc:
        logger.exception("marketing insights: schedule coverage failed")
        errors["cobertura_agendamento"] = type(exc).__name__
        return {"erro": "Cobertura de agendamento não respondeu"}


def _delta(current: float, previous: float) -> dict[str, Any]:
    change = None if not previous else round((current - previous) / previous * 100, 1)
    return {
        "atual": round(current, 1),
        "anterior": round(previous, 1),
        "variacao_pct": change,
        "direcao": "estavel" if change is None or abs(change) < 5 else ("subindo" if change > 0 else "caindo"),
    }


def _site_signals(site: dict[str, Any]) -> dict[str, Any]:
    """Comparação de 7 dias contra os 7 anteriores. Tendência é o que muda decisão;
    total de 30 dias sozinho não diz se a situação está melhorando ou piorando."""
    daily = site.get("daily", [])
    last7, prev7 = daily[-7:], daily[-14:-7]
    summary = site.get("summary", {})
    sources = [source for source in site.get("sources", []) if source.get("visitors", 0) >= 5]
    best_source = max(sources, key=lambda s: s.get("conversion_rate", 0), default=None)
    return {
        "periodo_dias": site.get("period_days"),
        "resumo_30d": summary,
        "visitantes_7d": _delta(
            sum(day.get("visitors", 0) for day in last7), sum(day.get("visitors", 0) for day in prev7)
        ),
        "leads_7d": _delta(sum(day.get("leads", 0) for day in last7), sum(day.get("leads", 0) for day in prev7)),
        "conversoes_7d": _delta(
            sum(day.get("conversions", 0) for day in last7), sum(day.get("conversions", 0) for day in prev7)
        ),
        "pagina_mais_vista": (site.get("top_pages") or [{}])[0],
        "origem_que_mais_converte": best_source,
        "origens": site.get("sources", [])[:5],
        "dias_sem_lead": sum(1 for day in last7 if not day.get("leads")),
    }


def _instagram_signals(profile: dict, insights: dict, media: list[dict], growth: dict) -> dict[str, Any]:
    engaged = [
        {
            "quando": str(post.get("timestamp", ""))[:10],
            "tipo": post.get("media_product_type") or post.get("media_type"),
            "interacoes": int(post.get("like_count") or 0) + int(post.get("comments_count") or 0),
            "curtidas": int(post.get("like_count") or 0),
            "comentarios": int(post.get("comments_count") or 0),
            "legenda": str(post.get("caption", ""))[:120],
        }
        for post in media
    ]
    ranked = sorted(engaged, key=lambda post: post["interacoes"], reverse=True)
    followers = profile.get("followers_count") or insights.get("summary", {}).get("followers") or 0
    media_average = round(sum(post["interacoes"] for post in engaged) / len(engaged), 1) if engaged else 0

    dates = sorted({post["quando"] for post in engaged if post["quando"]}, reverse=True)
    dias_desde_ultimo = None
    if dates:
        try:
            dias_desde_ultimo = (datetime.now(timezone.utc).date() - datetime.fromisoformat(dates[0]).date()).days
        except ValueError:
            dias_desde_ultimo = None

    return {
        "seguidores": followers,
        "publicacoes_total": profile.get("media_count") or insights.get("summary", {}).get("media_count") or 0,
        "alcance_30d": insights.get("summary", {}).get("reach_total"),
        "tendencia_alcance_pct": insights.get("summary", {}).get("trend_pct"),
        "alcance_semanal": insights.get("weekly", []),
        "insights_disponiveis": insights.get("insights_available", False),
        "crescimento_seguidores_30d": growth.get("growth_30d") if growth.get("available") else None,
        "interacoes_media_por_post": media_average,
        "taxa_engajamento_media_pct": round(media_average / followers * 100, 2) if followers else None,
        "melhores_posts": ranked[:3],
        "piores_posts": ranked[-3:] if len(ranked) > 3 else [],
        "posts_analisados": len(engaged),
        "dias_desde_ultima_publicacao": dias_desde_ultimo,
    }


INSIGHTS_SYSTEM_PROMPT = """
Você é a analista de marketing digital da 4Core, empresa brasileira de controle de
ponto e controle de acesso. Recebe sinais já calculados sobre o site e sobre o
Instagram e precisa transformá-los em leitura acionável para quem toma decisão.

Regras:
- use exclusivamente os números presentes em "sinais"; nunca estime, arredonde para
  mais nem cite métrica que não esteja ali;
- quando um bloco vier com "erro" ou vazio, diga que a fonte não respondeu e qual
  dado falta, em vez de generalizar;
- cada insight precisa citar o número que o sustenta;
- ação recomendada tem que ser executável nesta semana por uma equipe pequena;
- não prometa resultado percentual futuro;
- escreva tudo em português brasileiro com acentuação correta;
- em title, só a primeira letra maiúscula, nunca Capitalizando Cada Palavra.

priority indica urgência; confidence indica quanta evidência existe no dado (poucos
posts analisados ou fonte parcial significa confiança média ou baixa).

area aceita exatamente três valores: "site", "instagram" ou "integrado". O bloco
"cobertura_agendamento" dos sinais é sobre a fila de publicação do Instagram, então
insight sobre ele usa area "instagram".

Responda somente JSON válido:
{"headline": string, "summary": string, "insights": [{"area": "site|instagram|integrado",
"title": string, "reading": string, "action": string, "priority": "alta|media|baixa",
"confidence": "alta|media|baixa"}]}
Máximo de 6 insights.
""".strip()


async def build_insights(db: Session) -> dict[str, Any]:
    site_signals: dict[str, Any] = {}
    instagram_signals: dict[str, Any] = {}
    errors: dict[str, str] = {}

    try:
        site_signals = _site_signals(await get_site_dashboard(30))
    except Exception as exc:
        logger.exception("marketing insights: site analytics failed")
        errors["site"] = f"Analytics do site não respondeu: {type(exc).__name__}"

    meta = MetaMarketingService()
    profile: dict[str, Any] = {}
    insights: dict[str, Any] = {}
    media: list[dict[str, Any]] = []
    growth: dict[str, Any] = {}
    for name, call in (
        ("perfil", lambda: meta.instagram_profile()),
        ("insights", lambda: meta.instagram_account_insights()),
        ("posts", lambda: meta.instagram_media()),
        ("seguidores", lambda: meta.instagram_follower_growth()),
    ):
        try:
            result = await call()
            if name == "perfil":
                profile = result
            elif name == "insights":
                insights = result
            elif name == "posts":
                media = result
            else:
                growth = result
        except Exception as exc:
            logger.exception("marketing insights: Instagram source %s failed", name)
            errors[f"instagram_{name}"] = f"{type(exc).__name__}"
    if profile or insights or media:
        instagram_signals = _instagram_signals(profile, insights, media, growth)

    signals = {
        "site": site_signals or {"erro": errors.get("site", "sem dados")},
        "instagram": instagram_signals or {"erro": "Instagram não respondeu"},
        "cobertura_agendamento": safe_schedule_coverage(db, errors),
    }
    if not site_signals and not instagram_signals:
        return {
            "available": False,
            "reason": "Nem o analytics do site nem o Instagram responderam. Verifique as integrações em Conexões.",
            "errors": errors,
            "signals": signals,
        }
    if not settings.groq_api_key:
        return {
            "available": False,
            "reason": "Os números estão disponíveis, mas a leitura por IA exige GROQ_API_KEY no backend.",
            "errors": errors,
            "signals": signals,
        }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
                json={
                    "model": groq_model_id(),
                    "temperature": 0.3,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": INSIGHTS_SYSTEM_PROMPT},
                        {"role": "user", "content": json.dumps({"sinais": signals}, ensure_ascii=False)},
                    ],
                },
            )
        if response.status_code >= 400:
            logger.error(
                "marketing insights: Groq returned status %s",
                response.status_code,
            )
            return {
                "available": False,
                "reason": groq_error_detail(response, "gerar a leitura dos insights"),
                "errors": errors,
                "signals": signals,
            }
        analysis = json.loads(response.json()["choices"][0]["message"]["content"])
    except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        logger.exception("marketing insights: AI response processing failed")
        return {
            "available": False,
            "reason": f"Os números estão disponíveis, mas a IA não retornou a leitura: {type(exc).__name__}",
            "errors": errors,
            "signals": signals,
        }

    # A área é normalizada aqui, e não confiada ao modelo: a tela filtra os cartões
    # por área, então um valor fora do conjunto faria o insight desaparecer em vez
    # de aparecer no lugar errado.
    allowed_areas = {"site", "instagram", "integrado"}
    return {
        "available": True,
        "headline": sentence_case(str(analysis.get("headline", "")))[:200],
        "summary": str(analysis.get("summary", ""))[:1200],
        "insights": [
            {
                "area": str(item.get("area", "")).strip().lower()
                if str(item.get("area", "")).strip().lower() in allowed_areas
                else "integrado",
                "title": sentence_case(str(item.get("title", "")))[:180],
                "reading": str(item.get("reading", ""))[:600],
                "action": str(item.get("action", ""))[:400],
                "priority": str(item.get("priority", "media")),
                "confidence": str(item.get("confidence", "media")),
            }
            for item in (analysis.get("insights") or [])[:6]
        ],
        "errors": errors,
        "signals": signals,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
