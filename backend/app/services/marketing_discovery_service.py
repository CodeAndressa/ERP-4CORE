from __future__ import annotations

"""Descoberta de concorrentes a partir das hashtags do setor.

O que a API da Meta permite, e o que ela não permite, porque isso define o formato
da entrega e custou um dia para descobrir:

- **Busca por hashtag funciona.** `ig_hashtag_search` resolve o nome em um id e
  `top_media` / `recent_media` devolvem as publicações mais relevantes.
- **Mas elas não dizem quem publicou.** A Meta remove o autor dos resultados de
  hashtag. Pedir `username` ou `owner` responde "Please read documentation for
  supported fields". Não existe caminho oficial de hashtag para perfil.
- **A Business Discovery exige o @ exato.** Adivinhar handle a partir do nome da
  marca não funciona: num teste com 13 variações plausíveis de marcas reais do
  setor, uma única resolveu, e era um perfil de moda sem relação com o assunto.

Então a descoberta automática de @ não é possível pela via oficial. O que dá, e é
o que este módulo faz, é ler as legendas de quem publica nessas hashtags e extrair
os NOMES das marcas ativas, com o trecho que sustenta cada uma. A pessoa confere e
informa o @ de quem quiser acompanhar, o que é uma busca de poucos segundos.

Raspagem resolveria o resto, e por isso não está aqui: viola os termos da Meta e
colocaria a conta da 4Core em risco de bloqueio.
"""

import re
from typing import Any

import httpx
from fastapi import HTTPException

from app.core.config import settings
from app.services.marketing_agent_cost import Usage
from app.services.marketing_agent_llm import ask_json, has_text_model
from app.services.meta_marketing_service import MetaMarketingService

# Hashtags do setor de ponto e acesso. Servem de ponto de partida; a tela deixa
# trocar por outras.
DEFAULT_HASHTAGS = [
    "controledeponto",
    "pontofacial",
    "controledeacesso",
    "relogiodeponto",
    "pontoeletronico",
]

# A Meta limita a 30 hashtags consultadas por conta a cada 7 dias. Gastar isso em
# uma rodada deixaria a semana inteira sem busca, por isso o teto baixo.
MAX_HASHTAGS_PER_RUN = 5

BRAND_PROMPT = """Você recebe legendas de publicações do Instagram brasileiro sobre
controle de ponto, ponto eletrônico, biometria facial e controle de acesso.

Liste as EMPRESAS e MARCAS desse setor que aparecem citadas.

Regras:
- Só nome próprio de empresa que vende, fabrica ou revende esse tipo de produto ou serviço.
- Ignore pessoa física, cidade, órgão público e termo genérico.
- Separe empresa de produto. "Topdata" é empresa; "Inner Ponto 4" e "EVO 50 Facial"
  são produtos, e nesse caso informe a empresa quando a legenda disser qual é.
- Não repita a mesma marca com grafias diferentes. Prefira a forma completa.
- Não invente: toda marca precisa de um trecho da legenda que a sustente.

Responda em JSON:
{
  "marcas": [
    {
      "nome": "nome da empresa",
      "tipo": "fabricante | revenda | software | servico",
      "evidencia": "trecho curto da legenda onde ela aparece"
    }
  ]
}"""


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


async def _hashtag_id(client: httpx.Client, base: str, ig_id: str, token: str, tag: str) -> str:
    response = client.get(
        f"{base}/ig_hashtag_search",
        params={"user_id": ig_id, "q": tag, "access_token": token},
    )
    payload = response.json()
    if payload.get("error") or not payload.get("data"):
        return ""
    return str(payload["data"][0].get("id") or "")


async def collect_captions(hashtags: list[str], per_tag: int = 18) -> dict[str, Any]:
    """Legendas de quem publica nas hashtags informadas.

    Só `top_media`: o `recent_media` traz muito post de pessoa física reclamando do
    próprio ponto, que polui a extração sem acrescentar marca."""
    service = MetaMarketingService()
    ig_id = await service.get_instagram_account_id()
    _, token = await service._page_token_async(None, None)
    base = f"https://graph.facebook.com/{service.graph_version}"

    captions: list[str] = []
    used: list[str] = []
    failed: list[str] = []

    with httpx.Client(timeout=90) as client:
        for tag in hashtags[:MAX_HASHTAGS_PER_RUN]:
            clean_tag = re.sub(r"[^a-z0-9]", "", tag.lower().lstrip("#"))
            if not clean_tag:
                continue
            try:
                hashtag_id = await _hashtag_id(client, base, ig_id, token, clean_tag)
                if not hashtag_id:
                    failed.append(clean_tag)
                    continue
                response = client.get(
                    f"{base}/{hashtag_id}/top_media",
                    params={"user_id": ig_id, "fields": "caption,permalink", "limit": per_tag, "access_token": token},
                )
                payload = response.json()
                if payload.get("error"):
                    failed.append(clean_tag)
                    continue
                captions.extend(
                    _clean(item.get("caption", ""))[:200]
                    for item in payload.get("data", [])
                    if item.get("caption")
                )
                used.append(clean_tag)
            except httpx.HTTPError:
                failed.append(clean_tag)

    return {"captions": captions, "hashtags_used": used, "hashtags_failed": failed}


async def discover_brands(hashtags: list[str] | None = None) -> tuple[dict[str, Any], Usage | None]:
    tags = [tag for tag in (hashtags or DEFAULT_HASHTAGS) if tag.strip()]
    collected = await collect_captions(tags)

    if not collected["captions"]:
        raise HTTPException(
            502,
            "Nenhuma publicação foi encontrada nessas hashtags. Confirme a grafia, sem espaço e sem acento, "
            "e lembre que a Meta limita a 30 hashtags consultadas por semana.",
        )
    if not has_text_model():
        raise HTTPException(503, "Configure GROQ_API_KEY para extrair as marcas das legendas.")

    result, usage = await ask_json(
        BRAND_PROMPT,
        {"legendas": collected["captions"][:40]},
        "encontrar as marcas",
        temperature=0.2,
    )

    seen: set[str] = set()
    brands: list[dict[str, str]] = []
    for item in result.get("marcas") or []:
        if not isinstance(item, dict):
            continue
        name = _clean(str(item.get("nome") or ""))[:80]
        key = re.sub(r"[^a-z0-9]", "", name.lower())
        if not name or key in seen or len(key) < 3:
            continue
        seen.add(key)
        brands.append(
            {
                "nome": name,
                "tipo": _clean(str(item.get("tipo") or ""))[:30],
                "evidencia": _clean(str(item.get("evidencia") or ""))[:200],
                # Busca pronta no Instagram, porque a API nao entrega o @ e esse e
                # o caminho mais curto entre o nome da marca e o perfil dela.
                "busca_instagram": f"https://www.instagram.com/explore/search/keyword/?q={name.replace(' ', '%20')}",
            }
        )

    return {
        "brands": brands[:25],
        "captions_analyzed": len(collected["captions"][:40]),
        "hashtags_used": collected["hashtags_used"],
        "hashtags_failed": collected["hashtags_failed"],
    }, usage
