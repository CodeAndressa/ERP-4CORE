from __future__ import annotations

"""A esteira de marketing: vários agentes em sequência, cada um com uma função.

A ordem importa e cada passo recebe o que o anterior produziu:

1. **Analista de concorrência** le os perfis observados e compara com o da 4Core.
2. **Estrategista de pauta** transforma as lacunas em temas.
3. **Redator** escreve gancho, legenda e conceito visual de cada peça.
4. **Revisor de texto** critica o que o redator escreveu: português, cara de IA,
   promessa que a marca não pode fazer, chamada fraca. Devolve a versão corrigida.
5. **Diretor de arte** traduz o conceito aprovado em instrução para o gerador.
6. **Ilustrador** gera a arte de feed 4:5 e compõe a marca por cima.
7. **Agendador** calcula o melhor horário e distribui as peças na cadência pedida.

Cada passo vira uma linha em `MarketingAgentStep` com tempo e custo, que é o que
alimenta o painel. Nenhum passo publica: a esteira termina em peça aguardando
aprovação, com data e hora já sugeridas.
"""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import logging
import time as time_module
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.marketing import MarketingAgentRun, MarketingAgentStep, MarketingContent
from app.services.marketing_agent_cost import HAS_FREE_TIER, Usage, total as total_cost
from app.services.marketing_agent_llm import ask_json, has_text_model
from app.services.marketing_art_learning import learned_guidance
from app.services.marketing_brand_system import (
    FOURCORE_BRAND_SYSTEM,
    VOZ_HUMANA,
    build_copy_system_prompt,
    hoje_block,
    build_image_prompt,
    match_product,
    match_risk_fact,
    normalize_pt_br_text,
    sentence_case,
)
from app.services.marketing_art_critic import (
    MAX_REDOS,
    critique_art,
    instrucao_de_correcao,
)
from app.services.marketing_asset_service import read_art_bytes
from app.services.marketing_competitor_service import build_benchmark, sync_all
from app.services.marketing_seasonal import (
    SEASONAL_CALENDAR,
    active_theme,
    theme_brief,
    theme_by_key,
    theme_palette,
    theme_visual,
)
from app.services.marketing_content_service import (
    generate_art_with_usage,
    image_model_available,
    scene_model_available,
)
from app.services.marketing_schedule_service import plan as plan_schedule

logger = logging.getLogger(__name__)

MAX_IDEAS_PER_RUN = 6

# A ordem desta lista é a esteira. A tela desenha os nós a partir daqui, então
# acrescentar um agente aqui já o faz aparecer no painel.
AGENT_ROSTER: list[dict[str, str]] = [
    {
        "key": "analista",
        "name": "Analista de concorrência",
        "role": "Lê os perfis observados e compara com o @4coreconsultoria",
    },
    {
        "key": "estrategista",
        "name": "Estrategista de pauta",
        "role": "Transforma as lacunas encontradas em temas de publicação",
    },
    {
        "key": "diretor_criacao",
        "name": "Diretor de criação",
        "role": "Decide o ângulo da peça antes de alguém escrever uma linha",
    },
    {
        "key": "redator",
        "name": "Redator",
        "role": "Escreve o gancho da arte, a legenda e o conceito visual",
    },
    {
        "key": "revisor_texto",
        "name": "Revisor de texto",
        "role": "Corrige português, tira cara de IA e reforça a chamada",
    },
    {
        "key": "diretor_arte",
        "name": "Diretor de arte",
        "role": "Traduz o conceito aprovado em instrução para o gerador de imagem",
    },
    {
        "key": "ilustrador",
        "name": "Ilustrador",
        "role": "Gera a arte 4:5 e compõe a marca por cima",
    },
    {
        "key": "critico_arte",
        "name": "Crítico de arte",
        "role": "Olha a arte pronta e devolve para refazer quando ela não passa",
    },
    {
        "key": "agendador",
        "name": "Agendador",
        "role": "Define data e hora de cada publicação na cadência pedida",
    },
]


def _iso_utc(value: datetime | None) -> str | None:
    """ISO com fuso, para um horario gravado em UTC.

    O SQLite devolve datetime sem tzinfo mesmo com `DateTime(timezone=True)`, e
    `isoformat()` sem fuso faz o `new Date()` do navegador ler o horario como se
    fosse local. Era o que punha a esteira 3 horas no futuro na tela.
    """
    if value is None:
        return None
    return (value if value.tzinfo else value.replace(tzinfo=timezone.utc)).isoformat()


# Como cada layout aparece no painel da esteira.
ROTULO_TEMPLATE = {
    "produto": "Arte de produto: {produto}.",
    "comparativo": "Comparativo: {produto}.",
    "dado": "Peça de dado: {numero}.",
    "cena": "Cena com o produto real.",
    "foto": "Arte de feed gerada.",
}


# ─── Registro dos passos ───────────────────────────────────────────────────────


class StepRecorder:
    """Acumula os passos de uma rodada. Grava cada um assim que termina, para uma
    falha no meio da esteira deixar visível até onde chegou."""

    def __init__(self, db: Session, run_id: int) -> None:
        self.db = db
        self.run_id = run_id
        self.sequence = 0
        self.usages: list[Usage] = []

    @asynccontextmanager
    async def step(self, agent: str, content_id: int | None = None):
        self.sequence += 1
        started = time_module.perf_counter()
        record = MarketingAgentStep(
            run_id=self.run_id,
            content_id=content_id,
            agent=agent,
            sequence=self.sequence,
            status="running",
        )
        self.db.add(record)
        self.db.commit()

        box: dict[str, Any] = {"summary": "", "usage": None}
        try:
            yield box
        except Exception as exc:
            record.status = "failed"
            record.error_message = str(getattr(exc, "detail", exc))[:2000]
            record.duration_ms = int((time_module.perf_counter() - started) * 1000)
            self.db.commit()
            raise
        else:
            usage: Usage | None = box.get("usage")
            if usage:
                record.provider = usage.provider[:30]
                record.model = usage.model[:120]
                record.input_tokens = usage.input_tokens
                record.output_tokens = usage.output_tokens
                record.images = usage.images
                record.cost_usd = usage.cost_usd
                record.cost_measured = usage.measured
                self.usages.append(usage)
            record.summary = str(box.get("summary") or "")[:2000]
            record.status = "done"
            record.duration_ms = int((time_module.perf_counter() - started) * 1000)
            self.db.commit()


