"""O crítico de arte: olha a imagem gerada e diz se ela presta.

Por que ele existe
------------------
O revisor de texto já dava nota, e a nota era registrada e ignorada. A arte não
tinha revisor nenhum, e é onde mora o defeito mais caro: numa peça de novembro
de 2026 o gerador desenhou um terminal que não é o da 4Core, com outra tela,
sem a barra de iluminação e sem a marca. Vender um produto mostrando outro passa
por qualquer revisão de texto.

Como ele foi desenhado, e por quê
---------------------------------
Cada decisão aqui vem de uma medição publicada, não de intuição:

- **Uma chamada só, com nota por dimensão e um veredito.** A Anthropic testou
  vários juízes especializados contra um juiz único e achou que "a single LLM
  call with a single prompt outputting scores and a pass-fail grade was the most
  consistent and aligned with human judgements". Comitê de críticos é pior e
  mais caro.

- **Família de modelo diferente da do gerador.** Modelos favorecem a própria
  saída em cerca de 10% (arXiv:2306.05685). A arte sai do flux ou do gemini;
  o crítico é Claude. Nenhum julga a si mesmo.

- **Nota por dimensão, nunca média.** Uma peça com marca 9 e produto errado 3
  tem média 6 e é impublicável. O corte é por dimensão.

- **Crítica tem de citar o que está errado.** A Anthropic condiciona o padrão
  evaluator-optimizer a o modelo conseguir articular a crítica. Sem o ponto
  específico, a refação só gera outra coisa aleatória. Dimensão reprovada sem
  problema citado é tratada como aprovada, porque crítica vaga é pior que
  nenhuma.

- **"Não pense demais".** No estudo PoLL, o modelo maior teve desempenho pior
  que os menores por "over-reasoning and injecting too much background
  knowledge", e a correção mais eficaz foi instruir explicitamente contra isso.

- **A imagem é reduzida antes de subir.** Uma peça de 1080x1350 em PNG tem 1,6
  MB; a 768px de largura em JPEG ela custa uma fração dos tokens e o crítico
  continua enxergando tudo que precisa julgar. Legibilidade em miniatura,
  inclusive, se avalia melhor pequeno.

O que ele NÃO é
---------------
Não é o portão final. Juízes de IA aprovam bem e reprovam mal: em tarefa factual
bem definida, identificam mais de 95% do que está certo e só 30 a 60% do que
está sutilmente errado. Ele é filtro de volume, para o erro grosseiro não chegar
até a pessoa. Quem aprova continua sendo quem aprova.
"""

from __future__ import annotations

import base64
import io
import json
from typing import Any

import httpx
from fastapi import HTTPException
from PIL import Image

from app.core.config import settings

# Família diferente da que gera a arte (flux e gemini), para o juiz não estar
# avaliando a si mesmo. Lê imagem e é o mais barato dos que leem.
CRITIC_MODEL = "anthropic/claude-haiku-5.5"

# Abaixo disso a dimensão reprova. É o 7 pedido, e vale por dimensão.
APPROVAL_FLOOR = 7.0

# Quantas vezes a arte pode ser refeita. Dois, não cinco: o ganho do padrão vem
# da existência do laço, não da profundidade dele, e cada volta custa uma imagem
# inteira (US$ 0,04), que é 94% do custo da peça.
MAX_REDOS = 2

DIMENSOES = ("produto", "camadas", "legibilidade", "marca")

CRITIC_PROMPT = """Você é o crítico de arte da 4Core, uma empresa brasileira que vende
controle de ponto, controle de acesso e conformidade com a Portaria 671.

Você recebe uma peça de feed pronta e decide se ela pode ir para aprovação
humana. Você não escreve, não sugere texto novo e não reescreve o gancho: você
julga a imagem.

Dê nota de 0 a 10 em cada dimensão, e para cada nota abaixo de 7 escreva
EXATAMENTE o que está errado, apontando o lugar na imagem. Crítica genérica do
tipo "poderia ser mais atraente" é inútil: quem vai refazer precisa saber o que
mudar.

AS QUATRO DIMENSÕES

1. produto — o aparelho mostrado é mesmo o da 4Core?
   Esta é a mais grave. O terminal facial da 4Core tem corpo preto arredondado,
   uma barra branca de iluminação no topo, lentes em linha logo abaixo dela,
   uma tela vertical no meio e uma marca pequena na base. Se a peça mostra um
   aparelho diferente, ou um aparelho inventado, ou a tela em proporção errada,
   a nota é no máximo 4: a peça estaria vendendo um produto mostrando outro.
   Se a peça não mostra aparelho nenhum, esta dimensão é 10 e você anota
   "sem aparelho na cena".

2. camadas — a cena tem gente, sistema em uso e empresa em volta?
   Precisa ter pelo menos uma pessoa real trabalhando, pega no meio da tarefa.
   Precisa ter o sistema sendo usado com gesto visível, não um aparelho posando
   numa bancada. Precisa ter um ambiente de empresa reconhecível. Falta de
   qualquer uma das três derruba a nota.

3. legibilidade — o gancho se lê?
   Olhe a peça como se fosse uma miniatura na grade de um perfil. O texto tem
   contraste suficiente? Alguma linha está cortada, sobreposta a outra, ou
   saindo da caixa? O rodapé está poluído a ponto de o logo e o site sumirem?

4. marca — a peça parece da 4Core?
   Violeta e ameixa escura dominando, ou uma paleta sazonal coerente. Nada de
   azul corporativo genérico, nada de neon multicolorido. O logo e o selo, se
   houver, estão inteiros e no lugar.

NÃO PENSE DEMAIS. Julgue o que está na imagem, não o que ela poderia ser.
Não invente contexto que você não vê. Não comente a estratégia da peça.

Responda SOMENTE JSON válido:
{"produto": 0-10, "camadas": 0-10, "legibilidade": 0-10, "marca": 0-10,
 "problemas": {"dimensao": "o que exatamente está errado e onde"},
 "resumo": "uma frase em português sobre a peça"}

`problemas` só leva as dimensões que ficaram abaixo de 7."""


