/* Gerado a partir de scratchpad/sprites.py. Cada agente tem dois quadros 20x16;
 * o segundo so muda o braco e a ferramenta, que e o que da a impressao de trabalho.
 * Editar aqui a mao funciona, mas o desenho fica mais facil de conferir rodando o
 * render do script original, que gera um PNG de contato com os sete lado a lado. */

export const SPRITE_W = 20;
export const SPRITE_H = 16;

export const SPRITE_PALETTE: Record<string, string> = {
  "k": "#1a0033",
  "s": "#f0c89a",
  "h": "#4a2d7a",
  "b": "#7b00ff",
  "d": "#5a00bb",
  "w": "#f2e6ff",
  "a": "#b26bff",
  "y": "#ffd166",
  "r": "#ff5c8a",
  "g": "#4ade80"
};

/** Dois quadros por agente, cada quadro com 16 linhas de 20 caracteres. */
export const AGENT_SPRITES: Record<string, [string[], string[]]> = {
  "analista": [
    [
      "....................",
      "........kkkk........",
      ".......khhhhk.......",
      "......khhhhhhk......",
      "......khsssshk......",
      "......kssssssk......",
      ".......kssssk...kkkk",
      "........kkkk..kkkaak",
      "......kkbbbbkkbbsaak",
      "......kbbbbbbkbbskkk",
      "......kbbbbbbkkkkk..",
      "......kbbbbbbk......",
      "......kbdddddk......",
      ".......kdk.kdk......",
      ".......kdk.kdk......",
      "......kkkk.kkkk....."
    ],
    [
      "....................",
      "........kkkk........",
      ".......khhhhk.......",
      "......khhhhhhk......",
      "......khsssshk......",
      "......kssssssk......",
      ".......kssssk.......",
      "........kkkk........",
      "......kkbbbbkk..kkkk",
      "......kbbbbbbkkkkaak",
      "......kbbbbbbkbbsaak",
      "......kbbbbbbkbbskkk",
      "......kbdddddkkkkk..",
      ".......kdk.kdk......",
      ".......kdk.kdk......",
      "......kkkk.kkkk....."
    ]
  ],
  "estrategista": [
    [
      "....................",
      "........kkkk........",
      "kkkkk..khhhhk.......",
      "kwwwk.khhhhhhk......",
      "kwwwk.khsssshk......",
      "kwwak.kssssssk......",
      "kwwak..kssssk.......",
      "kwaakk..kkkk........",
      "kaasbbkkbbbbkk......",
      "kaasbbkbbbbbbk......",
      "kkkkkkkbbbbbbk......",
      "kwwwk.kbbbbbbk......",
      "kkkkk.kbdddddk......",
      ".......kdk.kdk......",
      ".......kdk.kdk......",
      "......kkkk.kkkk....."
    ],
    [
      "....................",
      "........kkkk........",
      "kkkkk..khhhhk.......",
      "kwwwk.khhhhhhk......",
      "kwwwk.khsssshk......",
      "kwwak.kssssssk......",
      "kwwak..kssssk.......",
      "kwaak...kkkk........",
      "kwaak.kkbbbbkk......",
      "kaaakkkbbbbbbk......",
      "kaasbbkbbbbbbk......",
      "kwwsbbkbbbbbbk......",
      "kkkkkkkbdddddk......",
      ".......kdk.kdk......",
      ".......kdk.kdk......",
      "......kkkk.kkkk....."
    ]
  ],
  "redator": [
    [
      "....................",
      "........kkkk........",
      ".......khhhhk.......",
      "......khhhhhhk......",
      "......khsssshk......",
      "......kssssssk......",
      ".......kssssk.......",
      "........kkkk........",
      ".....kkkbbbbkkk.....",
      ".....bkbbbbbbkb.....",
      ".....bkbbbbbbkb.....",
      ".....bkbbbbbbkb.....",
      ".....skbdddddks.....",
      ".....kwwwwwwwwk.....",
      ".....kaaaaaaaak.....",
      ".....kkkkkkkkkk....."
    ],
    [
      "....................",
      "........kkkk........",
      ".......khhhhk.......",
      "......khhhhhhk......",
      "......khsssshk......",
      "......kssssssk......",
      ".......kssssk.......",
      "........kkkk........",
      ".....kkkbbbbkkk.....",
      ".....bkbbbbbbkb.....",
      ".....bkbbbbbbkb.....",
      ".....skbbbbbbks.....",
      "......kbdddddk......",
      ".....kwwwwwwwwk.....",
      ".....kaaaaaaaak.....",
      ".....kkkkkkkkkk....."
    ]
  ],
  "revisor_texto": [
    [
      "....................",
      "........kkkk........",
      "kkkkk..khhhhk.......",
      "kwwwk.khhhhhhk......",
      "kkkkk.khsssshk......",
      "kwwwk.kssssssk......",
      "kkkwk..kssssk.......",
      "kwwwkk..kkkk........",
      "krrrbbkkbbbbkk......",
      "kkkrbbkbbbbbbk......",
      "kwwwkkkbbbbbbk......",
      "kwwwk.kbbbbbbk......",
      "kkkkk.kbdddddk......",
      ".......kdk.kdk......",
      ".......kdk.kdk......",
      "......kkkk.kkkk....."
    ],
    [
      "....................",
      "........kkkk........",
      "kkkkk..khhhhk.......",
      "kwwwk.khhhhhhk......",
      "kkkkk.khsssshk......",
      "kwwwk.kssssssk......",
      "kkkwk..kssssk.......",
      "kwwwk...kkkk........",
      "krrwk.kkbbbbkk......",
      "kkkkkkkbbbbbbk......",
      "krrrbbkbbbbbbk......",
      "kwwrbbkbbbbbbk......",
      "kkkkkkkbdddddk......",
      ".......kdk.kdk......",
      ".......kdk.kdk......",
      "......kkkk.kkkk....."
    ]
  ],
  "diretor_arte": [
    [
      "....................",
      "........kkkk........",
      ".......khhhhk.......",
      "......khhhhhhk......",
      "......khsssshk......",
      "......kssssssk......",
      ".......kssssk.......",
      "kkkkkk..kkkk..kk....",
      "kyrsbbkkbbbbkkbbs...",
      "kawsbbkbbbbbbkbbs...",
      "kkrkkkkbbbbbbkkk....",
      "kkkkk.kbbbbbbk......",
      "......kbdddddk......",
      ".......kdk.kdk......",
      ".......kdk.kdk......",
      "......kkkk.kkkk....."
    ],
    [
      "....................",
      "........kkkk........",
      ".......khhhhk.......",
      "......khhhhhhk......",
      "......khsssshk......",
      "......kssssssk......",
      ".......kssssk.......",
      "kkkkkk..kkkk........",
      "kyrsbbkkbbbbkk......",
      "kawsbbkbbbbbbkkk....",
      "kkrkkkkbbbbbbkbbs...",
      "kkkkk.kbbbbbbkbbs...",
      "......kbdddddkkk....",
      ".......kdk.kdk......",
      ".......kdk.kdk......",
      "......kkkk.kkkk....."
    ]
  ],
  "ilustrador": [
    [
      "....................",
      "kkkkk...kkkk........",
      "kwwwk..khhhhk.......",
      "kaawk.khhhhhhk......",
      "kwayk.khsssshk......",
      "kwwwk.kssssssk......",
      "kwwwk..kssssk.......",
      "kwwwkk..kkkk........",
      "kggybbkkbbbbkk......",
      "kwwybbkbbbbbbk......",
      "kwwwkkkbbbbbbk......",
      "kkkkk.kbbbbbbk......",
      ".kkk..kbdddddk......",
      "k...k..kdk.kdk......",
      "k...k..kdk.kdk......",
      "......kkkk.kkkk....."
    ],
    [
      "....................",
      "kkkkk...kkkk........",
      "kwwwk..khhhhk.......",
      "kaawk.khhhhhhk......",
      "kwayk.khsssshk......",
      "kwwwk.kssssssk......",
      "kyywk..kssssk.......",
      "kwwwk...kkkk........",
      "kgggk.kkbbbbkk......",
      "kwwwkkkbbbbbbk......",
      "kwwybbkbbbbbbk......",
      "kkkybbkbbbbbbk......",
      ".kkkkkkbdddddk......",
      "k...k..kdk.kdk......",
      "k...k..kdk.kdk......",
      "......kkkk.kkkk....."
    ]
  ],
  "agendador": [
    [
      "....................",
      "........kkkk........",
      ".......khhhhk.......",
      "......khhhhhhk......",
      "......khsssshk.kkkkk",
      "......kssssssk.krkrk",
      ".......kssssk..kwwwk",
      "........kkkk..kkwwwk",
      "......kkbbbbkkbbswwk",
      "......kbbbbbbkbbswwk",
      "......kbbbbbbkkkwwwk",
      "......kbbbbbbk.kwwwk",
      "......kbdddddk.kkkkk",
      ".......kdk.kdk......",
      ".......kdk.kdk......",
      "......kkkk.kkkk....."
    ],
    [
      "....................",
      "........kkkk........",
      ".......khhhhk.......",
      "......khhhhhhk......",
      "......khsssshk.kkkkk",
      "......kssssssk.krkrk",
      ".......kssssk..kwwwk",
      "........kkkk...kwwwk",
      "......kkbbbbkk.kgwwk",
      "......kbbbbbbkkkwwwk",
      "......kbbbbbbkbbswgk",
      "......kbbbbbbkbbswwk",
      "......kbdddddkkkkkkk",
      ".......kdk.kdk......",
      ".......kdk.kdk......",
      "......kkkk.kkkk....."
    ]
  ]
};