# ─── Prompts dos agentes ───────────────────────────────────────────────────────


STRATEGIST_PROMPT = f"""Você é o estrategista de conteúdo da 4Core.

{FOURCORE_BRAND_SYSTEM}

Você recebe um comparativo em JSON entre o perfil da 4Core e os concorrentes dela no
Instagram, com seguidores, frequência de publicação, taxa de engajamento, formatos e
os posts que mais engajaram de cada um.

Analise com honestidade. Se a 4Core está bem em algo, diga; se está atrás, diga o
número. Nunca invente dado que não está no JSON: campo zerado ou ausente é "sem
medição", não estimativa.

Responda SEMPRE em JSON válido, em português do Brasil:
{{
  "leitura": "2 a 4 frases sobre onde a 4Core está em relação ao mercado observado",
  "pontos_fortes": ["frase curta"],
  "lacunas": ["frase curta com número quando houver"],
  "recomendacoes": [{{"acao": "o que fazer, concreto", "motivo": "o dado que sustenta"}}],
  "pautas": [
    {{
      "title": "título curto da publicação",
      "pillar": "conformidade | gestão de ponto | controle de acesso | RH e DP | produto | consultoria",
      "objective": "o que esta peça precisa provocar em quem lê",
      "brief": "3 a 5 linhas com o ângulo, o que falar e o que evitar",
      "por_que_agora": "o sinal do comparativo que justifica essa pauta"
    }}
  ]
}}

Regras das pautas: no máximo 6, nenhuma repetindo tema já publicado pela 4Core nas
legendas recentes, cada uma puxando de uma lacuna ou de um formato que funciona nos
concorrentes. Não copie legenda de concorrente: use o padrão, nunca o texto.
Não use travessão longo em nenhum texto."""


REVIEWER_PROMPT = f"""Você é o revisor de texto da 4Core. Você não escreve a peça: você
reprova o que está fraco e devolve corrigido.

{VOZ_HUMANA}

{FOURCORE_BRAND_SYSTEM}

Recebe o gancho da arte e a legenda escritos pelo redator. Verifique, nesta ordem:

1. ORTOGRAFIA: português do Brasil com acentuação e cedilha corretos. Palavra sem
   acento é erro e reprova a peça.
2. CARA DE IA: reprove clichê de texto gerado por máquina. Sinais: "no mundo de hoje",
   "em um cenário cada vez mais", "revolucionar", "potencializar", "descubra como",
   "não é apenas X, é Y", "imagine poder", entusiasmo vazio, adjetivo empilhado,
   frase que poderia ser de qualquer empresa de qualquer setor, simetria perfeita
   entre as frases, emoji decorando cada linha.
3. TEXTO DE FOLHETO: reprove qualquer palavra da lista proibida da voz acima, e
   reprove gerúndio em cadeia ("registrando, eliminando, garantindo"). Reprove
   também frase com três verbos: ela precisa virar duas frases.
4. ABERTURA: a primeira linha é uma cena concreta, com hora, lugar, pessoa ou
   objeto. Reprove abertura que começa pelo nome da categoria ("Ponto inteligente
   evita multas", "O reconhecimento facial é"), que é título de catálogo.
5. RESPIRO: a legenda tem 3 ou 4 parágrafos curtos separados por linha em branco.
   Bloco único de texto reprova, mesmo quando o conteúdo está certo.
6. VOZ DA MARCA: especialista, segura, direta e humana. Alguém que já resolveu esse
   problema várias vezes falando com quem está vivendo ele agora. Nada de alarmismo,
   nada de vendedor.
7. PROMESSA: reprove número, percentual, selo, certificação ou garantia que não foi
   fornecido. A 4Core não promete resultado quantificado.
8. FECHO: ou uma pergunta específica, que alguém responderia porque é sobre a
   rotina dela ("Quantas batidas você ajusta na mão todo mês?"), ou um convite
   curto e direto. Reprove o pedido genérico de engajamento ("compartilhe nos
   comentários", "conte pra gente", "comente aqui embaixo") e reprove pergunta
   fechada que se responde com "sim".
9. GANCHO COMPLETO: o headline vai sozinho na arte, em letra grande, sem a legenda
   ao lado. Ele precisa fechar sentido por si. Reprove frase cortada no meio, como
   "Horas extras não registradas custam" ou "O que acontece quando o ponto", que
   deixam o leitor esperando o resto que nunca vem.

Responda SEMPRE em JSON válido:
{{
  "aprovado": true ou false,
  "nota": número de 0 a 10,
  "problemas": ["o que estava errado, uma frase cada"],
  "headline_final": "o gancho corrigido, 3 a 8 palavras, com sentido completo",
  "caption_final": "a legenda corrigida e pronta para publicar"
}}

Mesmo aprovando, devolva headline_final e caption_final preenchidos: se não houver o
que mudar, repita o texto recebido. Não use travessão longo."""


