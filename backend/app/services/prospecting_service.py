from __future__ import annotations

import asyncio
import calendar
import imaplib
import json
import re
import smtplib
from datetime import date, datetime, timedelta, timezone
from email import message_from_bytes
from email.header import decode_header, make_header
from email.message import EmailMessage
from email.utils import make_msgid, parseaddr, parsedate_to_datetime
from html import unescape
from typing import Any

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.commercial import Lead
from app.models.prospecting import Prospect, ProspectingActivity, ProspectingCampaign, ProspectingSuppression
from app.models.user import User
from app.services.groq_service import groq_error_detail, groq_model_id


CASA_SEARCH_URL = "https://api.casadosdados.com.br/v5/cnpj/pesquisa"
BRASILAPI_CNPJ_URL = "https://brasilapi.com.br/api/cnpj/v1"
CASA_CNPJ_PRICE_CENTS = 1

SEGMENT_CNAES: dict[str, set[str]] = {
    "Saúde": {
        "8610101", "8610102", "8621601", "8621602", "8622400", "8630501",
        "8630502", "8630503", "8630504", "8630506", "8630507", "8630599",
        "8640201", "8640202", "8640205", "8640207", "8640208", "8640299",
    },
    "Transporte e logística": {
        "4930201", "4930202", "4930203", "4930204", "5211701", "5211702",
        "5212500", "5250801", "5250802", "5250803", "5250804", "5250805",
    },
    "Facilities e operações por turno": {
        "8011101", "8011102", "8020001", "8020002", "8111700", "8121400",
        "8122200", "8129000", "7820500", "7830200",
    },
}
ALL_TARGET_CNAES = sorted({code for codes in SEGMENT_CNAES.values() for code in codes})

VALID_PROSPECT_STATUSES = {
    "new", "approved", "contacted", "interested", "emailing", "rejected",
    "replied", "suppressed", "converted", "sequence_complete",
}


def json_list(value: str | None) -> list[Any]:
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except (TypeError, ValueError, json.JSONDecodeError):
        return []


def get_or_create_campaign(db: Session) -> ProspectingCampaign:
    campaign = db.query(ProspectingCampaign).order_by(ProspectingCampaign.id.asc()).first()
    if campaign:
        if not json_list(campaign.seller_ids):
            defaults = [row.id for row in db.query(User).filter(User.is_active.is_(True)).order_by(User.id.asc()).limit(3).all()]
            if defaults:
                campaign.seller_ids = json.dumps(defaults)
                db.commit()
        return campaign
    defaults = [row.id for row in db.query(User).filter(User.is_active.is_(True)).order_by(User.id.asc()).limit(3).all()]
    campaign = ProspectingCampaign(seller_ids=json.dumps(defaults))
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


