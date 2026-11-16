"""Mensagens diretas do Instagram via "Instagram API com Login do Instagram".

Produto separado do Meta app de Facebook Login já usado pelo resto do marketing
(meta_marketing_service.py, que fala com graph.facebook.com usando token de Página).
Este serviço fala com graph.instagram.com usando um Instagram User Access Token
gerado direto no painel de desenvolvedor da Meta (app "4Core ERP-IG"), guardado
via token_store — não existe fluxo de OAuth próprio aqui, o token chega pronto.
"""
from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.services import token_store

GRAPH_VERSION = "v23.0"
BASE_URL = f"https://graph.instagram.com/{GRAPH_VERSION}"


async def _stored(key: str, fallback: str = "") -> str:
    value = await token_store.aget(f"instagram_login_{key}")
    return value or fallback


async def credentials() -> tuple[str, str]:
    """Retorna (access_token, ig_user_id) — token_store tem prioridade sobre o .env."""
    token = await _stored("access_token", settings.instagram_login_access_token)
    user_id = await _stored("user_id", settings.instagram_login_user_id)
    return token, user_id


# Token do Instagram Login dura cerca de 60 dias e so pode ser renovado depois de
# 24 horas de vida. Renovar com folga de 15 dias da varias chances de recuperacao
# antes de morrer: se uma rodada semanal falhar, ainda sobram duas.
REFRESH_WHEN_DAYS_LEFT = 15


def _days_left(expires_at: str) -> int | None:
    if not expires_at:
        return None
    try:
        moment = datetime.fromisoformat(expires_at)
    except ValueError:
        return None
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return (moment - datetime.now(timezone.utc)).days


async def is_configured() -> bool:
    token, user_id = await credentials()
    return bool(token and user_id)