ART_DIRECTOR_PROMPT = f"""Você é o diretor de arte da 4Core.

{FOURCORE_BRAND_SYSTEM}

Recebe o gancho aprovado e o conceito visual do redator. Sua função é decidir a
imagem de fundo da peça de feed 4:5.

TODA CENA TEM TRÊS CAMADAS, E NENHUMA É OPCIONAL

1. GENTE. Pelo menos uma pessoa brasileira real trabalhando, pega no meio da
   tarefa, de perfil ou de três quartos, nunca olhando para a câmera e nunca
   sorrindo para ela. Quem aparece é quem vive o problema do gancho: a analista
   de DP conferindo o espelho de ponto, o encarregado liberando a entrada do
   turno, o gestor fechando a folha. Cena sem pessoa é cena reprovada.

2. O SISTEMA EM USO. O equipamento ou a tela precisa estar sendo usado, não
   posando. Um dedo no leitor biométrico, um rosto a meio metro do terminal
   facial, um monitor com a jornada do mês aberta e a pessoa apontando uma
   divergência, um tablet com o relatório na mão de quem caminha pelo setor.
   Descreva o gesto, não o aparelho parado numa bancada.

3. A EMPRESA EM VOLTA. O lugar tem de ser reconhecível como uma empresa
   brasileira de verdade, com desgaste: parede pintada, papelada empilhada,
   piso marcado, crachá de visitante na mesa, cadeira surrada. Varie o setor
   conforme o tema do gancho, escolhendo um destes:
   obra com equipe de capacete; galpão de logística com empilhadeira ao fundo;
   recepção de clínica; piso de fábrica com linha de produção; retaguarda de
   loja; portaria de condomínio; corredor de hospital; refeitório no fim do
   turno; sala de DP com arquivos; catraca na entrada de um escritório.
   Não repita "escritório moderno iluminado": é o ambiente que a concorrência
   toda usa e o que faz a peça parecer banco de imagem.

Lembre que a aplicação desenha depois, por cima da sua imagem: o gancho em tipografia
grande alinhado à esquerda, um filete violeta, o logo da 4Core e o endereço do site,
tudo na metade de baixo. Então a metade inferior da sua imagem precisa ser área
calma, sem rosto, sem texto e sem elemento importante.

Responda SEMPRE em JSON válido:
{{
  "visual_concept": "a cena, em inglês, num parágrafo só, nomeando quem é a pessoa e o que ela faz, o gesto com o sistema e o setor da empresa",
  "visual_constraints": "o que não pode aparecer, em inglês",
  "justificativa": "uma frase em português dizendo por que essa cena serve a esse gancho"
}}"""


# ─── Agentes ───────────────────────────────────────────────────────────────────


def _compact_profile(profile: dict[str, Any], posts: int = 3, caption_chars: int = 160) -> dict[str, Any]:
    """Versão enxuta de um perfil para caber no prompt.

    O comparativo cru carrega legendas inteiras de 15 publicações mais os posts
    de cada concorrente. Isso passava de 5 mil tokens em uma chamada só e batia no
    limite por minuto do Groq, derrubando a esteira no segundo agente. O modelo
    também não precisa do texto completo: o que ele usa é o padrão, não a redação."""
    if not profile:
        return {}
    keep = (
        "username", "followers_count", "posts_analyzed", "posts_per_week",
        "avg_likes", "avg_comments", "engagement_rate", "engagement_from_history",
        "days_since_last_post", "is_silent", "formats",
    )
    compact = {key: profile[key] for key in keep if key in profile}
    compact["top_hashtags"] = (profile.get("top_hashtags") or [])[:8]
    compact["top_posts"] = [
        {
            "media_type": post.get("media_type"),
            "like_count": post.get("like_count"),
            "comments_count": post.get("comments_count"),
            "caption": (post.get("caption") or "")[:caption_chars],
        }
        for post in (profile.get("top_posts") or [])[:posts]
    ]
    return compact


async def agent_estrategista(
    benchmark: dict[str, Any], tema: dict[str, Any] | None = None
) -> tuple[dict[str, Any], Usage | None]:
    if not has_text_model():
        return _fallback_strategy(benchmark), None
    payload = {
        "perfil_4core": _compact_profile(benchmark.get("own", {}), posts=4, caption_chars=220),
        "concorrentes": [_compact_profile(item) for item in (benchmark.get("competitors") or [])[:6]],
        "mercado": benchmark.get("market", {}),
        "janela_dias": benchmark.get("window_days"),
    }
    # O tema entra no system prompt, e nao no payload: e regra da rodada, com o
    # mesmo peso das regras da marca, nao mais um dado para o modelo ponderar.
    sistema = STRATEGIST_PROMPT + theme_brief(tema)
    result, usage = await ask_json(
        sistema + hoje_block(), payload, "analisar os concorrentes", temperature=0.5
    )
    return {
        "leitura": normalize_pt_br_text(str(result.get("leitura") or ""))[:2000],
        "pontos_fortes": [normalize_pt_br_text(str(item))[:300] for item in (result.get("pontos_fortes") or [])][:8],
        "lacunas": [normalize_pt_br_text(str(item))[:300] for item in (result.get("lacunas") or [])][:8],
        "recomendacoes": [
            {
                "acao": normalize_pt_br_text(str(item.get("acao") or ""))[:300],
                "motivo": normalize_pt_br_text(str(item.get("motivo") or ""))[:300],
            }
            for item in (result.get("recomendacoes") or [])
            if isinstance(item, dict)
        ][:8],
        "pautas": [
            {
                "title": normalize_pt_br_text(str(item.get("title") or ""))[:180],
                "pillar": str(item.get("pillar") or "").strip()[:60],
                "objective": normalize_pt_br_text(str(item.get("objective") or ""))[:500],
                "brief": normalize_pt_br_text(str(item.get("brief") or ""))[:2000],
                "por_que_agora": normalize_pt_br_text(str(item.get("por_que_agora") or ""))[:400],
            }
            for item in (result.get("pautas") or [])
            if isinstance(item, dict) and str(item.get("title") or "").strip()
        ][:MAX_IDEAS_PER_RUN],
        "sem_ia": False,
    }, usage


def _fallback_strategy(benchmark: dict[str, Any]) -> dict[str, Any]:
    """Sem modelo de texto configurado a esteira não para: ela entrega o que os
    números já dizem sozinhos e avisa na tela que a leitura está sem IA."""
    market = benchmark.get("market", {})
    own = benchmark.get("own", {})
    lacunas = []
    if market.get("cadence_gap", 0) < 0:
        lacunas.append(
            f"A 4Core publica {own.get('posts_per_week', 0)} vezes por semana contra "
            f"{market.get('avg_posts_per_week', 0)} da média dos concorrentes."
        )
    if market.get("engagement_gap", 0) < 0:
        lacunas.append(
            f"A taxa de engajamento está em {own.get('engagement_rate', 0)}% contra "
            f"{market.get('avg_engagement_rate', 0)}% da média observada."
        )
    return {
        "leitura": "Leitura sem IA: configure GROQ_API_KEY ou OPENROUTER_API_KEY para a análise interpretada.",
        "pontos_fortes": [],
        "lacunas": lacunas,
        "recomendacoes": [],
        "pautas": [],
        "sem_ia": True,
    }


