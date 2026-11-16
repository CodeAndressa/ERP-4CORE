"""Sprites dos agentes da esteira, 20x16, montados a partir de um corpo comum.

Desenhar sete bonecos inteiros a mao daria sete oportunidades de o corpo sair
diferente. Aqui o corpo e um so; cada agente acrescenta o braco e a ferramenta.

A largura e 20 e nao 16 porque em 16 nao cabia corpo, braco e ferramenta sem a
ferramenta encostar na borda e parecer cortada.

Geometria, para as pecas encaixarem:
  cabeca  x=7..12      tronco  x=6..13
  braco esquerdo x=4..5     braco direito x=14..15
  ferramenta esquerda x=0..3   ferramenta direita x=16..19

O braco so pode comecar em y=8 ou y=10. Acima disso ele sai na altura da cabeca
e o boneco parece ter um braco nascendo da orelha, que foi exatamente o que
aconteceu na primeira versao.
"""

W, H = 20, 16

PALETTE = {
    ".": None,
    "k": "#1a0033",  # contorno
    "s": "#f0c89a",  # pele
    "h": "#4a2d7a",  # cabelo
    "b": "#7b00ff",  # roupa
    "d": "#5a00bb",  # calca
    "w": "#f2e6ff",  # papel, tela
    "a": "#b26bff",  # acento
    "y": "#ffd166",  # dourado
    "r": "#ff5c8a",  # rosa
    "g": "#4ade80",  # verde
}

BASE = [
    "....................",
    "........kkkk........",
    ".......khhhhk.......",
    "......khhhhhhk......",
    "......khsssshk......",
    "......kssssssk......",
    ".......kssssk.......",
    "........kkkk........",
    "......kkbbbbkk......",
    "......kbbbbbbk......",
    "......kbbbbbbk......",
    "......kbbbbbbk......",
    "......kbdddddk......",
    ".......kdk.kdk......",
    ".......kdk.kdk......",
    "......kkkk.kkkk.....",
]


def put(grid, x, y, char):
    if 0 <= y < H and 0 <= x < W:
        grid[y] = grid[y][:x] + char + grid[y][x + 1:]


def draw(grid, cells):
    for x, y, char in cells:
        put(grid, x, y, char)


def block(x0, y0, x1, y1, char):
    return [(x, y, char) for y in range(y0, y1 + 1) for x in range(x0, x1 + 1)]


def frame(prop, arm):
    grid = list(BASE)
    draw(grid, prop)
    draw(grid, arm)
    return grid


def build(prop_a, arm_a, prop_b, arm_b):
    return [frame(prop_a, arm_a), frame(prop_b, arm_b)]


def arm_left(y, hand="s"):
    """Dois pixels de altura: um so lia como risco solto, nao como braco."""
    return (
        block(4, y, 5, y + 1, "b")
        + [(4, y - 1, "k"), (5, y - 1, "k"), (4, y + 2, "k"), (5, y + 2, "k")]
        + [(3, y, hand), (3, y + 1, hand)]
    )


def arm_right(y, hand="s"):
    return (
        block(14, y, 15, y + 1, "b")
        + [(14, y - 1, "k"), (15, y - 1, "k"), (14, y + 2, "k"), (15, y + 2, "k")]
        + [(16, y, hand), (16, y + 1, hand)]
    )


# ── Ferramentas ──────────────────────────────────────────────────────────────

def lupa(y):
    """Aro redondo com cabo: le melhor que binoculo neste tamanho."""
    return (
        block(16, y - 2, 19, y + 1, "k")
        + block(17, y - 1, 18, y, "a")
        + [(16, y + 2, "k"), (17, y + 2, "k")]
    )


# Barras crescendo: o quadro do estrategista mostra um grafico.
QUADRO = (
    block(0, 2, 4, 12, "k")
    + block(1, 3, 3, 11, "w")
    + [(1, 9, "a"), (2, 7, "a"), (2, 8, "a"), (2, 9, "a"), (3, 5, "a"), (3, 6, "a"), (3, 7, "a"), (3, 8, "a"), (3, 9, "a")]
    + block(1, 10, 3, 10, "k")
)

