from __future__ import annotations

"""Contabilidade de custo da esteira de marketing.

Cada agente que chama um modelo registra aqui quanto consumiu. Existem duas
qualidades de número e a diferença importa na hora de olhar o painel:

- **medido**: o provedor devolveu o custo da chamada (OpenRouter faz isso em
  `usage.cost`). É o valor real cobrado.
- **estimado**: só vieram os tokens, e o custo sai da tabela de preços abaixo.
  Preço de modelo muda, então estimativa envelhece e a tela avisa quando o número
  é estimado em vez de medido.

Nada aqui chama API. O módulo só converte uso em dinheiro.
"""

from dataclasses import dataclass, field
from typing import Any

# Preço por milhão de tokens, em dólar. Usado só quando o provedor não devolve o
# custo da chamada. Conferir em console.groq.com/docs/pricing e openrouter.ai/models
# quando a conta não bater com o painel do provedor.
TEXT_PRICES_USD_PER_MTOK: dict[str, tuple[float, float]] = {
    # modelo: (entrada, saída)
    "openai/gpt-oss-120b": (0.15, 0.75),
    "openai/gpt-oss-20b": (0.10, 0.50),
}
# Os criativos rodam no OpenRouter, que informa o custo real da chamada. A tabela
# existe para o caso de a resposta vir sem `usage.cost`, e os valores sao os
# publicados em openrouter.ai/models, conferidos em 16/11/2026.
TEXT_PRICES_USD_PER_MTOK.update({
    "anthropic/claude-haiku-5.5": (0.10, 0.50),
    "anthropic/claude-sonnet-5": (2.00, 10.00),
})

DEFAULT_TEXT_PRICE = (0.20, 0.80)

# Preço por imagem, em dólar, para 1080x1350 (cerca de 1,46 megapixel).
# FLUX.2 Klein 4B no OpenRouter cobra por megapixel: 0,014 no primeiro e 0,001 nos
# seguintes, o que dá cerca de 0,0145 por arte nesse tamanho.
IMAGE_PRICES_USD: dict[str, float] = {
    "black-forest-labs/flux.2-klein-4b": 0.0145,
    "qwen/qwen-image-2.1-turbo": 0.0184,
    "@cf/black-forest-labs/flux-2-klein-4b": 0.0,
    "@cf/black-forest-labs/flux-1-schnell": 0.0,
}
DEFAULT_IMAGE_PRICE = 0.02

# A Cloudflare cobra por neurônio dentro de uma franquia diária, e não por imagem.
# Dentro da franquia o custo marginal é zero, por isso os modelos @cf entram com
# 0.0 acima. Gastar além da franquia aparece na fatura da Cloudflare, não aqui.
FREE_WITHIN_ALLOWANCE = {"cloudflare"}

# Provedores com plano gratuito de verdade. Quando o custo veio da tabela e o
# provedor e um destes, o numero e referencia de quanto aquilo valeria, e nao
# algo que entrou numa fatura. Sem essa distincao a tela mostrava alguns milesimos
# de dolar para quem nao pagou nada e nao tinha como saber disso.
HAS_FREE_TIER = {"groq", "cloudflare"}


@dataclass
class Usage:
    """O que uma chamada de modelo consumiu."""

    provider: str = ""
    model: str = ""
    input_tokens: int = 0
    output_tokens: int = 0
    images: int = 0
    cost_usd: float = 0.0
    measured: bool = False
    notes: str = field(default="")

    @property
    def billed(self) -> bool:
        """Se este consumo provavelmente virou cobranca de verdade."""
        return self.cost_usd > 0 and (self.measured or self.provider not in HAS_FREE_TIER)

    def as_dict(self) -> dict[str, Any]:
        return {
            "provider": self.provider,
            "model": self.model,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "images": self.images,
            "cost_usd": round(self.cost_usd, 6),
            "measured": self.measured,
            "billed": self.billed,
            "notes": self.notes,
        }