CREATIVE_DIRECTOR_PROMPT = """Você é diretor de criação de uma consultoria de
controle de ponto e acesso que fala com decisor de PME e com RH.

Recebe uma pauta já aprovada e decide COMO ela vira peça. Não escreva a peça: a
sua entrega é a decisão que o redator vai seguir.

Escolha um ângulo com tensão. Pauta vira post esquecível quando é tratada como
aula; vira post lido quando aponta um risco concreto, contraria uma crença comum
ou mostra uma consequência que a pessoa não tinha ligado ao assunto.

Regras:
- Um ângulo só. Dois ângulos na mesma peça não cabem em 4:5.
- O ângulo precisa caber numa frase dita em voz alta.
- Nada de promessa sem origem: percentual, prazo e valor só se vierem na pauta.
- Fale de jornada, conformidade e risco trabalhista como quem opera isso, não
  como quem leu sobre isso.

Responda em JSON:
{
  "angulo": "a decisão em uma frase",
  "tensao": "o que incomoda quem lê, em uma frase",
  "elemento_visual": "o que precisa estar na imagem para sustentar o ângulo",
  "tom": "uma palavra: direto | técnico | provocativo | didático"
}"""


async def agent_diretor_criacao(pauta: dict[str, Any], tema: dict[str, Any] | None = None) -> tuple[dict[str, Any], Usage | None]:
    """O ângulo da peça, decidido antes de qualquer linha ser escrita.

    Existe porque o estrategista entrega o tema e o redator saía escrevendo, o que
    produzia peça correta e sem ponto de vista. Quando o modelo não responde, a
    esteira segue sem ele: direção fraca é melhor que peça nenhuma.
    """
    try:
        result, usage = await ask_json(
            CREATIVE_DIRECTOR_PROMPT + theme_brief(tema) + hoje_block(),
            {
                "title": pauta.get("title", ""),
                "brief": pauta.get("brief", ""),
                "objetivo": pauta.get("objective", ""),
                "por_que_agora": pauta.get("por_que_agora", ""),
            },
            "dirigir a criação",
            temperature=0.75,
            creative=True,
        )
    except HTTPException:
        logger.warning("diretor de criacao indisponivel, seguindo com a pauta crua")
        return {}, None
    return {
        "angulo": normalize_pt_br_text(str(result.get("angulo") or "")),
        "tensao": normalize_pt_br_text(str(result.get("tensao") or "")),
        "elemento_visual": str(result.get("elemento_visual") or ""),
        "tom": str(result.get("tom") or ""),
    }, usage


# Quantas peças fotográficas entram na roda para cada peça montada no Pillow.
# Dois é o que faz a fotografia ser a maioria sem apagar a arte de produto, que é
# a única em que o aparelho aparece com fidelidade garantida, da foto do catálogo.
FOTOGRAFICAS_POR_MONTADA = 2


def choose_template(
    product: dict[str, Any] | None,
    fact: dict[str, str] | None,
    seed: int,
    scene_ok: bool,
    image_ok: bool = True,
) -> str:
    """Qual layout a peça usa.

    As opções dependem do que a pauta oferece: comparativo só existe com contraste
    cadastrado, dado só com fato de risco, cena só com produto e com um provedor
    que aceite imagem de entrada.

    Os layouts se dividem em dois tipos, e a diferença é o que explica a regra:

    - **fotográficos** (`cena`, `foto`) passam por modelo de imagem e entregam
      pessoa trabalhando, sistema em uso e ambiente de empresa;
    - **montados** (`produto`, `comparativo`, `dado`) são compostos no Pillow, com
      gradiente, recorte do aparelho e tipografia. Saem sem custo de imagem e sem
      risco de texto ilegível, e justamente por isso saem sem gente e sem ambiente.

    Com rodízio uniforme entre os quatro, só uma peça em três ou quatro chegava a
    ser uma fotografia, e o feed ficava com cara de template. A roda agora põe
    duas fotográficas para cada montada, intercaladas: a fotografia é a maioria e
    duas peças seguidas continuam não repetindo layout.

    O desempate continua sendo o id da peça. Sortear repetiria layout em sequência
    com frequência alta, e guardar o último usado pediria coluna nova no banco por
    uma decisão que o próprio id já resolve.
    """
    fotograficos: list[str] = []
    if product and scene_ok:
        fotograficos.append("cena")
    if image_ok:
        fotograficos.append("foto")

    montados: list[str] = []
    if product:
        montados.append("produto")
        if (product.get("contraste") or {}).get("sem"):
            montados.append("comparativo")
    if fact:
        montados.append("dado")

    if not montados:
        return fotograficos[seed % len(fotograficos)] if fotograficos else "foto"
    if not fotograficos:
        return montados[seed % len(montados)]

    roda: list[str] = []
    for indice, montado in enumerate(montados):
        for passo in range(FOTOGRAFICAS_POR_MONTADA):
            roda.append(fotograficos[(indice * FOTOGRAFICAS_POR_MONTADA + passo) % len(fotograficos)])
        roda.append(montado)
    return roda[seed % len(roda)]


async def agent_redator(
    pauta: dict[str, Any],
    recent_captions: list[str],
    learned: dict[str, str],
    direcao: dict[str, Any] | None = None,
    tema: dict[str, Any] | None = None,
) -> tuple[dict[str, Any], Usage]:
    payload = {
        "title": pauta["title"],
        "brief": pauta["brief"],
        "objetivo": pauta.get("objective", ""),
        # Seis legendas truncadas bastam para o modelo pegar o tom. Doze inteiras
        # custavam mais de mil tokens por peça sem melhorar a redação.
        "recent_instagram_captions": [caption[:260] for caption in recent_captions[:6]],
        "formato": "post de feed 4:5",
    }
    # A direção manda sobre o tema: o redator escreve para sustentar o ângulo, não
    # para cobrir a pauta inteira.
    if direcao and direcao.get("angulo"):
        payload["direcao_de_criacao"] = {
            chave: direcao[chave]
            for chave in ("angulo", "tensao", "elemento_visual", "tom")
            if direcao.get(chave)
        }
    result, usage = await ask_json(
        build_copy_system_prompt(learned.get("copy", "")) + theme_brief(tema),
        payload,
        "escrever a peça",
        temperature=0.6,
        creative=True,
    )
    return {
        "headline": normalize_pt_br_text(str(result.get("headline") or pauta["title"])),
        "caption": normalize_pt_br_text(str(result.get("caption") or "")),
        # O botao da arte. Reserva curta e deliberada: peca sem CTA nenhum foi
        # parte do que a equipe reprovou, entao vazio nao e opcao.
        "cta": normalize_pt_br_text(str(result.get("cta") or "Falar com a 4Core"))[:34],
        "visual_concept": str(result.get("visual_concept") or ""),
        "visual_constraints": str(result.get("visual_constraints") or ""),
    }, usage


