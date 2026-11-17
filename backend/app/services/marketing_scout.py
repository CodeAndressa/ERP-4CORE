"""O Batedor: procura o que está performando acima da média e liga à 4Core.

O que ele faz que o analista não fazia
--------------------------------------
O `analista` compara a 4Core com os concorrentes em números agregados: quantos
posts por semana, qual engajamento médio, quem está na frente. Isso responde
"como estamos", e não "sobre o que vale falar".

O Batedor olha publicação por publicação e procura **o que destoou**: o post que
teve muito mais engajamento que a média da própria conta que o publicou. Esse é
o sinal de assunto que pegou, e é diferente de conta grande publicando qualquer
coisa.

Por que a comparação é com a média do próprio autor
---------------------------------------------------
Um post com 400 curtidas num perfil de 50 mil seguidores é fraco; o mesmo
número num perfil de 2 mil é um fenômeno. Comparar números absolutos entre
contas de tamanhos diferentes mede tamanho de audiência, não qualidade de
assunto. A razão entre o post e a média da conta mede o que interessa: o quanto
aquele tema puxou a audiência que já estava lá.

Por que não é multiagente
-------------------------
O plano previa multiagente aqui, pelo argumento de que varredura é a camada onde
ele se paga. Com o número de perfis que a 4Core observa, a varredura é uma busca
paralela e uma única síntese: não há decisão a delegar, nem ramificação, nem
ferramenta a escolher. A própria recomendação da Anthropic é achar a solução
mais simples possível e só aumentar a complexidade quando necessário. Multiagente
aqui custaria 15 vezes mais para produzir o mesmo resultado.

Se um dia a lista de perfis observados crescer para dezenas, com buscas por
hashtag e por tema, a conta muda e o padrão passa a valer.
"""

from __future__ import annotations

import logging
import statistics
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# Quanto um post precisa superar a média da própria conta para contar como
# achado. 1,8 é alto de propósito: com poucas publicações por conta, qualquer
# corte mais baixo transforma oscilação normal em "tendência", que é exatamente
# a superstição que a pesquisa alerta.
DESTAQUE_MINIMO = 1.8

# Abaixo disso a média não significa nada e a razão vira ruído.
MINIMO_DE_POSTS = 4

# Janela da varredura. Assunto de Instagram em B2B tem vida curta; o que pegou
# há três meses não é pauta, é histórico.
JANELA_DIAS = 45

SCOUT_PROMPT = """Você é o batedor de conteúdo da 4Core, empresa brasileira de controle
de ponto, controle de acesso e conformidade com a Portaria 671.

Você recebe publicações que performaram ACIMA DA MÉDIA da própria conta que as
publicou, no setor que a 4Core observa. Para cada uma, responda uma coisa só:
isso dá pauta para a 4Core, e qual?

Regras:
- Se o assunto não tiver ligação honesta com ponto, jornada, acesso ou risco
  trabalhista, diga que não serve. Forçar a ligação produz peça artificial, e é
  melhor devolver três achados bons que oito forçados.
- A pauta é sobre o ASSUNTO que funcionou, nunca sobre copiar a peça. Não
  descreva a arte do outro nem sugira imitar o formato dele.
- Não invente número, dado ou lei. Você só tem o que está no payload.
- O gancho é curto, em português, e fala do problema de quem lê, não da 4Core.

Responda somente JSON:
{"achados": [{"fonte": "@perfil", "assunto": "o que funcionou, em uma frase",
 "por_que_pegou": "a razão provável, em uma frase",
 "pauta": "o título da pauta para a 4Core",
 "brief": "dois períodos dizendo o que a peça deve abordar"}]}

Devolva no máximo 5 achados, e só os que realmente servem."""


def _engajamento(post: dict[str, Any]) -> int:
    return int(post.get("like_count") or 0) + int(post.get("comments_count") or 0)


