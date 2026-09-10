from __future__ import annotations

from typing import Any

import httpx

from app.core.config import settings


DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"

# IDs removidos do GroqCloud. Manter a tradução aqui permite que ambientes já
# publicados continuem funcionando mesmo antes de a variável GROQ_MODEL ser
# atualizada na Vercel.
DEPRECATED_GROQ_MODELS = {
    "llama-3.3-70b-versatile": DEFAULT_GROQ_MODEL,
    "llama-3.1-8b-instant": "openai/gpt-oss-20b",
    "qwen/qwen3-32b": DEFAULT_GROQ_MODEL,
    "meta-llama/llama-4-scout-17b-16e-instruct": DEFAULT_GROQ_MODEL,
}


def groq_model_id() -> str:
    configured = (settings.groq_model or "").strip()
    return DEPRECATED_GROQ_MODELS.get(configured, configured or DEFAULT_GROQ_MODEL)


def groq_error_detail(response: httpx.Response, action: str) -> str:
    """Transforma a resposta técnica do Groq em uma mensagem segura para a UI."""
    code = ""
    message = ""
    try:
        error: Any = response.json().get("error", {})
        if isinstance(error, dict):
            code = str(error.get("code") or "")
            message = str(error.get("message") or "")
    except (TypeError, ValueError):
        pass

    if code == "model_not_found" or "does not exist" in message.lower():
        return (
            "O modelo de IA configurado não está disponível. "
            f"Atualize GROQ_MODEL para {DEFAULT_GROQ_MODEL}."
        )
    if response.status_code == 429:
        return "O limite temporário da IA foi atingido. Aguarde um instante e tente novamente."
    return f"Não foi possível {action} com a IA agora. Tente novamente em instantes."
