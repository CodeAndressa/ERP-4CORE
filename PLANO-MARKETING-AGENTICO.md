# O exército de marketing da 4Core

Plano para transformar a esteira atual no sistema agêntico que a Andressa
descreveu, com uma tela só. Escrito em 17/11/2026, depois de ler 20 páginas de
fontes primárias (Anthropic, papers de LLM-as-judge, e os produtos reais do
mercado: Creatify, Typeface, Jasper, Jacquard/Phrasee, Persado, AdCreative,
Icon, Predis, Taplio).

Este documento separa três coisas, de propósito:
o que **já existe** e só precisa aparecer; o que **falta construir**; e o que a
pesquisa diz que **não vai funcionar**, para não gastarmos dinheiro nisso.

---

## 1. O que já existe hoje

Antes de montar um exército novo, vale registrar que **oito dos agentes pedidos
já estão rodando em produção**:

| Agente pedido | Já existe? | Nome atual |
|---|---|---|
| Varre o Instagram | Parcial | `analista` lê os 3 concorrentes, mas não procura o que está bombando |
| Monta pauta | **Sim** | `estrategista` |
| Monta roteiro | **Sim** | `redator` |
| Lidera tudo | **Sim** | `diretor_criacao` decide o ângulo antes de alguém escrever |
| Constrói a arte | **Sim** | `diretor_arte` + `ilustrador` |
| Revisa o texto | **Sim** | `revisor_texto`, e **já dá nota de 0 a 10** |
| Revisa a arte | **Não** | não existe |
| Nota < 7 manda refazer | **Não** | a nota é registrada e ignorada |
| Métricas | Parcial | tela de métricas existe, agente não |
| Valida se o post engajou | **Não** | não existe |
| Realimenta ideia e planejamento | **Sim** | `marketing_art_learning.py` destila o seu feedback em `copy_rules` e `image_rules`, que entram nos prompts |

Ou seja: o ciclo de aprendizado que mais importa **já está fechado**, e por um
caminho melhor do que o que você descreveu. Volto a isso no item 5.

---

## 2. O que a pesquisa muda no desenho

Quatro achados que contrariam a intuição e economizam dinheiro.

### 2.1 Multiagente custa 15× e quase nunca se paga numa peça

A Anthropic mediu: um sistema multiagente consome **~15× mais tokens** que um
chat, e um agente simples ~4×. A conclusão deles é literal: *"multi-agent
systems require tasks where the value of the task is high enough to pay for the
increased performance"*.

Um post de Instagram **não é** uma tarefa de alto valor unitário. Gastar 15× para
escrever uma legenda é indefensável.

**Onde multiagente se paga:** na camada de **inteligência**, que é
*breadth-first*, estoura janela de contexto e usa muitas ferramentas — varrer
dezenas de perfis, 30 dias de métricas e tendências do nicho. É exatamente o
perfil que a Anthropic descreve como bom encaixe.

**Decisão:** o Batedor (varredura) é multiagente e roda **semanalmente**. A
produção da peça continua sendo um encadeamento determinístico. Isso não é
economia de rato: é onde a própria fonte diz que o ganho existe.

### 2.2 O juiz que você pediu funciona, mas com cinco travas

Você pediu: "agente que dá nota, se menor que 7 manda refazer". Isso é o padrão
**evaluator-optimizer**, e funciona (Self-Refine, NeurIPS 2023: ~20 pontos
percentuais de ganho sobre geração de uma tacada só). Mas a literatura é dura
sobre como ele falha:

| Risco medido | Número | Trava que entra no projeto |
|---|---|---|
| Viés de verbosidade | juízes preferem o texto mais longo **>90%** das vezes | Normalizar tamanho antes de julgar, e instruir contra. **Sem isso o loop faz as peças crescerem a cada iteração**, que é o pior resultado possível em social |
| Viés de auto-elogio | modelo favorece a própria saída em **~10%** | O juiz é de **família diferente** do gerador. Gerador = Claude Haiku; juiz = Gemini ou Groq |
| Recall baixo em reprovar | juiz pega **30–60%** do que está sutilmente ruim | O juiz é filtro de volume, **nunca o portão final**. Você continua aprovando |
| Loop que oscila | — | Para se a nota não melhorar entre iterações |
| Custo sem teto | — | Máximo **2 refações**, e orçamento por peça, não por sessão |