async def _token_alive(token: str) -> tuple[bool, str]:
    """Pergunta a Meta se o token ainda vale.

    Existe porque a data de validade pode nao ter sido guardada: o `connect` so
    grava `expires_at` quando a troca pelo token de 60 dias devolve `expires_in`,
    e quando ela falha o token curto entra sem data nenhuma. Sem data, a conta de
    dias nao diz nada, e era por isso que a tela mostrava saudavel com o token
    morto."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{BASE_URL}/me", params={"fields": "user_id", "access_token": token})
    except httpx.HTTPError:
        # Rede caida nao e token invalido: nao vale acusar o token por isso.
        return True, ""
    if r.status_code < 400:
        return True, ""
    return False, dm_error_detail(r, "abrir as mensagens")


async def status(verify: bool = True) -> dict[str, Any]:
    """Estado da conexao de mensagens.

    `configured` diz que existe token guardado; `healthy` diz que ele ainda vale.
    Os dois existem separados porque a tela mostrava "Conectado" com o token
    vencido ha uma semana, so porque o campo nao estava vazio."""
    token, user_id = await credentials()
    username = await _stored("username")
    expires_at = await _stored("expires_at")
    days = _days_left(expires_at)
    expired = days is not None and days < 0

    # Sem data guardada, a unica fonte de verdade e a propria Meta.
    token_error = ""
    if verify and token and user_id and not expired and days is None:
        alive, token_error = await _token_alive(token)
        if not alive:
            expired = True

    return {
        "configured": bool(token and user_id),
        "user_id": user_id,
        "username": username,
        "token": f"{token[:6]}...{token[-4:]}" if len(token) > 12 else ("***" if token else ""),
        "expires_at": expires_at or None,
        "days_left": days,
        "expired": expired,
        "expiring_soon": bool(days is not None and 0 <= days <= REFRESH_WHEN_DAYS_LEFT),
        "healthy": bool(token and user_id and not expired),
        "token_error": token_error or None,
    }


def dm_error_detail(response: httpx.Response, acao: str) -> str:
    """Transforma a resposta da Graph em uma frase que diz o que fazer.

    A versao anterior mandava `r.text[:220]` para a tela, e a pessoa via o JSON da
    Meta inteiro, com "OAuthException" e data em PST. O caso mais comum, de longe,
    e o token de 60 dias que venceu sem ninguem perceber.
    """
    codigo = 0
    mensagem = ""
    try:
        erro = response.json().get("error", {}) or {}
        codigo = int(erro.get("code") or 0)
        mensagem = str(erro.get("message") or "")
    except (AttributeError, TypeError, ValueError):
        pass
    baixo = mensagem.lower()

    if codigo == 190 or "access token" in baixo or "session has expired" in baixo:
        quando = ""
        marcador = "expired on "
        if marcador in baixo:
            trecho = mensagem[baixo.index(marcador) + len(marcador):].split(".")[0].strip()
            # So a data interessa; o fuso PST da Meta nao diz nada para quem le.
            if trecho:
                quando = f" Ele venceu em {trecho.split(' PST')[0].strip()}."
        return (
            "O token das mensagens do Instagram expirou." + quando +
            " A Meta nao renova token vencido: reconecte em Marketing > Conexoes."
        )
    if codigo in {4, 17, 32, 613} or "rate limit" in baixo or "too many calls" in baixo:
        return "A Meta limitou as chamadas por enquanto. Tente de novo em alguns minutos."
    if codigo in {10, 200, 803} or "permission" in baixo:
        return (
            "A conexao com a Meta perdeu a permissao de mensagens. "
            "Reconecte em Marketing > Conexoes."
        )
    if mensagem:
        return f"A Meta recusou {acao}: {mensagem[:160]}"
    return f"Nao foi possivel {acao} agora."


async def _resolve_profile(token: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{BASE_URL}/me", params={"fields": "user_id,username", "access_token": token})
    if r.status_code >= 400:
        raise HTTPException(502, dm_error_detail(r, "validar o token"))
    return r.json()


async def _exchange_long_lived(short_token: str) -> dict[str, Any]:
    if not settings.instagram_login_app_secret:
        raise HTTPException(503, "Configure INSTAGRAM_LOGIN_APP_SECRET no backend antes de conectar.")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            "https://graph.instagram.com/access_token",
            params={
                "grant_type": "ig_exchange_token",
                "client_secret": settings.instagram_login_app_secret,
                "access_token": short_token,
            },
        )
    if r.status_code >= 400:
        raise HTTPException(502, dm_error_detail(r, "gerar o token de longa duração"))
    return r.json()


async def connect(raw_token: str) -> dict[str, Any]:
    """Troca o token colado na tela por um de longa duração (~60 dias), resolve o
    usuário do Instagram e persiste tudo via token_store. Se a troca falhar (ex.: app
    ainda sem o "Login da empresa no Instagram" configurado no painel da Meta), cai
    de volta pro token curto original — ele funciona normalmente até expirar, só não
    dura ~60 dias."""
    long_token = raw_token
    expires_in: int | None = None
    exchange_warning = ""
    try:
        exchanged = await _exchange_long_lived(raw_token)
        long_token = exchanged.get("access_token") or raw_token
        expires_in = exchanged.get("expires_in")
    except HTTPException as exc:
        exchange_warning = str(exc.detail)

    profile = await _resolve_profile(long_token)
    user_id = str(profile.get("user_id") or "")
    username = str(profile.get("username") or "")
    if not user_id:
        raise HTTPException(502, "A Meta não retornou o ID da conta do Instagram para este token.")

    expires_at = (
        (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))).isoformat()
        if expires_in else ""
    )
    await token_store.asave({
        "instagram_login_access_token": long_token,
        "instagram_login_user_id": user_id,
        "instagram_login_username": username,
        "instagram_login_expires_at": expires_at,
    })
    result = await status(verify=False)
    if exchange_warning:
        result["exchange_warning"] = (
            "Conectado com o token original (curta duração) — a troca por um token de "
            f"~60 dias falhou: {exchange_warning}"
        )
    return result


async def refresh() -> dict[str, Any]:
    token, _ = await credentials()
    if not token:
        raise HTTPException(409, "Nenhum token conectado ainda.")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            "https://graph.instagram.com/refresh_access_token",
            params={"grant_type": "ig_refresh_token", "access_token": token},
        )
    if r.status_code >= 400:
        raise HTTPException(502, dm_error_detail(r, "renovar o token"))
    body = r.json()
    new_token = body.get("access_token", token)
    expires_in = body.get("expires_in")
    expires_at = (
        (datetime.now(timezone.utc) + timedelta(seconds=int(expires_in))).isoformat()
        if expires_in else ""
    )
    await token_store.asave({"instagram_login_access_token": new_token, "instagram_login_expires_at": expires_at})
    return await status(verify=False)


async def list_conversations() -> list[dict[str, Any]]:
    token, my_id = await credentials()
    if not token or not my_id:
        raise HTTPException(409, "Conecte o token de mensagens do Instagram antes de listar conversas.")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{BASE_URL}/{my_id}/conversations",
            params={
                "platform": "instagram",
                "fields": "participants,messages.limit(20){id,message,from,created_time}",
                "access_token": token,
            },
        )
    if r.status_code >= 400:
        raise HTTPException(502, dm_error_detail(r, "listar as conversas"))

    conversations = []
    for item in r.json().get("data", []):
        participants = (item.get("participants") or {}).get("data", [])
        other = next((p for p in participants if str(p.get("id")) != my_id), None)
        messages = (item.get("messages") or {}).get("data", [])
        messages_sorted = sorted(messages, key=lambda m: m.get("created_time") or "", reverse=True)
        last = messages_sorted[0] if messages_sorted else None
        conversations.append({
            "id": item.get("id"),
            "participant_id": other.get("id") if other else None,
            "participant_username": other.get("username") if other else None,
            "last_message": last.get("message") if last else "",
            "last_message_at": last.get("created_time") if last else None,
            "last_from_me": bool(last and str((last.get("from") or {}).get("id")) == my_id),
        })
    conversations.sort(key=lambda c: c.get("last_message_at") or "", reverse=True)
    return conversations


async def conversation_messages(conversation_id: str) -> list[dict[str, Any]]:
    token, my_id = await credentials()
    if not token:
        raise HTTPException(409, "Conecte o token de mensagens do Instagram antes de abrir uma conversa.")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(
            f"{BASE_URL}/{conversation_id}",
            params={"fields": "messages.limit(50){id,message,from,created_time}", "access_token": token},
        )
    if r.status_code >= 400:
        raise HTTPException(502, dm_error_detail(r, "abrir a conversa"))
    messages = (r.json().get("messages") or {}).get("data", [])
    return [
        {
            "id": m.get("id"),
            "text": m.get("message", ""),
            "created_at": m.get("created_time"),
            "from_me": str((m.get("from") or {}).get("id")) == my_id,
        }
        for m in sorted(messages, key=lambda m: m.get("created_time") or "")
    ]


DM_DRAFT_PROMPT = """
Você responde mensagens diretas do Instagram da 4Core.