def destaques_do_perfil(username: str, posts: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Os posts que destoaram da média da própria conta.

    A mediana entra no lugar da média de propósito: um único post viral puxaria
    a média para cima e esconderia todos os outros destaques da conta, que é o
    oposto do que se quer medir.
    """
    recentes = []
    limite = datetime.now(timezone.utc) - timedelta(days=JANELA_DIAS)
    for post in posts:
        quando = post.get("timestamp") or post.get("posted_at")
        if not quando:
            continue
        try:
            data = datetime.fromisoformat(str(quando).replace("Z", "+00:00"))
        except ValueError:
            continue
        if data >= limite:
            recentes.append({**post, "_quando": data})

    if len(recentes) < MINIMO_DE_POSTS:
        return []

    valores = [_engajamento(post) for post in recentes]
    base = statistics.median(valores)
    if base <= 0:
        return []

    achados = []
    for post in recentes:
        razao = _engajamento(post) / base
        if razao < DESTAQUE_MINIMO:
            continue
        achados.append({
            "fonte": f"@{username}",
            "razao": round(razao, 1),
            "engajamento": _engajamento(post),
            "mediana_da_conta": round(base),
            "legenda": (post.get("caption") or "")[:400],
            "formato": post.get("media_type") or "",
            "link": post.get("permalink") or "",
            "quando": post["_quando"].date().isoformat(),
        })
    return sorted(achados, key=lambda item: item["razao"], reverse=True)


async def scan(db: Session, extras: list[str] | None = None) -> dict[str, Any]:
    """Varre os perfis observados e devolve o que destoou, já ligado à 4Core.

    Varre quem já está cadastrado como concorrente, mais os perfis extras que a
    chamada pedir. Não há lista secreta de perfis do setor embutida no código:
    inventar handles que talvez não existam produziria erro silencioso, e a lista
    que importa é a que a empresa escolhe observar.
    """
    from app.services.marketing_agent_llm import ask_json, has_text_model
    from app.services.marketing_brand_system import hoje_block
    from app.services.marketing_competitor_service import list_competitors
    from app.services.meta_marketing_service import MetaMarketingService

    perfis = [competitor.username for competitor in list_competitors(db, only_active=True)]
    perfis += [nome.strip().lstrip("@") for nome in (extras or []) if nome.strip()]
    perfis = list(dict.fromkeys(perfis))

    if not perfis:
        return {
            "achados": [],
            "perfis_lidos": 0,
            "aviso": "Nenhum perfil observado. Cadastre concorrentes para o batedor ter o que ler.",
        }

    servico = MetaMarketingService()
    destaques: list[dict[str, Any]] = []
    falhas: list[str] = []

    for username in perfis:
        try:
            perfil = await servico.business_discovery(username, media_limit=24)
        except Exception as exc:  # noqa: BLE001
            # Um perfil privado, apagado ou fora do ar não pode derrubar a
            # varredura inteira: os outros ainda valem.
            logger.warning("batedor: %s falhou (%s)", username, type(exc).__name__)
            falhas.append(username)
            continue
        posts = (perfil.get("media") or {}).get("data") or []
        destaques.extend(destaques_do_perfil(username, posts))

    destaques.sort(key=lambda item: item["razao"], reverse=True)
    destaques = destaques[:12]

    if not destaques:
        return {
            "achados": [],
            "perfis_lidos": len(perfis) - len(falhas),
            "falhas": falhas,
            "aviso": (
                "Nada destoou da média nos últimos 45 dias. Isso é um resultado, não "
                "um erro: significa que o setor publicou dentro do padrão dele."
            ),
        }

    if not has_text_model():
        return {"achados": [], "perfis_lidos": len(perfis) - len(falhas), "destaques": destaques}

    resultado, usage = await ask_json(
        SCOUT_PROMPT + hoje_block(),
        {"publicacoes_que_destoaram": destaques},
        "ler o que está performando",
        temperature=0.4,
        creative=True,
    )

    achados = [
        achado for achado in (resultado.get("achados") or [])
        if isinstance(achado, dict) and str(achado.get("pauta") or "").strip()
    ][:5]

    return {
        "achados": achados,
        "perfis_lidos": len(perfis) - len(falhas),
        "falhas": falhas,
        "destaques_brutos": len(destaques),
        "cost_usd": usage.cost_usd,
    }
