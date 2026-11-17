"""O calendário sazonal: o que está perto o suficiente para virar pauta.

A esteira escrevia o ano inteiro com o mesmo tom. Em novembro, uma empresa que
vende controle de ponto tem assunto que a concorrência toda vai usar (Black
Friday, fechamento de ano, 13º, férias coletivas, escala de fim de ano), e o
perfil que ignora isso parece desligado do calendário de quem lê.

Como funciona: cada data tem uma janela de antecedência, e dentro dela o tema
entra no briefing dos agentes. Fora da janela ele não existe. Quem decide é a
data de hoje, não uma configuração que alguém precisa lembrar de ligar e
desligar.

A janela é generosa de propósito. Peça aprovada hoje não publica hoje: ela entra
na fila de agendamento, que costuma estar coberta por alguns dias. Uma janela de
três dias para o Natal produziria peça de Natal agendada para o dia 28.

Cada tema carrega também a sua identidade visual, porque Black Friday e Natal
não podem sair com a mesma paleta de uma peça comum: o que marca a data é a cor
antes do texto. As paletas ficam aqui, junto da data que as justifica, e não
espalhadas no gerador de arte.
"""

from __future__ import annotations

from datetime import date
from typing import Any


class SeasonalTheme(dict):
    """Um tema sazonal. É dict para entrar direto no payload dos agentes."""