# Linhas de texto: a folha do revisor e um texto para corrigir.
FOLHA = (
    block(0, 2, 4, 12, "k")
    + block(1, 3, 3, 11, "w")
    + [(1, 4, "k"), (2, 4, "k"), (3, 4, "k"), (1, 6, "k"), (2, 6, "k"), (1, 9, "k"), (2, 9, "k"), (3, 9, "k")]
)
PALETA = block(0, 7, 4, 11, "k") + [
    (1, 8, "y"), (2, 8, "r"), (3, 8, "g"),
    (1, 9, "a"), (2, 9, "w"), (3, 9, "y"),
    (2, 10, "r"),
]
CAVALETE = (
    block(0, 1, 4, 11, "k")
    + block(1, 2, 3, 10, "w")
    + [(1, 3, "a"), (2, 3, "a"), (2, 4, "a"), (1, 8, "g"), (2, 8, "g"), (3, 8, "g"), (3, 4, "y")]
    + block(1, 12, 3, 12, "k")
    + [(0, 13, "k"), (4, 13, "k"), (0, 14, "k"), (4, 14, "k")]
)
CALENDARIO = block(15, 4, 19, 12, "k") + block(16, 6, 18, 11, "w") + [(16, 5, "r"), (18, 5, "r")]

SPRITES = {
    # A lupa sobe e desce sobre o alvo: esta procurando alguma coisa.
    "analista": build(
        lupa(8), arm_right(8),
        lupa(10), arm_right(10),
    ),
    # A mao aponta um item do quadro e depois outro mais abaixo.
    "estrategista": build(
        QUADRO + block(1, 8, 2, 8, "a"), arm_left(8),
        QUADRO + block(1, 10, 2, 10, "a"), arm_left(10),
    ),
    # Teclado na frente do corpo, maos alternando de tecla. Aqui os bracos descem
    # em vez de abrir para o lado, senao viram asas.
    "redator": build(
        block(5, 13, 14, 15, "k") + block(6, 13, 13, 14, "w") + block(6, 14, 13, 14, "a"),
        block(5, 9, 5, 12, "b") + block(14, 9, 14, 12, "b") + [(5, 8, "k"), (14, 8, "k"), (5, 12, "s"), (14, 12, "s")],
        block(5, 13, 14, 15, "k") + block(6, 13, 13, 14, "w") + block(6, 14, 13, 14, "a"),
        block(5, 9, 5, 11, "b") + block(14, 9, 14, 11, "b") + [(5, 8, "k"), (14, 8, "k"), (5, 11, "s"), (14, 11, "s")],
    ),
    # A caneta vermelha desce pela folha, marcando um erro e depois outro.
    "revisor_texto": build(
        FOLHA + block(1, 8, 2, 8, "r") + [(2, 4, "k"), (1, 6, "k")], arm_left(8, "r"),
        FOLHA + block(1, 8, 2, 8, "r") + block(1, 10, 2, 10, "r") + [(2, 4, "k"), (1, 6, "k")], arm_left(10, "r"),
    ),
    # Segura a paleta e levanta a outra mao, avaliando a cena.
    "diretor_arte": build(
        PALETA, arm_left(8) + arm_right(8),
        PALETA, arm_left(8) + arm_right(10),
    ),
    # O pincel encosta na tela em dois pontos diferentes.
    "ilustrador": build(
        CAVALETE, arm_left(8, "y"),
        CAVALETE + [(1, 6, "y"), (2, 6, "y")], arm_left(10, "y"),
    ),
    # Marca um dia e depois outro no calendario.
    "agendador": build(
        CALENDARIO + [(16, 8, "g")], arm_right(8),
        CALENDARIO + [(16, 8, "g"), (18, 10, "g")], arm_right(10),
    ),
}