def _miniatura(conteudo: bytes, largura: int = 768) -> str:
    """A imagem reduzida, em JPEG, pronta para ir no corpo da requisição.

    Uma peça de 1080x1350 em PNG tem 1,6 MB. A 768px em JPEG ela custa uma
    fração dos tokens, e o crítico continua enxergando tudo que precisa: a
    legibilidade em miniatura, inclusive, se avalia melhor pequeno, porque é
    assim que a peça aparece na grade do perfil.
    """
    imagem = Image.open(io.BytesIO(conteudo)).convert("RGB")
    if imagem.width > largura:
        altura = round(imagem.height * largura / imagem.width)
        imagem = imagem.resize((largura, altura), Image.Resampling.LANCZOS)
    saida = io.BytesIO()
    imagem.save(saida, format="JPEG", quality=82, optimize=True)
    return base64.b64encode(saida.getvalue()).decode()


def avaliar_resultado(bruto: dict[str, Any]) -> dict[str, Any]:
    """Transforma a resposta do modelo no veredito que a esteira usa.

    Separado da chamada de rede de propósito: é aqui que mora a regra, e regra
    precisa ser testável sem internet.
    """
    notas: dict[str, float] = {}
    for dimensao in DIMENSOES:
        try:
            notas[dimensao] = max(0.0, min(10.0, float(bruto.get(dimensao, 0))))
        except (TypeError, ValueError):
            notas[dimensao] = 0.0

    problemas_brutos = bruto.get("problemas") or {}
    if not isinstance(problemas_brutos, dict):
        problemas_brutos = {}

    reprovadas = []
    for dimensao, nota in notas.items():
        if nota >= APPROVAL_FLOOR:
            continue
        queixa = str(problemas_brutos.get(dimensao) or "").strip()
        # Dimensão reprovada sem o problema citado é tratada como aprovada. Sem
        # o ponto específico, a refação vira tentativa aleatória, e a literatura
        # é explícita: o laço só funciona quando o crítico consegue articular a
        # correção. Crítica vaga é pior do que nenhuma, porque custa uma imagem.
        if queixa:
            reprovadas.append({"dimensao": dimensao, "nota": nota, "problema": queixa})

    return {
        "notas": notas,
        "nota_minima": min(notas.values()) if notas else 0.0,
        "aprovado": not reprovadas,
        "reprovadas": reprovadas,
        "resumo": str(bruto.get("resumo") or "").strip()[:300],
    }


def instrucao_de_correcao(veredito: dict[str, Any]) -> str:
    """O que vai para o gerador na hora de refazer.

    Só o que foi apontado, em inglês, porque é a língua do prompt de imagem.
    """
    if veredito["aprovado"]:
        return ""
    linhas = [f"- {item['problema']}" for item in veredito["reprovadas"]]
    return (
        "\n\nCORRECTIONS REQUIRED. The previous attempt was rejected by the art "
        "review for the reasons below. Fix each one; everything else about the "
        "brief stays the same:\n" + "\n".join(linhas)
    )


async def critique_art(conteudo: bytes, headline: str) -> tuple[dict[str, Any], Any]:
    """Julga a arte e devolve o veredito e o consumo da chamada."""
    from app.services.marketing_agent_cost import text_usage

    if not settings.openrouter_api_key:
        raise HTTPException(409, "Configure OPENROUTER_API_KEY para a crítica de arte.")

    corpo = {
        "model": CRITIC_MODEL,
        "temperature": 0.1,
        "response_format": {"type": "json_object"},
        "usage": {"include": True},
        "messages": [
            {"role": "system", "content": CRITIC_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            f'O gancho escrito nesta peça é: "{headline.strip()}". '
                            "Julgue a imagem."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": "data:image/jpeg;base64," + _miniatura(conteudo)},
                    },
                ],
            },
        ],
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        resposta = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": settings.openrouter_site_url,
                "X-Title": "ERP 4Core",
            },
            json=corpo,
        )

    if resposta.status_code >= 400:
        raise HTTPException(502, "Não foi possível revisar a arte agora.")

    from app.services.marketing_agent_llm import _unfence

    try:
        dados = resposta.json()
        bruto = json.loads(_unfence(dados["choices"][0]["message"]["content"]))
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise HTTPException(502, "A revisão da arte devolveu um formato inválido.") from exc

    if not isinstance(bruto, dict):
        raise HTTPException(502, "A revisão da arte devolveu um formato inválido.")

    return avaliar_resultado(bruto), text_usage("openrouter", CRITIC_MODEL, dados)
