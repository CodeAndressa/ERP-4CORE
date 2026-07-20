from __future__ import annotations

import json
from typing import Any

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.commercial import Lead, Proposal
from app.models.contracts import Contract
from app.models.marketing import MarketingContent
from app.services.asaas_service import AsaasService, AsaasUnavailable
from app.services.meta_marketing_service import MetaMarketingService
from app.services.site_analytics_service import SiteAnalyticsNotConfigured, get_site_dashboard


class AIUnavailable(Exception):
    pass


class AIService:
    endpoint = "https://api.groq.com/openai/v1/chat/completions"

    async def _financeiro_context(self) -> dict[str, Any]:
        try:
            overview = await AsaasService().overview()
        except AsaasUnavailable as exc:
            return {"error": str(exc)}
        overdue_sample = [item for item in overview.get("payments", []) if item.get("status") == "OVERDUE"][:8]
        return {
            "account_balance": overview.get("account_balance"),
            "received_value": overview.get("received_value"),
            "confirmed_value": overview.get("confirmed_value"),
            "pending_value": overview.get("pending_value"),
            "overdue_value": overview.get("overdue_value"),
            "overdue_count": overview.get("overdue_count"),
            "customers_total": overview.get("customers_total"),
            "overdue_payments_sample": overdue_sample,
        }

    def _comercial_context(self, db: Session) -> dict[str, Any]:
        leads = db.query(Lead).order_by(Lead.updated_at.desc()).limit(300).all()
        by_status: dict[str, int] = {}
        by_stage: dict[str, int] = {}
        for lead in leads:
            by_status[lead.status] = by_status.get(lead.status, 0) + 1
            by_stage[lead.stage] = by_stage.get(lead.stage, 0) + 1
        open_leads = [
            {
                "name": lead.name,
                "company": lead.company,
                "stage": lead.stage,
                "value_potential": lead.value_potential,
                "next_action": lead.next_action,
                "next_contact_date": str(lead.next_contact_date) if lead.next_contact_date else None,
            }
            for lead in leads
            if lead.stage not in {"fechado", "perdido"}
        ][:10]
        return {
            "leads_total": len(leads),
            "leads_by_status": by_status,
            "leads_by_stage": by_stage,
            "open_leads_sample": open_leads,
        }

    def _propostas_context(self, db: Session) -> dict[str, Any]:
        proposals = db.query(Proposal).order_by(Proposal.updated_at.desc()).limit(300).all()
        by_status: dict[str, int] = {}
        for proposal in proposals:
            by_status[proposal.status] = by_status.get(proposal.status, 0) + 1
        open_proposals = [
            {
                "code": proposal.code,
                "client": proposal.client,
                "title": proposal.title,
                "value_total": proposal.value_total,
                "status": proposal.status,
                "next_action": proposal.next_action,
            }
            for proposal in proposals
            if proposal.status not in {"aprovada", "perdida"}
        ][:10]
        return {
            "proposals_total": len(proposals),
            "proposals_by_status": by_status,
            "proposals_value_total": round(sum(proposal.value_total or 0 for proposal in proposals), 2),
            "open_proposals_sample": open_proposals,
        }

    def _clientes_context(self, db: Session) -> dict[str, Any]:
        contracts = db.query(Contract).order_by(Contract.created_at.desc()).limit(300).all()
        active = [contract for contract in contracts if contract.status == "ativo"]
        return {
            "contracts_total": len(contracts),
            "active_contracts": len(active),
            "active_value_total": round(sum(contract.value or 0 for contract in active), 2),
            "contracts_sample": [
                {
                    "client_name": contract.client_name,
                    "title": contract.title,
                    "status": contract.status,
                    "value": contract.value,
                    "end_date": str(contract.end_date) if contract.end_date else None,
                }
                for contract in contracts[:10]
            ],
        }

    async def _marketing_context(self, db: Session) -> dict[str, Any]:
        content_counts: dict[str, int] = dict(
            db.query(MarketingContent.status, func.count(MarketingContent.id)).group_by(MarketingContent.status).all()
        )
        recent_posts: list[dict[str, Any]] = []
        try:
            media = await MetaMarketingService().instagram_media()
            recent_posts = [
                {
                    "caption": str(item.get("caption", ""))[:200],
                    "like_count": item.get("like_count"),
                    "comments_count": item.get("comments_count"),
                    "timestamp": item.get("timestamp"),
                }
                for item in media[:8]
            ]
        except Exception:
            pass
        return {"content_by_status": content_counts, "recent_instagram_posts": recent_posts}

    async def _site_context(self) -> dict[str, Any]:
        try:
            site_data = await get_site_dashboard(30)
        except (SiteAnalyticsNotConfigured, Exception):
            return {"error": "Analytics do site nao configurado."}
        return {
            "summary": site_data["summary"],
            "top_pages": site_data["top_pages"][:5],
            "sources": site_data["sources"][:5],
            "devices": site_data["devices"],
        }

    async def _operacao_context(self, db: Session) -> dict[str, Any]:
        financeiro = await self._financeiro_context()
        marketing = await self._marketing_context(db)
        return {
            "financeiro_resumo": {
                "overdue_value": financeiro.get("overdue_value"),
                "overdue_count": financeiro.get("overdue_count"),
                "pending_value": financeiro.get("pending_value"),
            },
            "comercial_resumo": self._comercial_context(db).get("leads_by_stage"),
            "propostas_resumo": self._propostas_context(db).get("proposals_by_status"),
            "clientes_resumo": {
                "active_contracts": self._clientes_context(db).get("active_contracts"),
            },
            "marketing_resumo": marketing.get("content_by_status"),
        }

    async def _context(self, scope: str, db: Session) -> dict[str, Any]:
        if scope == "financeiro":
            return await self._financeiro_context()
        if scope == "comercial":
            return self._comercial_context(db)
        if scope == "propostas":
            return self._propostas_context(db)
        if scope == "clientes":
            return self._clientes_context(db)
        if scope == "marketing":
            return await self._marketing_context(db)
        if scope == "site":
            return await self._site_context()
        return await self._operacao_context(db)

    async def analyze(self, scope: str, instructions: str, db: Session, include_actions: bool = False) -> dict[str, Any]:
        if not settings.groq_api_key:
            raise AIUnavailable("Configure GROQ_API_KEY no backend.")
        context = await self._context(scope, db)
        if include_actions:
            system = """Você é a consultora estratégica interna da 4Core. Gere recomendações objetivas em português do Brasil, baseadas apenas nos dados reais fornecidos em "connected_data" para a área "scope" selecionada. Não invente métricas, clientes ou resultados que não estejam no contexto. Quando o contexto vier com "error" ou vazio, declare isso e proponha o próximo dado necessário, em vez de generalizar. Responda APENAS JSON válido neste formato: {"headline": string, "summary": string, "actions": [{"area": string, "priority": "alta|media|baixa", "title": string, "rationale": string, "recommended_action": string}]}. Retorne no máximo 5 actions."""
        else:
            system = """Você é a consultora estratégica interna da 4Core. Responda de forma direta e objetiva, em português do Brasil, baseada apenas nos dados reais fornecidos em "connected_data" para a área "scope" selecionada. Não invente métricas, clientes ou resultados que não estejam no contexto. Quando o contexto vier com "error" ou vazio, declare isso objetivamente. Sem listas de ações recomendadas, sugestões de orçamento ou ideias de conteúdo — só a resposta direta à pergunta. Responda APENAS JSON válido neste formato: {"headline": string, "summary": string}. headline é um título curto (até 8 palavras); summary é a resposta objetiva, em 1 a 3 frases."""
        user = json.dumps({"scope": scope, "instructions": instructions or "Faça uma análise acionável do contexto disponível.", "connected_data": context}, ensure_ascii=False)
        payload = {"model": settings.groq_model, "temperature": 0.35, "response_format": {"type": "json_object"}, "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
        headers = {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=45.0) as client:
            response = await client.post(self.endpoint, headers=headers, json=payload)
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        try:
            result = json.loads(content)
        except json.JSONDecodeError as exc:
            raise AIUnavailable("A resposta do Groq não estava no formato esperado.") from exc
        return {"scope": scope, "context_available": context, "analysis": result}
