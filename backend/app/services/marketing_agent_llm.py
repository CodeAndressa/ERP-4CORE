from __future__ import annotations

"""Chamada de modelo de texto para a esteira, com medição de consumo.

Existe separado do `ai_service` porque a esteira precisa de duas coisas que o chat
não precisa: a resposta sempre em JSON e o uso da chamada devolvido junto, para o
passo conseguir registrar quanto custou.

Groq e OpenRouter falam o mesmo dialeto (formato OpenAI), então a única diferença
real é a URL, a chave e o fato de o OpenRouter informar o custo da chamada.
"""

import asyncio
import json
import re
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.services.marketing_agent_cost import Usage, text_usage
from app.services.groq_service import groq_error_detail, groq_model_id

GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions"


def text_provider() -> tuple[str, str, str, dict[str, str]]:
    """Qual provedor atende o texto: (nome, endpoint, modelo, cabeçalhos).

    O Groq vem primeiro quando existe, porque é o que já está em produção e é mais
    rápido. O OpenRouter só assume o texto se tiver sido configurado um modelo de
    texto nele de propósito, para ninguém trocar de provedor sem querer só por ter
    colado a chave para gerar imagem.
    """
    if settings.groq_api_key:
        return (
            "groq",
            GROQ_ENDPOINT,
            groq_model_id(),
            {"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
        )
    if settings.openrouter_api_key and settings.openrouter_text_model.strip():
        return (
            "openrouter",
            OPENROUTER_ENDPOINT,
            settings.openrouter_text_model.strip(),
            {
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": settings.openrouter_site_url,
                "X-Title": "ERP 4Core",
            },
        )
    raise HTTPException(503, "Configure GROQ_API_KEY ou OPENROUTER_API_KEY com um modelo de texto.")


def has_text_model() -> bool:
    try:
        text_provider()
    except HTTPException:
        return False
    return True


# Teto por espera. O limite do Groq gratuito e por minuto, entao a janela sempre
# vira em menos de 60s; esperar mais que isso so prenderia a tela a toa.
MAX_RETRY_WAIT_SECONDS = 30.0
MAX_RETRIES = 2


def _retry_after_seconds(response: httpx.Response) -> float | None:
    """Quantos segundos o provedor pediu para esperar, ou None se nao disse.

    O `retry-after` vem em segundos puros. O `x-ratelimit-reset-tokens` do Groq vem
    como duracao ("12.5s", "1m30s", "500ms"), por isso os dois formatos.
    """
    bruto = response.headers.get("retry-after") or response.headers.get("x-ratelimit-reset-tokens")
    if not bruto:
        return None
    texto = str(bruto).strip()
    try:
        return float(texto)
    except ValueError:
        pass
    total = 0.0
    achou = False
    for valor, unidade in re.findall(r"([\d.]+)\s*(ms|s|m|h)", texto):
        try:
            numero = float(valor)
        except ValueError:
            continue
        total += numero * {"ms": 0.001, "s": 1.0, "m": 60.0, "h": 3600.0}[unidade]
        achou = True
    return total if achou else None


async def _post_with_retry(
    endpoint: str, headers: dict[str, str], body: dict[str, Any], timeout: float
) -> httpx.Response:
    """Repete a chamada quando o provedor responde 429 dizendo quando libera.

    Sem isso o revisor de texto caia sempre: o analista e o estrategista gastam a
    cota do minuto e o revisor chega sem saldo, a poucos segundos da janela virar.
    Desistir ali deixava a peca sem a revisao que existe justamente para ela nao
    parecer escrita por maquina.
    """
    async with httpx.AsyncClient(timeout=timeout) as client:
        for tentativa in range(MAX_RETRIES + 1):
            response = await client.post(endpoint, headers=headers, json=body)
            if response.status_code != 429 or tentativa == MAX_RETRIES:
                return response
            espera = _retry_after_seconds(response)
            # Sem cabecalho nao da para saber se espera 1s ou 10 minutos, entao
            # devolve o 429 em vez de dormir no escuro.
            if espera is None or espera > MAX_RETRY_WAIT_SECONDS:
                return response
            await asyncio.sleep(espera + 0.5)
        return response


async def ask_json(
    system_prompt: str,
    payload: Any,
    action: str,
    temperature: float = 0.5,
    timeout: float = 90.0,
) -> tuple[dict[str, Any], Usage]:
    """Uma pergunta, uma resposta em JSON, e o consumo da chamada.

    `action` entra só na mensagem de erro mostrada na tela ("não foi possível
    <action> com a IA"), para o usuário saber qual agente falhou.
    """
    provider, endpoint, model, headers = text_provider()
    body = {
        "model": model,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False, default=str)},
        ],
    }
    if provider == "openrouter":
        # Sem isso o OpenRouter devolve `usage` sem o campo `cost` e o painel cairia
        # para custo estimado mesmo tendo o número real disponível.
        body["usage"] = {"include": True}

    response = await _post_with_retry(endpoint, headers, body, timeout)

    if response.status_code >= 400:
        if provider == "groq":
            raise HTTPException(502, groq_error_detail(response, action))
        if response.status_code in {401, 403}:
            raise HTTPException(502, "O OpenRouter recusou a chave. Confira OPENROUTER_API_KEY.")
        if response.status_code == 429:
            raise HTTPException(502, "O limite de uso do OpenRouter foi atingido. Tente mais tarde.")
        raise HTTPException(502, f"Não foi possível {action} com a IA agora.")

    try:
        data = response.json()
        content = json.loads(data["choices"][0]["message"]["content"])
    except (KeyError, IndexError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(502, f"A IA devolveu um formato inválido ao {action}.") from exc
    if not isinstance(content, dict):
        raise HTTPException(502, f"A IA devolveu um formato inválido ao {action}.")
    return content, text_usage(provider, model, data)
