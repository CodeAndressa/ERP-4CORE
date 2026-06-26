from __future__ import annotations

import json
from typing import Any

import httpx

from app.core.config import settings
from app.services.site_analytics_service import SiteAnalyticsNotConfigured, get_site_dashboard


class AIUnavailable(Exception):
    pass


class AIService:
    endpoint = "https://api.groq.com/openai/v1/chat/completions"

    async def _context(self) -> dict[str, Any]:
        context: dict[str, Any] = {"site_metrics": None}
        try:
            site_data = await get_site_dashboard(30)
            context["site_metrics"] = {"summary": site_data["summary"], "top_pages": site_data["top_pages"][:5], "sources": site_data["sources"][:5], "devices": site_data["devices"]}
        except (SiteAnalyticsNotConfigured, Exception):
            pass
        return context

    async def analyze(self, scope: str, instructions: str = "") -> dict[str, Any]:
        if not settings.groq_api_key:
            raise AIUnavailable("Configure GROQ_API_KEY no backend.")
        context = await self._context()
        system = """Você é a consultora estratégica interna da 4Core. Gere recomendações objetivas em português do Brasil. Não invente métricas, clientes ou resultados que não estejam no contexto. Quando a fonte de dados não existir, declare isso e proponha o próximo dado necessário. Em sugestões orçamentárias, trate valores como estimativas gerenciais, não como aconselhamento financeiro profissional. Responda APENAS JSON válido neste formato: {\"headline\": string, \"summary\": string, \"actions\": [{\"area\": string, \"priority\": \"alta|media|baixa\", \"title\": string, \"rationale\": string, \"recommended_action\": string}], \"budget_suggestions\": [{\"title\": string, \"suggestion\": string}], \"content_ideas\": [{\"title\": string, \"format\": string, \"angle\": string}]}. Retorne no máximo 5 actions, 3 budget_suggestions e 4 content_ideas."""
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