async def agent_revisor_texto(draft: dict[str, Any], pauta: dict[str, Any]) -> tuple[dict[str, Any], Usage]:
    payload = {
        "tema": pauta["title"],
        "headline": draft["headline"],
        "caption": draft["caption"],
    }
    result, usage = await ask_json(
        REVIEWER_PROMPT + hoje_block(), payload, "revisar o texto", temperature=0.3, creative=True
    )
    headline = normalize_pt_br_text(str(result.get("headline_final") or draft["headline"]))
    caption = normalize_pt_br_text(str(result.get("caption_final") or draft["caption"]))
    return {
        "aprovado": bool(result.get("aprovado")),
        "nota": float(result.get("nota") or 0),
        "problemas": [normalize_pt_br_text(str(item))[:300] for item in (result.get("problemas") or [])][:8],
        "headline": sentence_case(headline)[:200],
        "caption": caption,
    }, usage


async def agent_diretor_arte(
    headline: str,
    draft: dict[str, Any],
    learned: dict[str, str],
    tema: dict[str, Any] | None = None,
) -> tuple[str, Usage | None]:
    """Devolve o prompt final da imagem. Se o modelo de texto não responder com um
    conceito utilizável, cai no conceito que o redator já tinha escrito: perder o
    refinamento é melhor que derrubar a peça inteira."""
    try:
        result, usage = await ask_json(
            ART_DIRECTOR_PROMPT + theme_brief(tema),
            {"headline": headline, "conceito_do_redator": draft.get("visual_concept", "")},
            "dirigir a arte",
            temperature=0.5,
            creative=True,
        )
        concept = str(result.get("visual_concept") or draft.get("visual_concept") or "")
        constraints = str(result.get("visual_constraints") or draft.get("visual_constraints") or "")
        return (
            build_image_prompt(headline, concept, constraints, learned.get("image", ""))
            + theme_visual(tema),
            usage,
        )
    except HTTPException:
        logger.warning("diretor de arte indisponivel, usando o conceito do redator")
        return build_image_prompt(
            headline,
            draft.get("visual_concept", ""),
            draft.get("visual_constraints", ""),
            learned.get("image", ""),
        ), None


# ─── A esteira ─────────────────────────────────────────────────────────────────


def _existing_titles(db: Session) -> set[str]:
    rows = db.query(MarketingContent.title).order_by(MarketingContent.created_at.desc()).limit(200).all()
    return {" ".join(str(row[0]).lower().split()) for row in rows}


async def run_pipeline(
    db: Session,
    window_days: int = 30,
    sync_first: bool = True,
    content_limit: int = 3,
    layout: str = "feed",
    with_art: bool = True,
    cadence_days: int = 2,
    trigger: str = "manual",
    theme: str = "",
) -> dict[str, Any]:
    # O tema explicito vence o calendario: "rodar com tema Black Friday" em
    # marco e um pedido deliberado, nao um engano. Sem ele, quem decide e a data
    # de hoje, para a esteira automatica nao depender de ninguem lembrar.
    tema_sazonal = theme_by_key(theme) if theme else active_theme()

    run = MarketingAgentRun(status="running", trigger=trigger)
    db.add(run)
    db.commit()
    db.refresh(run)
    recorder = StepRecorder(db, run.id)

    try:
        # 1. Analista de concorrência
        async with recorder.step("analista") as box:
            if sync_first:
                await sync_all(db)
            benchmark = await build_benchmark(db, window_days)
            tracked = benchmark["market"]["competitors_tracked"]
            box["summary"] = f"{tracked} concorrentes lidos, janela de {window_days} dias."

        # 2. Estrategista de pauta
        async with recorder.step("estrategista") as box:
            diagnosis, usage = await agent_estrategista(benchmark, tema_sazonal)
            box["usage"] = usage
            box["summary"] = f"{len(diagnosis['pautas'])} pautas propostas, {len(diagnosis['lacunas'])} lacunas apontadas."

        created: list[dict[str, Any]] = []
        if diagnosis["pautas"] and content_limit > 0:
            created = await _produce(
                db, recorder, diagnosis["pautas"],
                (benchmark.get("own") or {}).get("recent_captions") or [],
                layout, with_art, min(content_limit, MAX_IDEAS_PER_RUN),
                tema_sazonal,
            )

        # 7. Agendador
        async with recorder.step("agendador") as box:
            schedule = await _schedule(db, created, benchmark, cadence_days, layout)
            box["summary"] = schedule["reason"]

        costs = total_cost(recorder.usages)
        run.benchmark_json = json.dumps(benchmark, ensure_ascii=False, default=str)
        run.diagnosis_json = json.dumps({**diagnosis, "schedule": {k: v for k, v in schedule.items() if not k.startswith("_")}}, ensure_ascii=False)
        run.created_content_ids = ",".join(str(entry["content_id"]) for entry in created)[:300]
        run.status = "done"
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(run)

        return {
            **serialize_run(run),
            "benchmark": benchmark,
            "diagnosis": diagnosis,
            "created": created,
            "schedule": {k: v for k, v in schedule.items() if not k.startswith("_")},
            "steps": [serialize_step(step) for step in list_steps(db, run.id)],
            "costs": costs,
        }
    except HTTPException as exc:
        run.status = "failed"
        run.error_message = str(exc.detail)[:2000]
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("falha na esteira de marketing")
        run.status = "failed"
        run.error_message = str(exc)[:2000]
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(500, "A esteira falhou. Confira o histórico para ver em qual agente parou.") from exc