# `mes` e `dia` marcam o dia do evento. `antecedencia` é quantos dias antes o
# tema começa a valer, e `validade` quantos dias depois ele ainda faz sentido
# (zero significa que acaba no próprio dia).
#
# `paleta` descreve a identidade daquele tema em termos que o compositor de arte
# entende: fundo, acento e o tom do texto de apoio.
SEASONAL_CALENDAR: list[dict[str, Any]] = [
    {
        "key": "black_friday",
        "nome": "Black Friday",
        "mes": 11,
        "dia": 28,
        "antecedencia": 25,
        "validade": 3,
        "angulo": (
            "A Black Friday da 4Core é sobre decidir agora o que já estava na lista do ano: "
            "trocar o controle de ponto manual, regularizar a jornada antes do fechamento. "
            "Nada de contagem regressiva histérica nem desconto inventado."
        ),
        "tom": "direto e urgente, sem gritaria de varejo",
        "proibido": (
            "Não cite percentual de desconto, valor promocional, prazo de oferta ou "
            "quantidade limitada: nenhuma dessas informações foi fornecida e inventar "
            "preço em peça de Black Friday é o erro mais caro possível."
        ),
        "paleta": {
            "fundo": "#08000F",
            "fundo_2": "#1A0033",
            "acento": "#B26BFF",
            "apoio": "#F2E6FF",
            "descricao_visual": (
                "near-black background with a single hard light source, high contrast, "
                "deep shadows, one electric violet accent"
            ),
        },
    },
    {
        "key": "natal",
        "nome": "Natal",
        "mes": 12,
        "dia": 25,
        "antecedencia": 24,
        "validade": 1,
        "angulo": (
            "Dezembro é escala de fim de ano, férias coletivas, banco de horas fechando e "
            "folha com 13º. O gancho de Natal da 4Core é sobre a operação que não pode "
            "parar e sobre quem está de plantão enquanto o resto descansa."
        ),
        "tom": "humano e caloroso, sem pieguice",
        "proibido": (
            "Nada de Papai Noel, rena, trenó, presente embrulhado ou árvore decorada: "
            "é uma empresa de controle de ponto, não uma loja. Nada de desejar boas "
            "festas como se fosse o conteúdo inteiro."
        ),
        "paleta": {
            "fundo": "#0D0219",
            "fundo_2": "#2B0A2E",
            "acento": "#E8C57A",
            "apoio": "#FFF4E0",
            "descricao_visual": (
                "warm low light as if from a single lamp at dusk, amber highlights over a "
                "deep plum base, calm and quiet, no decorations"
            ),
        },
    },
    {
        "key": "ano_novo",
        "nome": "Virada de ano",
        "mes": 1,
        "dia": 1,
        "antecedencia": 12,
        "validade": 15,
        "angulo": (
            "A virada é sobre o que entra em vigor em janeiro: nova escala, novo acordo "
            "de banco de horas, obrigações que reiniciam, e a chance de começar o ano com "
            "o registro de ponto em dia em vez de arrastar o problema do ano passado."
        ),
        "tom": "de recomeço concreto, com data e prazo reais",
        "proibido": (
            "Nada de 'novos ares', 'novos desafios', 'que venha um ano de conquistas' "
            "nem lista de resoluções: é exatamente o texto que toda empresa publica em "
            "1º de janeiro e que ninguém lê."
        ),
        "paleta": {
            "fundo": "#0A0118",
            "fundo_2": "#241046",
            "acento": "#7FE3D4",
            "apoio": "#EAF7F5",
            "descricao_visual": (
                "cool first light of morning, clean air, a workplace being opened rather "
                "than closed, teal highlight against deep indigo"
            ),
        },
    },
    {
        "key": "volta_as_aulas",
        "nome": "Volta às aulas",
        "mes": 2,
        "dia": 1,
        "antecedencia": 20,
        "validade": 10,
        "angulo": (
            "Escolas e creches voltam, e com elas a jornada de professores, auxiliares e "
            "equipe de apoio, que quase nunca é 8 às 18. É o momento em que escola "
            "percebe que controla ponto no papel."
        ),
        "tom": "específico para o setor de educação",
        "proibido": "Nada de material escolar, mochila ou lápis como metáfora.",
        "paleta": {
            "fundo": "#0B0320",
            "fundo_2": "#231350",
            "acento": "#8FB4FF",
            "apoio": "#EAF0FF",
            "descricao_visual": "bright daylight through large windows, blue highlight, busy corridor",
        },
    },
    {
        "key": "dia_do_trabalho",
        "nome": "Dia do Trabalho",
        "mes": 5,
        "dia": 1,
        "antecedencia": 12,
        "validade": 1,
        "angulo": (
            "1º de maio é feriado que gera hora extra, escala especial e adicional, e é "
            "quando a jornada mal registrada vira processo. O gancho é o direito que só "
            "se prova com registro."
        ),
        "tom": "de respeito ao trabalhador, sem discurso político",
        "proibido": (
            "Nada de punho erguido, bandeira, nem mensagem genérica de 'parabéns a todos "
            "os trabalhadores': a data é sobre jornada registrada, não sobre homenagem."
        ),
        "paleta": {
            "fundo": "#10001F",
            "fundo_2": "#2E0A2A",
            "acento": "#FF9E6B",
            "apoio": "#FFEFE6",
            "descricao_visual": "late afternoon sun on a shop floor, warm orange rim light",
        },
    },
    {
        "key": "ferias_julho",
        "nome": "Férias de julho",
        "mes": 7,
        "dia": 1,
        "antecedencia": 18,
        "validade": 25,
        "angulo": (
            "Julho é pico de férias e de escala reduzida, e é quando a cobertura de turno "
            "mostra se o controle de jornada funciona ou se alguém está fazendo conta no "
            "caderno."
        ),
        "tom": "prático, de quem monta escala",
        "proibido": "Nada de praia, mala ou avião: a peça é sobre quem ficou.",
        "paleta": {
            "fundo": "#0A0216",
            "fundo_2": "#1F1040",
            "acento": "#9B35FF",
            "apoio": "#F5F0FF",
            "descricao_visual": "half-empty workplace, soft daylight, one person covering a shift",
        },
    },
]


def _dias_ate(hoje: date, mes: int, dia: int) -> int:
    """Quantos dias faltam para a próxima ocorrência da data.

    Negativo quando ela já passou neste ano e ainda está dentro da validade. O
    ano seguinte entra na conta porque a virada de ano é a única data cuja
    janela começa num ano e termina no outro: sem isso, 20 de dezembro não
    enxergaria 1º de janeiro.
    """
    for ano in (hoje.year, hoje.year + 1):
        try:
            alvo = date(ano, mes, dia)
        except ValueError:
            continue
        delta = (alvo - hoje).days
        if delta >= 0:
            return delta
    return 10_000


def _dias_desde(hoje: date, mes: int, dia: int) -> int:
    """Quantos dias se passaram desde a última ocorrência da data."""
    for ano in (hoje.year, hoje.year - 1):
        try:
            alvo = date(ano, mes, dia)
        except ValueError:
            continue
        delta = (hoje - alvo).days
        if delta >= 0:
            return delta
    return 10_000