def text_usage(provider: str, model: str, payload: dict[str, Any]) -> Usage:
    """Le o bloco `usage` de uma resposta no formato OpenAI. Groq e OpenRouter usam
    o mesmo formato; o OpenRouter ainda acrescenta `cost`, que é o valor real."""
    raw = payload.get("usage") or {}
    input_tokens = int(raw.get("prompt_tokens") or 0)
    output_tokens = int(raw.get("completion_tokens") or 0)

    reported = raw.get("cost")
    if isinstance(reported, (int, float)) and reported > 0:
        return Usage(provider, model, input_tokens, output_tokens, 0, float(reported), measured=True)

    price_in, price_out = TEXT_PRICES_USD_PER_MTOK.get(model, DEFAULT_TEXT_PRICE)
    cost = (input_tokens * price_in + output_tokens * price_out) / 1_000_000
    return Usage(provider, model, input_tokens, output_tokens, 0, cost, measured=False)


def image_usage(provider: str, model: str, count: int = 1, reported_cost: float | None = None) -> Usage:
    if reported_cost is not None and reported_cost > 0:
        return Usage(provider, model, images=count, cost_usd=float(reported_cost), measured=True)
    if provider in FREE_WITHIN_ALLOWANCE:
        return Usage(
            provider,
            model,
            images=count,
            cost_usd=0.0,
            measured=False,
            notes="Dentro da franquia diária da Cloudflare, sem custo marginal por imagem.",
        )
    price = IMAGE_PRICES_USD.get(model, DEFAULT_IMAGE_PRICE)
    return Usage(provider, model, images=count, cost_usd=price * count, measured=False)


def total(usages: list[Usage]) -> dict[str, Any]:
    """Soma de uma esteira. `fully_measured` é falso se qualquer parcela foi
    estimada, para a tela não apresentar aproximação como valor cobrado."""
    if not usages:
        return {"cost_usd": 0.0, "input_tokens": 0, "output_tokens": 0, "images": 0, "fully_measured": True}
    return {
        "cost_usd": round(sum(item.cost_usd for item in usages), 6),
        "billed_usd": round(sum(item.cost_usd for item in usages if item.billed), 6),
        "input_tokens": sum(item.input_tokens for item in usages),
        "output_tokens": sum(item.output_tokens for item in usages),
        "images": sum(item.images for item in usages),
        "fully_measured": all(item.measured or item.cost_usd == 0 for item in usages),
        "free_tier_only": not any(item.billed for item in usages),
    }


# ─── Saldo da conta de imagem ────────────────────────────────────────────────

OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits"


async def openrouter_credits() -> dict[str, Any]:
    """Quanto ainda há de crédito no OpenRouter.

    Devolve `configured: False` em vez de erro quando a chave não está posta: a
    tela mostra o saldo ao lado dos outros números da esteira, e uma chave
    ausente não deve derrubar o painel inteiro."""
    import httpx

    from app.core.config import settings

    key = (settings.openrouter_api_key or "").strip()
    if not key:
        return {"configured": False}

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            response = await client.get(
                OPENROUTER_CREDITS_URL,
                headers={"Authorization": f"Bearer {key}"},
            )
    except httpx.HTTPError:
        return {"configured": True, "error": "Não foi possível falar com o OpenRouter agora."}

    if response.status_code in {401, 403}:
        return {"configured": True, "error": "O OpenRouter recusou a chave. Confira OPENROUTER_API_KEY."}
    if response.status_code >= 400:
        return {"configured": True, "error": "O OpenRouter não respondeu o saldo agora."}

    data = (response.json() or {}).get("data") or {}
    total = float(data.get("total_credits") or 0.0)
    usado = float(data.get("total_usage") or 0.0)
    return {
        "configured": True,
        "total_usd": round(total, 4),
        "used_usd": round(usado, 4),
        "balance_usd": round(max(total - usado, 0.0), 4),
    }


def image_price_usd(model: str = "") -> float:
    """O preço de uma arte no modelo em uso, para estimar quantas ainda cabem."""
    from app.core.config import settings

    alvo = model or settings.openrouter_image_model
    return IMAGE_PRICES_USD.get(alvo, DEFAULT_IMAGE_PRICE)