E um detalhe de implementação que a Anthropic achou testando: **uma chamada só,
com nota contínua e um veredito passa/não passa, foi mais consistente com o
julgamento humano do que vários juízes especializados.** Ou seja, um comitê de
cinco agentes críticos é pior e mais caro que um juiz bem escrito.

**Nota por dimensão, não média.** Uma peça com voz de marca 9 e erro de
português 3 não pode passar com média 6.

**Portão de código antes do portão de IA.** Contagem de caracteres, 5 hashtags,
CTA presente, lista de palavras proibidas, proporção da imagem: tudo isso é
código, custa zero token, e já reprova boa parte. Só o que sobra vai para o juiz.

### 2.3 Com o seu volume, métricas geram hipótese, não decisão

Você publica algo entre 8 e 20 peças por mês. A pesquisa é clara sobre o que isso
sustenta:

**É defensável:**
- Comparar **famílias** (formato, pilar, ângulo), nunca posts individuais
- Efeitos **grandes e persistentes**: carrossel bate feed por 3× durante 3 meses seguidos
- Ranking ordinal dentro do mês: "qual foi o melhor post de novembro"
- **O que você rejeitou na aprovação**, que é o dado mais valioso e não depende de alcance nenhum

**É superstição:**
- "O post com emoji performou 12% melhor" (n=1 contra n=1)
- Horário ótimo tirado do seu próprio feed (1 a 2 posts por faixa horária)
- Atribuir o post viral a uma causa (alcance em social tem cauda pesada; outlier quase sempre é algoritmo)
- "Mudei o prompt e o engajamento subiu 20%" (sazonalidade e regressão à média explicam sem você)

A Typeface mostra **o tamanho da amostra em cada recomendação**. A Creatify
escreve na tela "ainda não é um vencedor comprovado" quando os intervalos se
sobrepõem. Vamos fazer igual: **toda hipótese nasce com o n ao lado.**

### 2.4 O que o mercado inteiro já tentou e abandonou

- **Publicação autônoma não existe** em nenhum produto sério. Creatify: *"Not by default"*. Taplio: *"Nothing posts until you confirm."* O mercado convergiu para humano no meio, sem exceção.
- **Prever performance é cara-ou-coroa.** A Persado rodou 2.086 campanhas A/B reais: modelos gerais acertam o vencedor em **51%** e dão o mesmo ranking em **3,5%** das vezes.
- **A Icon.com levantou US$ 30M+**, com investidores da OpenAI e da DeepMind, e hoje vende na primeira dobra do site "**no AI / 100% real**". O criativo voltou a ser humano; a IA ficou na camada de workflow.
- **59% dos profissionais não conseguem provar ROI de IA** (Jasper, n=1.400), e o **segundo maior obstáculo é "falta de qualidade do output"** — com 91% de adoção. O problema deixou de ser acesso à IA e passou a ser o que sai dela.

Isso não é motivo para não fazer. É motivo para fazer a parte que funciona:
**a IA resolve volume e primeira versão; o julgamento continua seu.**

---

## 3. O exército, desenhado

Onze agentes, em três camadas. Os marcados com ✅ já existem.

### Camada 1 — Inteligência (semanal, multiagente, fora da peça)

**1. Batedor** `NOVO`
Varre o Instagram atrás do que está performando no nicho, não só nos 3
concorrentes: hashtags do setor, perfis de RH e DP, contas de notícia
trabalhista. Para cada post que destoa da média do autor, responde: do que
fala, que formato usa, qual é o gancho, e **como isso se liga ao que a 4Core
vende**. Entrega de 5 a 10 achados com link e número.
*Aqui o multiagente se paga: são muitas contas, muitas chamadas, e o resultado
é usado o mês inteiro.*

**2. Analista** ✅ `analista`
Compara a 4Core com os concorrentes. Já roda.