def shift_months(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 + months
    year, month_zero = divmod(month_index, 12)
    month = month_zero + 1
    return value.replace(year=year, month=month, day=min(value.day, calendar.monthrange(year, month)[1]))


def _normalize_digits(value: Any) -> str:
    return re.sub(r"\D", "", str(value or ""))


def _clean_email(value: Any) -> str | None:
    candidate = str(value or "").strip().lower()
    if not candidate or "@" not in candidate or candidate.endswith("@"):
        return None
    return candidate[:180]


def _date_value(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value or "").strip()[:10]
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _float_value(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value or "").strip().replace("R$", "").replace(" ", "")
    if not text:
        return 0
    if "," in text:
        text = text.replace(".", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0


def segment_for_cnae(code: str | None) -> str:
    normalized = _normalize_digits(code)
    for segment, codes in SEGMENT_CNAES.items():
        if normalized in codes:
            return segment
    return "Outro"


def score_company(data: dict[str, Any], today: date | None = None) -> dict[str, Any]:
    today = today or date.today()
    opened_at = _date_value(data.get("opened_at") or data.get("data_abertura"))
    cnae = _normalize_digits(data.get("cnae_code") or data.get("codigo_atividade_principal"))
    segment_hint = str(data.get("segment") or data.get("_segment_hint") or "")
    size = str(data.get("company_size") or data.get("porte_empresa") or "").upper()
    capital = _float_value(data.get("capital_social"))
    email = _clean_email(data.get("email"))
    phone = _normalize_digits(data.get("phone") or data.get("telefone"))
    is_mei = bool(data.get("is_mei") or data.get("mei"))
    score = 0
    reasons: list[str] = []
    evidence: list[str] = []

    if cnae in ALL_TARGET_CNAES or segment_hint in SEGMENT_CNAES:
        score += 25
        reasons.append(f"Atividade aderente: {segment_for_cnae(cnae) if cnae in ALL_TARGET_CNAES else segment_hint}")

    if opened_at:
        age_months = max(0, (today.year - opened_at.year) * 12 + today.month - opened_at.month)
        if 6 <= age_months <= 18:
            score += 25
            reasons.append("Aberta entre 6 e 18 meses")
        elif 3 <= age_months <= 24:
            score += 15
            reasons.append("Aberta entre 3 e 24 meses")

    if "PEQUENO" in size or size in {"03", "EPP"}:
        score += 18
        evidence.append("Porte EPP informado no CNPJ")
    elif "DEMAIS" in size or size == "05":
        score += 20
        evidence.append("Porte acima de microempresa")
    elif "MICRO" in size or size in {"01", "ME"}:
        score += 7
        evidence.append("Microempresa não MEI")

    if capital >= 100_000:
        score += 15
        evidence.append("Capital social a partir de R$ 100 mil")
    elif capital >= 30_000:
        score += 8
        evidence.append("Capital social a partir de R$ 30 mil")

    if email and phone:
        score += 10
        reasons.append("Possui e-mail e telefone públicos")
    elif email or phone:
        score += 5
        reasons.append("Possui um canal público de contato")

    if is_mei:
        score -= 30
        reasons.append("MEI: baixa probabilidade de possuir mais de 5 funcionários")
    else:
        score += 7
        evidence.append("Não está identificada como MEI")

    confidence = "high" if len(evidence) >= 3 and score >= 75 else "medium" if len(evidence) >= 1 and score >= 55 else "low"
    return {
        "score": max(0, min(100, score)),
        "score_reasons": reasons,
        "employee_confidence": confidence,
        "employee_evidence": evidence,
    }


def _nested_label(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("descricao") or value.get("codigo") or "")
    return str(value or "")


def normalize_casa_company(item: dict[str, Any]) -> dict[str, Any]:
    address = item.get("endereco") if isinstance(item.get("endereco"), dict) else {}
    cnae_obj = item.get("atividade_principal") or item.get("cnae_principal") or {}
    if isinstance(cnae_obj, list):
        cnae_obj = cnae_obj[0] if cnae_obj else {}
    cnae_code = _normalize_digits(
        item.get("codigo_atividade_principal")
        or item.get("cnae_fiscal")
        or (cnae_obj.get("codigo") if isinstance(cnae_obj, dict) else cnae_obj)
    )
    phone = item.get("telefone") or item.get("telefone1") or item.get("ddd_telefone_1")
    ddd = item.get("ddd") or item.get("ddd1")
    phone_digits = _normalize_digits(phone)
    if ddd and phone_digits and not phone_digits.startswith(_normalize_digits(ddd)):
        phone_digits = f"{_normalize_digits(ddd)}{phone_digits}"
    size = _nested_label(item.get("porte_empresa") or item.get("porte"))
    mei = item.get("mei") if "mei" in item else item.get("opcao_pelo_mei")
    is_mei = bool(mei.get("optante")) if isinstance(mei, dict) else bool(mei)
    street_parts = [address.get("tipo_logradouro"), address.get("logradouro"), address.get("numero"), address.get("bairro")]
    data = {
        "cnpj": _normalize_digits(item.get("cnpj"))[:14],
        "company_name": str(item.get("razao_social") or item.get("nome_empresarial") or "Empresa sem razão social")[:220],
        "trade_name": str(item.get("nome_fantasia") or "")[:220] or None,
        "cnae_code": cnae_code or None,
        "cnae_description": str(
            item.get("descricao_atividade_principal")
            or (cnae_obj.get("descricao") if isinstance(cnae_obj, dict) else "")
        )[:255] or None,
        "segment": segment_for_cnae(cnae_code) if cnae_code in ALL_TARGET_CNAES else str(item.get("_segment_hint") or "Outro"),
        "opened_at": _date_value(item.get("data_abertura") or item.get("data_inicio_atividade")),
        "company_size": size[:80] or None,
        "capital_social": _float_value(item.get("capital_social")),
        "city": str(address.get("municipio") or item.get("municipio") or "")[:120] or None,
        "state": str(address.get("uf") or item.get("uf") or "")[:2].upper() or None,
        "address": ", ".join(str(part) for part in street_parts if part)[:320] or ", ".join(str(item.get(key)) for key in ("descricao_tipo_de_logradouro", "logradouro", "numero", "bairro") if item.get(key))[:320] or None,
        "email": _clean_email(item.get("email") or item.get("correio_eletronico")),
        "phone": phone_digits[:60] or None,
        "is_mei": is_mei,
    }
    data.update(score_company(data))
    return data


def is_suppressed(db: Session, data: dict[str, Any]) -> bool:
    cnpj = data.get("cnpj")
    email = data.get("email")
    phone = data.get("phone")
    query = db.query(ProspectingSuppression)
    checks = []
    if cnpj:
        checks.append(ProspectingSuppression.cnpj == cnpj)
    if email:
        checks.append(ProspectingSuppression.email == email)
    if phone:
        checks.append(ProspectingSuppression.phone == phone)
    if not checks:
        return False
    from sqlalchemy import or_
    return query.filter(or_(*checks)).first() is not None


def existing_contact(db: Session, data: dict[str, Any]) -> bool:
    if data.get("cnpj") and db.query(Prospect).filter(Prospect.cnpj == data["cnpj"]).first():
        return True
    email = data.get("email")
    phone = data.get("phone")
    if email and db.query(Lead).filter(Lead.email == email).first():
        return True
    if phone and db.query(Lead).filter(Lead.phone == phone).first():
        return True
    return is_suppressed(db, data)


def _month_key(now: datetime | None = None) -> str:
    return (now or datetime.now(timezone.utc)).strftime("%Y-%m")


def reset_monthly_spend(campaign: ProspectingCampaign) -> None:
    current = _month_key()
    if campaign.spent_month != current:
        campaign.spent_month = current
        campaign.spent_cents = 0


async def discover_companies(db: Session, requested: int = 45) -> dict[str, Any]:
    if not settings.casa_dos_dados_api_key:
        raise HTTPException(409, "Configure CASA_DOS_DADOS_API_KEY para buscar empresas automaticamente.")
    campaign = get_or_create_campaign(db)
    reset_monthly_spend(campaign)
    remaining = max(0, campaign.monthly_budget_cents - campaign.spent_cents)
    remaining_queries = remaining // CASA_CNPJ_PRICE_CENTS
    configured_query_limit = max(0, settings.prospecting_monthly_query_limit)
    if configured_query_limit:
        used_queries = campaign.spent_cents // CASA_CNPJ_PRICE_CENTS
        remaining_queries = min(remaining_queries, max(0, configured_query_limit - used_queries))
    limit = min(max(1, requested), remaining_queries)
    if limit <= 0:
        raise HTTPException(409, "O limite mensal de consultas da prospecção foi atingido.")

    today = date.today()
    base_body = {
        "incluir_atividade_secundaria": True,
        "situacao_cadastral": ["ATIVA"],
        "matriz_filial": "MATRIZ",
        "data_abertura": {
            "inicio": shift_months(today, -campaign.opened_max_months).isoformat(),
            "fim": shift_months(today, -campaign.opened_min_months).isoformat(),
            "ultimos_dias": 0,
        },
        "mei": {"optante": False, "excluir_optante": True},
        "mais_filtros": {
            "somente_matriz": True,
            "com_email": False,
            "com_telefone": True,
            "excluir_empresas_visualizadas": True,
            "excluir_email_contab": True,
        },
        "pagina": 1,
    }
    segment_items = list(SEGMENT_CNAES.items())
    allocations = [limit // len(segment_items)] * len(segment_items)
    for index in range(limit % len(segment_items)):
        allocations[index] += 1

    async def search_segment(client: httpx.AsyncClient, segment: str, codes: set[str], segment_limit: int) -> list[dict[str, Any]]:
        if segment_limit <= 0:
            return []
        body = dict(base_body)
        body.update({"codigo_atividade_principal": sorted(codes), "codigo_atividade_secundaria": sorted(codes), "limite": segment_limit})
        response = await client.post(
            CASA_SEARCH_URL,
            headers={"api-key": settings.casa_dos_dados_api_key, "Content-Type": "application/json"},
            json=body,
        )
        if response.status_code >= 400:
            raise HTTPException(502, f"Casa dos Dados indisponível ({response.status_code}).")
        payload = response.json()
        values = payload.get("cnpjs") or payload.get("empresas") or payload.get("dados") or []
        output = []
        for value in values if isinstance(values, list) else []:
            if isinstance(value, dict):
                output.append({**value, "_segment_hint": segment})
        return output

    async def enrich_company(client: httpx.AsyncClient, raw: dict[str, Any]) -> dict[str, Any]:
        cnpj = _normalize_digits(raw.get("cnpj"))[:14]
        if not cnpj:
            return raw
        try:
            response = await client.get(f"{BRASILAPI_CNPJ_URL}/{cnpj}")
            if response.status_code == 200 and isinstance(response.json(), dict):
                return {**raw, **response.json(), "_segment_hint": raw.get("_segment_hint")}
        except (httpx.HTTPError, ValueError):
            pass
        return raw

    async with httpx.AsyncClient(timeout=45.0) as client:
        groups = await asyncio.gather(*[
            search_segment(client, segment, codes, allocation)
            for (segment, codes), allocation in zip(segment_items, allocations)
        ])
        found_items = [item for group in groups for item in group]
        items = await asyncio.gather(*[enrich_company(client, item) for item in found_items])

    added = 0
    skipped = 0
    charged = len(items) * CASA_CNPJ_PRICE_CENTS
    for raw in items:
        if not isinstance(raw, dict):
            continue
        data = normalize_casa_company(raw)
        if not data["cnpj"] or data["score"] < 55 or existing_contact(db, data):
            skipped += 1
            continue
        clean = {key: value for key, value in data.items() if key != "is_mei"}
        clean["score_reasons"] = json.dumps(clean["score_reasons"], ensure_ascii=False)
        clean["employee_evidence"] = json.dumps(clean["employee_evidence"], ensure_ascii=False)
        prospect = Prospect(
            campaign_id=campaign.id,
            source="Casa dos Dados",
            source_url=f"https://casadosdados.com.br/solucao/cnpj/{clean['cnpj']}",
            **clean,
        )
        db.add(prospect)
        db.flush()
        db.add(ProspectingActivity(prospect_id=prospect.id, kind="discovered", body="Empresa encontrada e qualificada automaticamente."))
        added += 1

    campaign.spent_cents += charged
    campaign.last_discovery_at = datetime.now(timezone.utc)
    db.commit()
    used_queries = campaign.spent_cents // CASA_CNPJ_PRICE_CENTS
    query_limit = max(0, settings.prospecting_monthly_query_limit)
    return {
        "found": len(items),
        "added": added,
        "skipped": skipped,
        "charged_cents": charged,
        "remaining_cents": max(0, campaign.monthly_budget_cents - campaign.spent_cents),
        "queries_used": used_queries,
        "query_limit": query_limit or None,
        "queries_remaining": max(0, query_limit - used_queries) if query_limit else None,
    }


def seller_ids_for_campaign(db: Session, campaign: ProspectingCampaign) -> list[int]:
    configured = [int(value) for value in json_list(campaign.seller_ids) if str(value).isdigit()]
    active_ids = {row.id for row in db.query(User).filter(User.is_active.is_(True)).all()}
    valid = [seller_id for seller_id in configured if seller_id in active_ids]
    if valid:
        return valid[:3]
    return [row.id for row in db.query(User).filter(User.is_active.is_(True)).order_by(User.id.asc()).limit(3).all()]


def distribute_daily_queue(db: Session) -> dict[str, Any]:
    campaign = get_or_create_campaign(db)
    seller_ids = seller_ids_for_campaign(db, campaign)
    if not seller_ids:
        return {"assigned": 0, "seller_ids": [], "reason": "Nenhum usuário ativo disponível."}
    sellers = {row.id: row for row in db.query(User).filter(User.id.in_(seller_ids)).all()}
    today_start = datetime.combine(date.today(), datetime.min.time(), tzinfo=timezone.utc)
    counts = {
        seller_id: db.query(Prospect).filter(
            Prospect.assigned_to_id == seller_id,
            Prospect.assigned_at >= today_start,
            Prospect.status.in_(["new", "approved"]),
        ).count()
        for seller_id in seller_ids
    }
    queue = db.query(Prospect).filter(
        Prospect.assigned_to_id.is_(None),
        Prospect.status == "new",
    ).order_by(Prospect.score.desc(), Prospect.opened_at.desc()).all()
    assigned = 0
    for prospect in queue:
        eligible = [seller_id for seller_id in seller_ids if counts[seller_id] < campaign.daily_per_seller]
        if not eligible:
            break
        seller_id = min(eligible, key=lambda value: counts[value])
        prospect.assigned_to_id = seller_id
        prospect.assigned_to_name = sellers[seller_id].full_name
        prospect.assigned_at = datetime.now(timezone.utc)
        counts[seller_id] += 1
        assigned += 1
        db.add(ProspectingActivity(prospect_id=prospect.id, kind="assigned", body=f"Distribuído para {prospect.assigned_to_name}."))
    db.commit()
    return {"assigned": assigned, "seller_ids": seller_ids, "counts": counts}


def add_business_days(value: datetime, days: int) -> datetime:
    result = value
    remaining = days
    while remaining:
        result += timedelta(days=1)
        if result.weekday() < 5:
            remaining -= 1
    return result


def default_draft(prospect: Prospect) -> dict[str, str]:
    company = prospect.trade_name or prospect.company_name
    segment_detail = prospect.segment.lower() if prospect.segment else "sua operação"
    return {
        "subject": f"Diagnóstico gratuito de controle de ponto — {company}",
        "email": (
            f"Olá, tudo bem?\n\n"
            f"Acompanhamos empresas de {segment_detail} que estão estruturando equipes e rotinas de jornada. "
            "A 4Core realiza um diagnóstico gratuito para identificar riscos trabalhistas, retrabalho no fechamento "
            "do ponto e a solução mais adequada — relógio, sistema em nuvem ou aplicativo.\n\n"
            "Podemos agendar uma demonstração online de 15 minutos?\n\n"
            "Equipe Comercial 4Core"
        ),
        "call_script": (
            f"Olá, falo da 4Core. Nós ajudamos empresas de {segment_detail} a implantar controle de ponto "
            "em conformidade com a Portaria 671. Gostaria de entender como a empresa controla a jornada hoje "
            "e oferecer um diagnóstico gratuito de 15 minutos."
        ),
    }


async def generate_draft(prospect: Prospect) -> dict[str, str]:
    fallback = default_draft(prospect)
    if not settings.groq_api_key:
        return fallback
    context = {
        "empresa": prospect.trade_name or prospect.company_name,
        "segmento": prospect.segment,
        "cidade": prospect.city,
        "uf": prospect.state,
        "idade": prospect.opened_at.isoformat() if prospect.opened_at else None,
        "porte": prospect.company_size,
        "motivos": json_list(prospect.score_reasons),
    }
    system = (
        "Você é SDR sênior da 4Core, especialista em controle de ponto, Topdata, aplicativo móvel e Portaria 671. "
        "Gere JSON com subject, email e call_script. Português brasileiro impecável. Seja humano, breve, específico "
        "e consultivo. Não afirme que sabe qual sistema a empresa usa e não invente fatos. O CTA é um diagnóstico "
        "e demonstração online gratuitos de 15 minutos. O e-mail deve ter no máximo 120 palavras e terminar com "
        "'Equipe Comercial 4Core'. Não use campos entre colchetes, nomes fictícios, o termo SDR, urgência artificial "
        "ou emojis."
    )
    async with httpx.AsyncClient(timeout=40.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
            json={
                "model": groq_model_id(),
                "temperature": 0.35,
                "response_format": {"type": "json_object"},
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": json.dumps(context, ensure_ascii=False)}],
            },
        )
    if response.status_code >= 400:
        raise HTTPException(502, groq_error_detail(response, "preparar a abordagem"))
    try:
        value = json.loads(response.json()["choices"][0]["message"]["content"])
        return {key: str(value.get(key) or fallback[key]).strip() for key in fallback}
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return fallback


def _email_footer() -> str:
    return (
        "\n\n—\nEquipe Comercial 4Core | Curitiba - PR\n"
        f"Privacidade: {settings.prospecting_privacy_url}\n"
        "Se não quiser receber novos contatos, responda com 'não tenho interesse'."
    )


def _smtp_send(to_email: str, subject: str, body: str, prospect_id: str) -> str:
    sender = settings.hostinger_email_address
    domain = sender.split("@", 1)[-1] if "@" in sender else "4core.site"
    message_id = make_msgid(domain=domain)
    message = EmailMessage()
    message["From"] = f"Equipe Comercial 4Core <{sender}>"
    message["To"] = to_email
    message["Subject"] = subject
    message["Message-ID"] = message_id
    message["X-4Core-Prospect-ID"] = prospect_id
    message.set_content(body.rstrip() + _email_footer())
    with smtplib.SMTP_SSL(settings.hostinger_smtp_host, settings.hostinger_smtp_port, timeout=25) as smtp:
        smtp.login(sender, settings.hostinger_email_password)
        smtp.send_message(message)
    return message_id


async def send_prospect_email(db: Session, prospect: Prospect, subject: str, body: str, automatic: bool = False) -> dict[str, Any]:
    if not prospect.contact_permission:
        raise HTTPException(409, "Registre o interesse ou a autorização do contato antes de enviar e-mail.")
    if not prospect.email:
        raise HTTPException(422, "Este prospecto não possui e-mail válido.")
    if not settings.hostinger_email_password:
        raise HTTPException(409, "Configure as credenciais da Hostinger para enviar e-mails.")
    if settings.prospecting_dry_run:
        return {"sent": False, "dry_run": True, "subject": subject, "body": body}

    try:
        message_id = await asyncio.to_thread(_smtp_send, prospect.email, subject, body, prospect.id)
    except (OSError, smtplib.SMTPException) as exc:
        raise HTTPException(502, "A Hostinger recusou ou não concluiu o envio.") from exc
    now = datetime.now(timezone.utc)
    prospect.status = "emailing"
    prospect.last_contact_at = now
    prospect.follow_up_step = max(1, prospect.follow_up_step + 1 if automatic else 1)
    prospect.next_action_at = add_business_days(now, 3 if prospect.follow_up_step == 1 else 5) if prospect.follow_up_step < 3 else None
    if prospect.follow_up_step >= 3:
        prospect.status = "sequence_complete"
    db.add(ProspectingActivity(
        prospect_id=prospect.id,
        kind="email_sent",
        channel="email",
        direction="outbound",
        subject=subject,
        body=body,
        message_id=message_id,
        thread_key=message_id,
        status="sent",
    ))
    db.commit()
    return {"sent": True, "message_id": message_id, "follow_up_step": prospect.follow_up_step}


def _decode_header(value: str | None) -> str:
    if not value:
        return ""
    try:
        return str(make_header(decode_header(value)))
    except (LookupError, UnicodeDecodeError):
        return value


def _message_body(message: Any) -> str:
    candidates = message.walk() if message.is_multipart() else [message]
    html_value = ""
    for part in candidates:
        if str(part.get("Content-Disposition", "")).lower().startswith("attachment"):
            continue
        content_type = part.get_content_type()
        if content_type not in {"text/plain", "text/html"}:
            continue
        payload = part.get_payload(decode=True)
        if not payload:
            continue
        charset = part.get_content_charset() or "utf-8"
        text = payload.decode(charset, errors="replace")
        if content_type == "text/plain":
            return text.strip()[:12000]
        html_value = text
    if html_value:
        return unescape(re.sub(r"<[^>]+>", " ", html_value)).strip()[:12000]
    return ""


def _imap_messages(days: int = 14) -> list[dict[str, Any]]:
    sender = settings.hostinger_email_address
    since = (date.today() - timedelta(days=days)).strftime("%d-%b-%Y")
    output: list[dict[str, Any]] = []
    with imaplib.IMAP4_SSL(settings.hostinger_imap_host, settings.hostinger_imap_port) as mailbox:
        mailbox.login(sender, settings.hostinger_email_password)
        mailbox.select("INBOX", readonly=True)
        status, data = mailbox.search(None, "SINCE", since)
        if status != "OK" or not data:
            return output
        for uid in data[0].split()[-100:]:
            fetch_status, rows = mailbox.fetch(uid, "(BODY.PEEK[])")
            if fetch_status != "OK":
                continue
            raw = next((row[1] for row in rows if isinstance(row, tuple)), None)
            if not raw:
                continue
            message = message_from_bytes(raw)
            from_email = parseaddr(message.get("From", ""))[1].lower()
            if not from_email or from_email == sender.lower():
                continue
            try:
                occurred_at = parsedate_to_datetime(message.get("Date")) if message.get("Date") else datetime.now(timezone.utc)
                if occurred_at.tzinfo is None:
                    occurred_at = occurred_at.replace(tzinfo=timezone.utc)
            except (TypeError, ValueError):
                occurred_at = datetime.now(timezone.utc)
            output.append({
                "from_email": from_email,
                "subject": _decode_header(message.get("Subject"))[:255],
                "body": _message_body(message),
                "message_id": str(message.get("Message-ID") or f"imap-{uid.decode()}")[:255],
                "in_reply_to": str(message.get("In-Reply-To") or message.get("References") or "")[:255],
                "prospect_id": str(message.get("X-4Core-Prospect-ID") or ""),
                "occurred_at": occurred_at,
            })
    return output


async def sync_inbox(db: Session) -> dict[str, int]:
    if not settings.hostinger_email_password:
        raise HTTPException(409, "Configure as credenciais da Hostinger para sincronizar respostas.")
    try:
        messages = await asyncio.to_thread(_imap_messages)
    except (OSError, imaplib.IMAP4.error) as exc:
        raise HTTPException(502, "Não foi possível sincronizar a caixa da Hostinger.") from exc
    added = 0
    unmatched = 0
    for item in messages:
        if db.query(ProspectingActivity).filter(ProspectingActivity.message_id == item["message_id"]).first():
            continue
        prospect = None
        if item["prospect_id"]:
            prospect = db.get(Prospect, item["prospect_id"])
        if not prospect and item["in_reply_to"]:
            referenced_ids = re.findall(r"<[^>]+>", item["in_reply_to"]) or [item["in_reply_to"]]
            sent = db.query(ProspectingActivity).filter(ProspectingActivity.message_id.in_(referenced_ids)).order_by(ProspectingActivity.occurred_at.desc()).first()
            prospect = db.get(Prospect, sent.prospect_id) if sent else None
        if not prospect:
            prospect = db.query(Prospect).filter(Prospect.email == item["from_email"]).order_by(Prospect.created_at.desc()).first()
        if not prospect:
            unmatched += 1
            continue
        db.add(ProspectingActivity(
            prospect_id=prospect.id,
            kind="email_received",
            channel="email",
            direction="inbound",
            subject=item["subject"],
            body=item["body"],
            message_id=item["message_id"],
            thread_key=item["in_reply_to"] or item["message_id"],
            status="received",
            occurred_at=item["occurred_at"],
        ))
        prospect.status = "replied"
        prospect.next_action_at = None
        prospect.last_contact_at = item["occurred_at"]
        added += 1
    db.commit()
    return {"added": added, "unmatched": unmatched}


async def process_due_followups(db: Session) -> dict[str, int]:
    due = db.query(Prospect).filter(
        Prospect.contact_permission.is_(True),
        Prospect.status == "emailing",
        Prospect.next_action_at.is_not(None),
        Prospect.next_action_at <= datetime.now(timezone.utc),
        Prospect.follow_up_step < 3,
    ).all()
    sent = 0
    skipped = 0
    for prospect in due:
        company = prospect.trade_name or prospect.company_name
        if prospect.follow_up_step == 1:
            subject = f"Re: diagnóstico de controle de ponto — {company}"
            body = "Olá! Retomando nossa conversa: posso separar 15 minutos para mostrar as opções de ponto em nuvem, aplicativo e equipamentos Topdata. Qual horário funciona melhor?"
        else:
            subject = f"Re: diagnóstico de controle de ponto — {company}"
            body = "Olá! Este é meu último retorno sobre o diagnóstico gratuito de controle de ponto. Se fizer sentido revisar a jornada da equipe, fico à disposição para agendarmos uma demonstração online."
        try:
            result = await send_prospect_email(db, prospect, subject, body, automatic=True)
            if result.get("sent"):
                sent += 1
            else:
                skipped += 1
        except HTTPException:
            skipped += 1
    return {"due": len(due), "sent": sent, "skipped": skipped}
