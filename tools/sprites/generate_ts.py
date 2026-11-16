import sys, json
from sprites import SPRITES, PALETTE, W, H
cab = """/* Gerado a partir de scratchpad/sprites.py. Cada agente tem dois quadros 20x16;
 * o segundo so muda o braco e a ferramenta, que e o que da a impressao de trabalho.
 * Editar aqui a mao funciona, mas o desenho fica mais facil de conferir rodando o
 * render do script original, que gera um PNG de contato com os sete lado a lado. */

export const SPRITE_W = %d;
export const SPRITE_H = %d;

export const SPRITE_PALETTE: Record<string, string> = %s;

/** Dois quadros por agente, cada quadro com %d linhas de %d caracteres. */
export const AGENT_SPRITES: Record<string, [string[], string[]]> = %s;
"""
pal = {k: v for k, v in PALETTE.items() if v}
print(cab % (W, H, json.dumps(pal, indent=2, ensure_ascii=False), H, W, json.dumps(SPRITES, indent=2, ensure_ascii=False)))