**3. Memorialista** `NOVO`
Lê o que foi publicado nos últimos 90 dias com o desempenho real e produz
**hipóteses com tamanho de amostra**: "peças de pilar conformidade tiveram 2,1×
os salvamentos de peças de produto (n=7 contra n=9, 3 meses)". Nunca produz
ordem, só hipótese rotulada.

### Camada 2 — Produção (por peça, encadeamento determinístico)

**4. Estrategista** ✅ — vira pauta, agora recebendo o Batedor e o Memorialista
**5. Diretor de criação** ✅ — decide o ângulo
**6. Redator** ✅ — gancho, legenda, CTA
**7. Revisor de texto** ✅ — já dá nota; passa a disparar refação
**8. Diretor de arte** ✅ — briefing da imagem
**9. Ilustrador** ✅ — gera a arte

**10. Crítico de arte** `NOVO`
Olha a imagem gerada **com visão**, não o prompt dela. Avalia em quatro
dimensões, cada uma com nota e um trecho citado do que está errado:

| Dimensão | O que reprova |
|---|---|
| Fidelidade ao produto | o aparelho desenhado não é o da 4Core |
| As três camadas | falta pessoa, falta o sistema em uso, ou falta a empresa em volta |
| Legibilidade | o gancho não se lê em miniatura; o rodapé está poluído |
| Marca | paleta fora da identidade; selo ou logo errado |

Se qualquer dimensão ficar abaixo do corte, devolve ao Ilustrador **com a
crítica específica**, no máximo duas vezes. Se não melhorar entre tentativas,
para e manda para você com a ressalva. Este é o agente que a pesquisa mostra ter
o melhor retorno, porque arte errada é o defeito mais caro: já aconteceu de
desenharmos um aparelho que não é o seu.

**11. Agendador** ✅

### Camada 3 — Validação (mensal)

**12. Auditor** `NOVO`
Depois que a peça foi ao ar, compara o que foi prometido na aprovação com o que
aconteceu: alcance, salvamentos, comentários, e se os comentários têm a ver com
o tema. Alimenta o Memorialista. **Produz hipótese com n, não veredito.**

---

## 4. A tela única

Uma tela, quatro faixas. Substitui Esteira, Estúdio, Ideias e Calendário.

```
┌─────────────────────────────────────────────────────────────────────┐
│ MARKETING          [tema: Black Friday ▾]   [rodar]  US$4,92 · 123  │
├─────────────────────────────────────────────────────────────────────┤
│ O EXÉRCITO                                                          │
│  ▸ linha de 11 agentes em pixel art, com o estado de cada um        │
│    quem está trabalhando pulsa e fala num balão                     │
│    quem reprovou mostra a nota em vermelho                          │
├─────────────────────────────────────────────────────────────────────┤
│ O QUE O BATEDOR ACHOU ESTA SEMANA                                   │
│  ▸ 5 achados, cada um: o post, o número, e o gancho para a 4Core    │
│    [virar pauta] em cada                                            │
├─────────────────────────────────────────────────────────────────────┤
│ IDEIAS → EM PRODUÇÃO → PARA APROVAR → AGENDADAS → PUBLICADAS        │
│  ▸ colunas, a peça atravessa                                        │
│  ▸ cada peça em aprovação mostra a nota do revisor e do crítico     │
├─────────────────────────────────────────────────────────────────────┤
│ PAINEL DE APROVAÇÃO (abre ao lado, não em outra tela)               │
│  ▸ a arte grande, a legenda editável, a data                        │
│  ▸ as notas das duas revisões, com o que cada uma apontou           │
│  ▸ CAMPO DE MUDANÇA EM LINGUAGEM NATURAL:                           │
│    "deixa a foto mais clara e troca a frase para falar de multa"    │
│    [refazer com esse ajuste]  ← refaz na hora, sem sair da tela     │
└─────────────────────────────────────────────────────────────────────┘
```

O campo de mudança em linguagem natural é o ponto central do seu pedido e
precisa ser melhor do que "rejeitar e torcer": ele vira `visual_constraints` e
`ajustes_pedidos`, que **já existem nos prompts** e hoje só são alimentados pelo
formulário de rejeição.

---

## 5. O que já funciona e você talvez não saiba