{marca}

COMO RESPONDER
- Escreva como uma pessoa da equipe comercial escreve no direct: curto, claro e
  cordial, no máximo 4 linhas. Sem saudação formal de e-mail, sem "prezado".
- Responda a pergunta que foi feita. Se a pessoa pediu preço, diga que o valor
  depende do número de funcionários e do modelo do equipamento, e ofereça fazer
  uma proposta.
- Nunca invente preço, prazo, desconto, estoque, nome de cliente nem número de
  contrato. Se não houver essa informação na conversa, diga que vai confirmar.
- Nunca prometa o que depende de aprovação.
- Se a mensagem for elogio ou emoji solto, agradeça em uma linha e pare.
- Termine com uma pergunta ou um próximo passo concreto quando houver intenção
  de compra; não termine com pergunta quando a conversa já se encerrou.

Devolva JSON:
{{"resposta": "o texto pronto para enviar", "intencao": "duvida|preco|suporte|elogio|outro"}}
""".strip()


async def suggest_reply(conversation_id: str) -> dict[str, Any]:
    """Um rascunho de resposta para a última mensagem da conversa.

    Devolve o texto, nunca envia. Quem decide o que vai para o cliente continua
    sendo a pessoa, que recebe isso dentro do campo de resposta."""
    from .marketing_agent_llm import ask_json, has_text_model
    from .marketing_brand_system import FOURCORE_BRAND_SYSTEM

    if not has_text_model():
        raise HTTPException(409, "Configure a chave da IA de texto para gerar rascunhos.")

    mensagens = await conversation_messages(conversation_id)
    if not mensagens:
        raise HTTPException(409, "Esta conversa não tem mensagem para responder.")
    if mensagens[-1].get("from_me"):
        raise HTTPException(409, "A última mensagem é sua. Não há o que responder ainda.")

    # Só as últimas doze: a janela de contexto que importa num direct é curta, e
    # mandar cinquenta mensagens encarece a chamada sem melhorar a resposta.
    recorte = [
        {"quem": "4core" if m["from_me"] else "cliente", "texto": m["text"]}
        for m in mensagens[-12:]
        if (m.get("text") or "").strip()
    ]

    conteudo, usage = await ask_json(
        DM_DRAFT_PROMPT.format(marca=FOURCORE_BRAND_SYSTEM),
        {"conversa": recorte},
        "escrever a resposta",
        temperature=0.4,
        timeout=40.0,
    )
    texto = str(conteudo.get("resposta") or "").strip()
    if not texto:
        raise HTTPException(502, "A IA não devolveu um rascunho de resposta.")
    return {
        "text": texto,
        "intent": str(conteudo.get("intencao") or "outro"),
        "cost_usd": usage.cost_usd,
    }


async def send_message(recipient_id: str, text: str) -> dict[str, Any]:
    token, my_id = await credentials()
    if not token or not my_id:
        raise HTTPException(409, "Conecte o token de mensagens do Instagram antes de responder.")
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.post(
            f"{BASE_URL}/{my_id}/messages",
            data={
                "recipient": json.dumps({"id": recipient_id}),
                "message": json.dumps({"text": text}),
                "access_token": token,
            },
        )
    if r.status_code >= 400:
        raise HTTPException(502, dm_error_detail(r, "enviar a resposta"))
    return r.json()


def verify_webhook_signature(app_secret: str, body: bytes, signature_header: str | None) -> bool:
    if not app_secret or not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.removeprefix("sha256="))
async def refresh_if_needed(force: bool = False) -> dict[str, Any]:
    """Renova o token quando ele esta perto de vencer. E o que a rotina semanal chama.

    Token expirado nao volta: a Meta recusa o refresh de um token morto, e so a
    reconexao manual resolve. Por isso a rotina avisa em vez de tentar em silencio,
    e por isso a folga de 15 dias existe."""
    token, _ = await credentials()
    if not token:
        return {"action": "skipped", "reason": "Nenhum token de mensagens conectado.", "healthy": False}

    expires_at = await _stored("expires_at")
    days = _days_left(expires_at)

    if days is not None and days < 0:
        return {
            "action": "expired",
            "reason": (
                f"O token venceu ha {abs(days)} dias. A Meta nao renova token expirado: "
                "e preciso reconectar em Marketing > Conexoes."
            ),
            "healthy": False,
            "days_left": days,
        }

    if not force and days is not None and days > REFRESH_WHEN_DAYS_LEFT:
        return {"action": "not_needed", "days_left": days, "healthy": True}

    try:
        result = await refresh()
    except HTTPException as exc:
        return {"action": "failed", "reason": str(exc.detail), "healthy": False, "days_left": days}
    return {"action": "refreshed", "healthy": True, "days_left": _days_left(result.get("expires_at") or ""), "status": result}