def active_theme(hoje: date | None = None) -> SeasonalTheme | None:
    """O tema sazonal que vale hoje, se houver algum.

    Quando duas janelas se sobrepõem, vence a data mais próxima: no fim de
    dezembro o Natal e a virada estão os dois ativos, e o que importa é o que
    chega primeiro.
    """
    hoje = hoje or date.today()
    # (ja_passou, distancia, tema). A ordenação por tupla resolve as duas regras
    # de uma vez: data que ainda vem ganha de data que já passou, e entre duas da
    # mesma situação ganha a mais próxima. No dia 20 de dezembro o Natal e a
    # virada estão os dois dentro da janela, e o que importa é o que chega antes.
    candidatos: list[tuple[int, int, dict[str, Any]]] = []

    for tema in SEASONAL_CALENDAR:
        faltam = _dias_ate(hoje, tema["mes"], tema["dia"])
        if faltam <= tema["antecedencia"]:
            candidatos.append((0, faltam, tema))
            continue
        passaram = _dias_desde(hoje, tema["mes"], tema["dia"])
        if passaram <= tema["validade"]:
            candidatos.append((1, passaram, tema))

    if not candidatos:
        return None

    ja_passou, distancia, tema = min(candidatos, key=lambda item: (item[0], item[1]))
    # Negativo quando a data já passou, para "faltam -1 dias" nunca ser escrito.
    return SeasonalTheme({
        **tema,
        "dias_para_a_data": -distancia if ja_passou else distancia,
        "escolhido": False,
    })


def theme_by_key(key: str) -> SeasonalTheme | None:
    """Um tema pelo nome, para quando a rodada é disparada à mão com um tema."""
    alvo = (key or "").strip().lower()
    if not alvo:
        return None
    for tema in SEASONAL_CALENDAR:
        if tema["key"] == alvo or tema["nome"].lower() == alvo:
            # `escolhido` muda o tom do briefing. Ver theme_brief: tema que o
            # calendário liga sozinho é contexto, tema que a pessoa escolheu no
            # seletor é o assunto da peça.
            return SeasonalTheme({
                **tema,
                "dias_para_a_data": _dias_ate(date.today(), tema["mes"], tema["dia"]),
                "escolhido": True,
            })
    return None


def theme_brief(tema: SeasonalTheme | None) -> str:
    """O bloco que entra no prompt dos agentes de texto."""
    if not tema:
        return ""
    dias = tema["dias_para_a_data"]
    quando = (
        "é hoje" if dias == 0
        else f"faltam {dias} dias" if dias > 0
        else f"foi há {abs(dias)} dia(s), e a peça ainda sai dentro da janela"
    )
    return (
        f"\n\nDATA SAZONAL ATIVA: {tema['nome']} ({quando}).\n"
        f"Ângulo obrigatório: {tema['angulo']}\n"
        f"Tom: {tema['tom']}\n"
        f"Proibido nesta data: {tema['proibido']}\n"
        + (
            # Tom forte: a pessoa foi ao seletor e pediu esta data. Entregar uma
            # peça comum com um aceno à data não é o que ela pediu, e foi o que
            # aconteceu: uma rodada pedida como Black Friday saiu sem uma palavra
            # de Black Friday.
            "ESTA PEÇA É DA CAMPANHA DE " + str(tema["nome"]).upper() + ". A data foi "
            "escolhida a dedo para esta rodada, então ela precisa estar no gancho e na "
            "primeira linha da legenda, não insinuada no meio. Quem vir a peça tem de "
            "saber de que data ela é sem ler até o fim. O problema de sempre continua "
            "sendo o assunto; o que muda é que a data é o motivo de falar dele agora."
            if tema.get("escolhido")
            # Tom leve: foi o calendário que ligou. Encher o feed inteiro de
            # Black Friday porque novembro chegou é pior do que ignorar a data.
            else "A peça precisa fazer sentido para quem vê sem conhecer a campanha: a "
            "data entra como contexto do problema, nunca como o assunto inteiro."
        )
    )


def theme_visual(tema: SeasonalTheme | None) -> str:
    """O bloco que entra no prompt da imagem."""
    if not tema:
        return ""
    paleta = tema["paleta"]
    return (
        f"\n\nSEASONAL TREATMENT ({tema['nome']}): {paleta['descricao_visual']}. "
        "Keep it photographic and restrained: the season shows in the light and the "
        "colour grade, never in props, decorations or symbols."
    )


def theme_palette(tema: SeasonalTheme | None) -> dict[str, str] | None:
    """As cores da arte montada, quando a data tem identidade própria."""
    return dict(tema["paleta"]) if tema else None