O `marketing_art_learning.py` já faz o ciclo de aprendizado que você descreveu,
e por um caminho que a pesquisa diz ser **melhor** do que aprender com métricas:

Toda vez que você aprova, rejeita ou dá feedback numa peça, isso é guardado.
Quando acumula o mínimo, um agente destila aquilo em até 10 `copy_rules` e 10
`image_rules`, que entram nos prompts do redator e do diretor de arte.

A Jacquard treina exatamente assim, no que o time aprova e rejeita. E a razão é
estatística: com 20 peças por mês, você gera **20 rótulos de qualidade humanos**,
que são muito mais informativos que 20 contagens de curtida. O seu julgamento é
o dado escasso e caro; alcance é barato e ruidoso.

**Conclusão:** o Auditor de métricas entra, mas em terceiro lugar de prioridade.
O que já existe vale mais.

---

## 6. Custo

Medido nas rodadas reais de ontem, não estimado:

| Item | Hoje | Depois |
|---|---|---|
| Arte (OpenRouter, por imagem) | US$ 0,0397 | igual |
| Texto dos agentes criativos | US$ 0,002 | US$ 0,003 |
| Crítico de arte (visão) | — | ~US$ 0,004 |
| Refação, quando acontece | — | +US$ 0,044 |
| **Peça aprovada de primeira** | **US$ 0,042** | **~US$ 0,047** |
| **Peça que precisou refazer uma vez** | — | **~US$ 0,091** |

Batedor: ~US$ 0,30 por varredura semanal, ou **US$ 1,20/mês**.
Auditor e Memorialista: ~US$ 0,05 por rodada mensal.

Com 16 peças por mês e um terço precisando refazer: **~US$ 2,10/mês**.
O saldo atual de US$ 4,92 cobre mais de dois meses.

Se a conta mudar, muda por causa da arte, que é 94% do custo. Nenhum agente de
texto chega perto disso, e é por isso que o Crítico de arte se paga: evitar uma
arte ruim economiza mais do que todos os agentes de texto somados.

---

## 7. Ordem de execução

**Fase 1 — O crítico de arte e o loop de refação** (maior retorno)
Evita o defeito mais caro, que é arte errada chegando até você. Inclui as cinco
travas do item 2.2. É o que você pediu como "nota menor que 7 manda refazer".

**Fase 2 — A tela única**
O exército visível, o quadro de colunas, o painel de aprovação com o campo de
mudança em linguagem natural. É o que mais muda o seu dia.

**Fase 3 — O Batedor**
Varredura semanal do nicho, com os achados virando pauta num clique. É a parte
que hoje não existe de verdade: o analista só olha 3 concorrentes.

**Fase 4 — Auditor e Memorialista**
O ciclo com métricas reais, com tamanho de amostra em cada hipótese. Por último
porque o aprendizado por feedback humano, que já existe, vale mais com o seu
volume.

---

## 8. O que eu recomendo NÃO fazer

1. **Não fazer multiagente na produção da peça.** 15× o custo, sem ganho medido para esta tarefa.
2. **Não criar um comitê de agentes críticos.** A Anthropic testou e um juiz só, bem escrito, foi mais consistente.
3. **Não deixar nada publicar sozinho.** Nenhum produto sério do mercado faz isso.
4. **Não prometer que a IA prevê o que vai performar.** 51% de acerto é cara-ou-coroa.
5. **Não tirar conclusão de métrica com menos de ~30 posts por categoria.** Hipótese com n, sempre.
6. **Não deixar o loop de refação sem teto nem sem trava de verbosidade.** Sem isso as peças crescem a cada iteração e ficam piores.

---

## Fontes

Anthropic, *Building effective agents* e *How we built our multi-agent research
system*. Madaan et al., *Self-Refine* (NeurIPS 2023, arXiv:2303.17651). Zheng et
al., *Judging LLM-as-a-Judge* (NeurIPS 2023, arXiv:2306.05685). Eugene Yan,
*LLM-evaluators*. Páginas de produto e documentação de Creatify, Typeface,
Jasper, Jacquard, Persado, AdCreative.ai, Icon.com, Predis.ai, Taplio.
*State of AI in Marketing 2026* (Jasper, n=1.400).