async def _criticar(
    recorder: StepRecorder, content_id: int, art_path: str, headline: str
) -> dict[str, Any] | None:
    """Roda a crítica da arte. Devolve None quando ela própria falha.

    A falha do crítico não pode derrubar a peça: ele é filtro de volume, não
    portão. Se o juiz cair, a arte segue para a aprovação humana sem o parecer,
    que é exatamente como era antes dele existir. Deixar de produzir por causa
    do revisor seria trocar um problema caro por um pior.
    """
    try:
        async with recorder.step("critico_arte", content_id) as box:
            conteudo, _ = await read_art_bytes(art_path)
            veredito, usage = await critique_art(conteudo, headline)
            box["usage"] = usage
            if veredito["aprovado"]:
                box["summary"] = f"Aprovada, nota minima {veredito['nota_minima']:.0f}."
            else:
                pontos = ", ".join(p["dimensao"] for p in veredito["reprovadas"])
                box["summary"] = f"Reprovada em {pontos} (nota {veredito['nota_minima']:.0f})."
        return veredito
    except Exception:
        logger.exception("critica de arte falhou; a peca segue sem o parecer")
        return None


async def _produce(
    db: Session,
    recorder: StepRecorder,
    pautas: list[dict[str, Any]],
    recent_captions: list[str],
    layout: str,
    with_art: bool,
    limit: int,
    tema_sazonal: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Passos 3 a 6, uma vez por peça. Uma peça que falha não derruba as outras:
    ela fica em rascunho com o erro gravado e a esteira segue para a próxima."""
    created: list[dict[str, Any]] = []
    seen = _existing_titles(db)
    learned = await learned_guidance(db)

    for pauta in pautas:
        if len(created) >= limit:
            break
        normalized = " ".join(pauta["title"].lower().split())
        if normalized in seen:
            continue
        seen.add(normalized)

        brief = pauta["brief"]
        if pauta.get("objective"):
            brief = f"{brief}\n\nObjetivo: {pauta['objective']}"
        if pauta.get("por_que_agora"):
            brief = f"{brief}\nSinal do mercado: {pauta['por_que_agora']}"

        item = MarketingContent(
            title=pauta["title"],
            brief=brief[:4000],
            channel="instagram",
            format="image",
            layout=layout,
            status="generating",
        )
        db.add(item)
        db.commit()
        db.refresh(item)

        entry: dict[str, Any] = {
            "content_id": item.id,
            "title": item.title,
            "pillar": pauta.get("pillar", ""),
            "status": item.status,
            "review": {},
            "error": "",
        }
        try:
            async with recorder.step("diretor_criacao", item.id) as box:
                # O tema entra AQUI, e nao so no redator. O angulo da peca e
                # decidido neste passo; sem o tema, a peca ja nasce sem a data e
                # o redator depois fica preso a um angulo que a ignora. Foi por
                # isso que uma rodada pedida como Black Friday saiu sem uma
                # palavra de Black Friday.
                direcao, usage = await agent_diretor_criacao(pauta, tema_sazonal)
                box["usage"] = usage
                box["summary"] = (
                    f"Ângulo: {direcao['angulo'][:80]}" if direcao.get("angulo")
                    else "Sem direção; seguindo com a pauta crua."
                )

            async with recorder.step("redator", item.id) as box:
                draft, usage = await agent_redator(
                    pauta, recent_captions, learned, direcao, tema_sazonal
                )
                box["usage"] = usage
                box["summary"] = f"Gancho: {draft['headline'][:80]}"

            async with recorder.step("revisor_texto", item.id) as box:
                review, usage = await agent_revisor_texto(draft, pauta)
                box["usage"] = usage
                box["summary"] = (
                    f"Nota {review['nota']:.0f}. "
                    + ("Aprovado na primeira versão." if review["aprovado"] else f"{len(review['problemas'])} correções aplicadas.")
                )
            entry["review"] = {"nota": review["nota"], "aprovado": review["aprovado"], "problemas": review["problemas"]}

            item.headline = review["headline"][:200]
            item.caption = review["caption"]
            db.commit()

            if with_art:
                # O que a pauta oferece decide o layout, e o layout decide se ainda
                # precisamos de um prompt de imagem.
                textos = (
                    pauta.get("title", ""),
                    pauta.get("brief", ""),
                    pauta.get("objective", ""),
                    review["headline"],
                    draft.get("visual_concept", ""),
                    str(direcao.get("elemento_visual", "")),
                )
                product = match_product(*textos)
                fact = match_risk_fact(*textos)
                template = choose_template(
                    product, fact, item.id, scene_model_available(), image_model_available()
                )

                image_prompt = ""
                # Layout montado no código não usa prompt nenhum. Rodar o diretor de
                # arte nesses casos gastava 18s e tokens para produzir uma instrução
                # que era jogada fora.
                if template in {"cena", "foto"}:
                    async with recorder.step("diretor_arte", item.id) as box:
                        image_prompt, usage = await agent_diretor_arte(
                            review["headline"], draft, learned, tema_sazonal
                        )
                        box["usage"] = usage
                        box["summary"] = "Instrução de imagem pronta."
                    item.image_prompt = image_prompt
                    db.commit()

                correcoes = ""
                veredito: dict[str, Any] | None = None

                # Gera, critica, e refaz no maximo duas vezes. As travas de
                # parada estao logo abaixo e cada uma existe por um motivo
                # medido; ver marketing_art_critic.py.
                for tentativa in range(MAX_REDOS + 1):
                    async with recorder.step("ilustrador", item.id) as box:
                        art_path, usage = await generate_art_with_usage(
                            image_prompt + correcoes,
                            review["headline"],
                            layout,
                            product,
                            fact,
                            template,
                            palette=theme_palette(tema_sazonal),
                            cta=draft.get("cta", ""),
                        )
                        box["usage"] = usage
                        box["summary"] = (
                            ROTULO_TEMPLATE.get(template, f"Arte {layout} gerada.").format(
                                produto=(product or {}).get("name", ""),
                                numero=(fact or {}).get("numero", ""),
                            )
                            if tentativa == 0
                            else f"Arte refeita ({tentativa}a correcao)."
                        )

                    anterior = veredito
                    veredito = await _criticar(recorder, item.id, art_path, review["headline"])
                    if veredito is None or veredito["aprovado"]:
                        break
                    if tentativa >= MAX_REDOS:
                        break
                    # Nao melhorou: insistir so queima outra imagem. O laco para
                    # e a peca vai para a pessoa com a ressalva registrada.
                    if anterior and veredito["nota_minima"] <= anterior["nota_minima"]:
                        break
                    correcoes = instrucao_de_correcao(veredito)

                if veredito and not veredito["aprovado"]:
                    # Fica gravado na peca: quem for aprovar ve o que o critico
                    # apontou e decide, em vez de receber a arte sem contexto.
                    item.revision_notes = " ".join(
                        f"{p['dimensao']}: {p['problema']}" for p in veredito["reprovadas"]
                    )[:2000]

                item.art_path = art_path

            item.status = "awaiting_approval"
            db.commit()
            entry["status"] = item.status
        except HTTPException as exc:
            item.status = "draft"
            item.error_message = str(exc.detail)[:2000]
            db.commit()
            entry["status"] = "draft"
            entry["error"] = item.error_message
        except Exception as exc:  # noqa: BLE001
            logger.exception("falha inesperada produzindo peça do agente")
            item.status = "draft"
            item.error_message = str(exc)[:2000]
            db.commit()
            entry["status"] = "draft"
            entry["error"] = "Falha inesperada ao produzir a peça."

        created.append(entry)

    return created


async def _schedule(
    db: Session,
    created: list[dict[str, Any]],
    benchmark: dict[str, Any],
    cadence_days: int,
    layout: str = "",
) -> dict[str, Any]:
    """Distribui as peças prontas na cadência pedida, no melhor horário medido.

    Só agenda o que está aguardando aprovação. Peça que falhou fica sem data: dar
    horário a um rascunho quebrado só encheria o calendário de fantasma."""
    own_posts = (benchmark.get("own") or {}).get("top_posts") or []
    parsed = []
    for post in own_posts:
        if post.get("posted_at"):
            try:
                parsed.append({**post, "posted_at": datetime.fromisoformat(str(post["posted_at"]))})
            except ValueError:
                continue

    ready = [entry for entry in created if entry["status"] == "awaiting_approval"]
    # O formato entra na conta: post e story sao filas separadas, e sem isto
    # um story agendado para daqui a oito dias empurrava o proximo post para
    # o nono, como se disputassem o mesmo espaco.
    schedule = plan_schedule(db, parsed, len(ready) or 1, cadence_days, layout=layout)

    for entry, slot in zip(ready, schedule["_slots"]):
        item = db.query(MarketingContent).filter(MarketingContent.id == entry["content_id"]).first()
        if item:
            # Em UTC, que e a convencao do resto do sistema. O slot nasce no fuso
            # de Sao Paulo (o publico e brasileiro e "9h" quer dizer 9h daqui), mas
            # guardar o horario local fazia o `process_due` publicar 3h adiantado:
            # ele compara com `datetime.now(timezone.utc)`.
            item.scheduled_at = slot.astimezone(timezone.utc)
            entry["scheduled_at"] = slot.isoformat()
    db.commit()

    if not ready:
        schedule["reason"] = "Nenhuma peça ficou pronta para agendar nesta rodada."
    else:
        schedule["reason"] = (
            f"{len(ready)} peças sugeridas para {schedule['hour']}h, uma a cada {cadence_days} dias. "
            + schedule["reason"]
        )
    return schedule


# ─── Leitura ───────────────────────────────────────────────────────────────────


def _load(value: str) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def list_steps(db: Session, run_id: int) -> list[MarketingAgentStep]:
    return (
        db.query(MarketingAgentStep)
        .filter(MarketingAgentStep.run_id == run_id)
        .order_by(MarketingAgentStep.sequence)
        .all()
    )


def serialize_step(step: MarketingAgentStep) -> dict[str, Any]:
    return {
        "id": step.id,
        "agent": step.agent,
        "sequence": step.sequence,
        "status": step.status,
        "content_id": step.content_id,
        "provider": step.provider,
        "model": step.model,
        "input_tokens": step.input_tokens,
        "output_tokens": step.output_tokens,
        "images": step.images,
        "cost_usd": round(step.cost_usd, 6),
        "cost_measured": step.cost_measured,
        "duration_ms": step.duration_ms,
        "summary": step.summary,
        "error_message": step.error_message,
    }


def serialize_run(run: MarketingAgentRun, full: bool = False) -> dict[str, Any]:
    data = {
        "id": run.id,
        "status": run.status,
        "trigger": run.trigger,
        "error_message": run.error_message,
        "created_content_ids": [int(part) for part in run.created_content_ids.split(",") if part.strip().isdigit()],
        "started_at": _iso_utc(run.started_at),
        "finished_at": _iso_utc(run.finished_at),
    }
    diagnosis = _load(run.diagnosis_json) or {}
    data["leitura"] = diagnosis.get("leitura", "")
    data["pautas_count"] = len(diagnosis.get("pautas") or [])
    if full:
        data["diagnosis"] = diagnosis
        data["benchmark"] = _load(run.benchmark_json)
        data["schedule"] = diagnosis.get("schedule", {})
    return data


def created_from_run(db: Session, run: MarketingAgentRun) -> list[dict[str, Any]]:
    """As peças de uma rodada, remontadas a partir dos ids guardados nela.

    A lista rica que o pipeline devolve ao vivo (com pilar da pauta e nota do
    revisor) só existe em memória durante a rodada. Abrir uma rodada do histórico
    precisa reler as peças do banco, senão a tela abre a rodada sem nada para
    mostrar justamente na parte que a pessoa clicou para ver.
    """
    ids = [int(part) for part in run.created_content_ids.split(",") if part.strip().isdigit()]
    if not ids:
        return []
    rows = db.query(MarketingContent).filter(MarketingContent.id.in_(ids)).all()
    by_id = {row.id: row for row in rows}
    saida: list[dict[str, Any]] = []
    for content_id in ids:
        item = by_id.get(content_id)
        if item is None:
            # Peça apagada depois da rodada. Some da lista em vez de virar linha vazia.
            continue
        saida.append(
            {
                "content_id": item.id,
                "title": item.title,
                # Pilar e nota do revisor nao sao gravados na peca, entao o historico
                # nao tem como recupera-los. Vao vazios de proposito, e a tela omite.
                "pillar": "",
                "status": item.status,
                "error": item.error_message or "",
                "scheduled_at": _iso_utc(item.scheduled_at),
            }
        )
    return saida


def list_runs(db: Session, limit: int = 20) -> list[MarketingAgentRun]:
    return db.query(MarketingAgentRun).order_by(MarketingAgentRun.started_at.desc()).limit(limit).all()


def get_run(db: Session, run_id: int) -> MarketingAgentRun:
    run = db.query(MarketingAgentRun).filter(MarketingAgentRun.id == run_id).first()
    if not run:
        raise HTTPException(404, "Rodada não encontrada.")
    return run


def _billed(step: MarketingAgentStep) -> bool:
    return step.cost_usd > 0 and (step.cost_measured or step.provider not in HAS_FREE_TIER)


def run_cost(db: Session, run_id: int) -> dict[str, Any]:
    rows = list_steps(db, run_id)
    return {
        "cost_usd": round(sum(step.cost_usd for step in rows), 6),
        "billed_usd": round(sum(step.cost_usd for step in rows if _billed(step)), 6),
        "free_tier_only": not any(_billed(step) for step in rows),
        "input_tokens": sum(step.input_tokens for step in rows),
        "output_tokens": sum(step.output_tokens for step in rows),
        "images": sum(step.images for step in rows),
        "fully_measured": all(step.cost_measured or step.cost_usd == 0 for step in rows),
        "duration_ms": sum(step.duration_ms for step in rows),
    }


def cost_dashboard(db: Session, days: int = 90) -> dict[str, Any]:
    """Custo por agente e por rodada. É o que a tela usa para mostrar onde o
    dinheiro vai: normalmente o ilustrador sozinho pesa mais que todos os agentes
    de texto somados."""
    since = datetime.now(timezone.utc).timestamp() - days * 86400
    rows = db.query(MarketingAgentStep).order_by(MarketingAgentStep.created_at.desc()).limit(2000).all()
    rows = [
        row for row in rows
        if row.created_at and (row.created_at if row.created_at.tzinfo else row.created_at.replace(tzinfo=timezone.utc)).timestamp() >= since
    ]

    by_agent: dict[str, dict[str, Any]] = {}
    for row in rows:
        bucket = by_agent.setdefault(row.agent, {"agent": row.agent, "cost_usd": 0.0, "calls": 0, "duration_ms": 0, "measured": True})
        bucket["cost_usd"] += row.cost_usd
        bucket["calls"] += 1
        bucket["duration_ms"] += row.duration_ms
        if row.cost_usd > 0 and not row.cost_measured:
            bucket["measured"] = False

    runs = db.query(MarketingAgentRun).filter(MarketingAgentRun.status == "done").count()
    # Dentro da janela, como o custo. Contar toda peça que já existiu enquanto o
    # custo é só dos últimos 90 dias espalha o gasto recente por peças antigas
    # que não custaram nada, e o custo por peça sai oito vezes menor.
    content_made = len({row.content_id for row in rows if row.content_id is not None})
    total = round(sum(row.cost_usd for row in rows), 6)
    billed = round(sum(row.cost_usd for row in rows if _billed(row)), 6)

    return {
        "window_days": days,
        "total_usd": total,
        "billed_usd": billed,
        "free_tier_only": billed == 0 and total > 0,
        "runs_done": runs,
        "content_produced": content_made,
        "cost_per_content_usd": round(total / content_made, 6) if content_made else 0.0,
        "by_agent": sorted(
            ({**value, "cost_usd": round(value["cost_usd"], 6)} for value in by_agent.values()),
            key=lambda item: item["cost_usd"],
            reverse=True,
        ),
        "roster": AGENT_ROSTER,
    }


async def run_from_idea(
    db: Session,
    pauta: dict[str, Any],
    layout: str = "feed",
    with_art: bool = True,
    cadence_days: int = 2,
    theme: str = "",
) -> dict[str, Any]:
    """Produz uma peça a partir de uma pauta que já veio pronta.

    Pula o analista e o estrategista de propósito: os dois existem para
    descobrir sobre o que escrever, e aqui isso já foi decidido por uma pessoa
    olhando a ideia. Pular também evita pagar a leitura dos concorrentes e a
    chamada do estrategista para uma peça só.

    O tema explícito vence o calendário, pelo mesmo motivo da rodada normal:
    pedir Black Friday em março é decisão, não engano.
    """
    tema_sazonal = theme_by_key(theme) if theme else active_theme()

    run = MarketingAgentRun(status="running", trigger="ideia")
    db.add(run)
    db.commit()
    db.refresh(run)
    recorder = StepRecorder(db, run.id)

    try:
        created = await _produce(
            db, recorder, [pauta], [], layout, with_art, 1, tema_sazonal
        )

        async with recorder.step("agendador") as box:
            # Sem benchmark: o agendador usa o histórico de publicação quando
            # existe, e cai no horário padrão quando não. Para uma peça só, ler
            # os concorrentes de novo não mudaria o horário escolhido.
            schedule = await _schedule(db, created, {}, cadence_days, layout)
            box["summary"] = schedule["reason"]

        costs = total_cost(recorder.usages)
        run.diagnosis_json = json.dumps(
            {
                "origem": "ideia do Planejamento",
                "pauta": pauta,
                "tema": tema_sazonal.get("nome") if tema_sazonal else None,
                "schedule": {k: v for k, v in schedule.items() if not k.startswith("_")},
            },
            ensure_ascii=False,
            default=str,
        )
        run.created_content_ids = ",".join(str(entry["content_id"]) for entry in created)[:300]
        run.status = "done"
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(run)

        return {
            **serialize_run(run),
            "created": created,
            "schedule": {k: v for k, v in schedule.items() if not k.startswith("_")},
            "steps": [serialize_step(step) for step in list_steps(db, run.id)],
            "costs": costs,
        }
    except HTTPException as exc:
        run.status = "failed"
        run.error_message = str(exc.detail)[:2000]
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        raise
    except Exception as exc:  # noqa: BLE001
        logger.exception("falha ao produzir a partir de uma ideia")
        run.status = "failed"
        run.error_message = str(exc)[:2000]
        run.finished_at = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(500, "Não foi possível produzir a peça a partir dessa ideia.") from exc


def seasonal_themes() -> list[dict[str, str]]:
    """Os temas que a tela oferece para escolher, e qual está ativo hoje."""
    ativo = active_theme()
    return [
        {
            "key": str(tema["key"]),
            "nome": str(tema["nome"]),
            "ativo": bool(ativo and ativo["key"] == tema["key"]),
        }
        for tema in SEASONAL_CALENDAR
    ]


# Nome antigo mantido para a rota de cron que já existia.
run_agent = run_pipeline
