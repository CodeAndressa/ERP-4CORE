# Sprites dos agentes da esteira

Os bonequinhos que aparecem em `/marketing/agente` nascem aqui, não no TypeScript.

`agent_sprites.py` é a fonte de verdade: um corpo comum e, para cada agente, o
braço e a ferramenta. Desenhar sete bonecos inteiros à mão daria sete chances de o
corpo sair diferente.

## Mexer no desenho

```
# ver o resultado antes de gerar código
python tools/sprites/preview.py        # escreve sprites.png na mesma pasta

# gerar o arquivo que o frontend importa
python tools/sprites/generate_ts.py > frontend/src/pages/marketing/agentSprites.ts
```

Olhe o PNG antes de gerar. Pixel art de 20x16 é fácil de quebrar sem perceber: na
primeira versão os braços saíam da altura da orelha e só o render mostrou.

## Regras que o desenho precisa respeitar

- Cabeça em `x=7..12`, tronco em `x=6..13`.
- Braço esquerdo em `x=4..5`, direito em `x=14..15`, sempre começando em `y=8` ou
  `y=10`. Acima disso o braço nasce da cabeça.
- Ferramenta à esquerda em `x=0..3`, à direita em `x=16..19`.
- Dois quadros por agente. O segundo muda só braço e ferramenta: é a diferença
  entre os dois que dá a impressão de trabalho.
- Quadro, folha e tela são três retângulos brancos do mesmo tamanho. Cada um
  precisa de conteúdo próprio (gráfico, linhas de texto, cena pintada), senão à
  distância ninguém distingue qual agente é qual.

Depende de Pillow, que já está no `requirements.txt` do backend.
