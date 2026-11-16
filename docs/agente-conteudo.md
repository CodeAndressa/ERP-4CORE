# Esteira de marketing

Tela: `/marketing/agente`. Sete agentes em sequência, cada um com uma função, da
leitura dos concorrentes até a peça de feed agendada e esperando aprovação.

## Os agentes, na ordem

| # | Agente | O que faz | Consome modelo |
|---|---|---|---|
| 1 | Analista de concorrência | Le os perfis observados e compara com o @4coreconsultoria | nao |
| 2 | Estrategista de pauta | Transforma as lacunas encontradas em temas | texto |
| 3 | Redator | Escreve o gancho da arte, a legenda e o conceito visual | texto |
| 4 | Revisor de texto | Corrige portugues, tira cara de IA, reforca a chamada | texto |
| 5 | Diretor de arte | Traduz o conceito aprovado em instrucao de imagem | texto |
| 6 | Ilustrador | Gera a arte 4:5 e compoe a marca por cima | imagem |
| 7 | Agendador | Define data e hora de cada peca na cadencia pedida | nao |

A ordem vem de `AGENT_ROSTER` em `marketing_agent_service.py`. A tela desenha os nos
a partir dessa lista, entao incluir um agente la ja o faz aparecer no painel.

**A esteira nao publica.** Ela termina em peca `awaiting_approval` com `scheduled_at`
sugerido. A publicacao continua saindo pelo cron `/marketing/content/process-due`, que
so olha peca aprovada. Isso e proposital: a revisao humana e o que alimenta o
`MarketingArtLesson`, o aprendizado que melhora as artes seguintes.

## O revisor de texto

E o agente que existe para a peca nao parecer gerada por maquina. Ele recebe o que o
redator escreveu e reprova em cinco frentes:

1. **Ortografia**: pt-BR com acentuacao e cedilha. Palavra sem acento reprova.
2. **Cara de IA**: clichê de texto gerado ("no mundo de hoje", "revolucionar",
   "nao e apenas X, e Y"), entusiasmo vazio, adjetivo empilhado, frase que serviria
   para qualquer empresa de qualquer setor, emoji decorando cada linha.
3. **Voz da marca**: especialista, segura, direta e humana.
4. **Promessa**: numero, percentual, selo ou garantia que ninguem forneceu reprova.
5. **Chamada**: a legenda precisa terminar provocando resposta.

Ele sempre devolve `headline_final` e `caption_final`, mesmo aprovando. **O que vai
para a peca e a versao do revisor, nunca a do redator** — e por isso que existe um
teste so para isso. A nota de 0 a 10 aparece na tela ao lado de cada peca.

## Arte de feed

Peca de feed e 4:5, 1080x1350. A composicao e propria (`_compose_feed_art`), separada
da do story, com duas diferencas que importam:

- **Sem escurecer o topo.** No story aquela faixa cobre a interface da Meta; no feed
  nao existe interface ali e o degrade so sujava a foto.
- **Frase maior.** O feed aparece em miniatura na grade do perfil, e o gancho precisa
  sobreviver a esse tamanho.

O endereco do site fica na mesma linha de base do logo, a direita, em vez de empilhado:
no feed o leitor ja tem o @ do perfil no topo da publicacao.

## Arte de produto

Quando a pauta fala de algo que a 4Core vende, a peca **nao passa por modelo de
imagem**. Ela e montada em `_compose_product_art` com a foto real do produto, a
mesma que o site usa.

O motivo e pratico: o gerador nao conhece o REP-P da Topdata. Ele desenha um
aparelho parecido com texto ilegivel na tela, e numa peca de 16/11/2026 colocou a
marca de um concorrente no equipamento. Foto real resolve os tres de uma vez, e
ainda sai sem custo.

O catalogo fica em `PRODUCT_CATALOG`, no `marketing_brand_system.py`:

| produto | para quem | foto |
|---|---|---|
| REP-P facial | equipes presenciais | `4core.site/images/products/facial-reader.png` |
| Ponto web TopPonto | Departamento Pessoal e RH | `.../software-web.png` |
| App TopPonto | equipes externas e remotas | `.../app-mobile.png` |

Os textos vem de `4core.site/#solucoes`. **Mudou no site, muda no catalogo.**

`match_product()` escolhe o produto pontuando termos da pauta e exige **pelo menos
dois acertos**: um "acesso" solto numa pauta sobre cultura de RH nao deveria puxar
a foto de um leitor facial.

### O que o layout resolve

- **O texto e montado de cima para baixo** e a foto ocupa o que sobra. O contrario,
  ancorar a foto e espremer o texto na coluna restante, dava uma coluna estreita
  demais para um gancho de oito palavras, e a frase saia cortada pela margem.
- **`_fit_headline` sempre devolve a frase quebrada**, mesmo quando nem o menor
  corpo cabe na altura. Devolver a linha inteira ali foi o que vazou a margem.
- **Produto so encosta a direita quando e nitidamente vertical** (razao acima de
  1,4). O notebook tem 1,05 e ancora-lo a direita abria um vazio na metade esquerda.
- **O corte e por alfa real**, nao por `getbbox`. Os PNGs do site trazem uma sombra
  larga e levissima em volta, e cortar por ela deixava o produto pequeno e fora do
  centro dentro da propria caixa.
- **Foto de cena ganha canto arredondado**; produto recortado mantem a silhueta. A
  deteccao e a proporcao de pixels opacos.
- **O apoio some quando repete o gancho.** "Feche a folha sem refazer o mes" com
  "Fecha a folha sem retrabalho" embaixo era eco; `_echoes` compara radicais de 4
  letras e corta o segundo.

### Pegadinha do Pillow

`ImageDraw` **grava o pixel, nao compoe alfa**. Desenhar a pilula do nome do
produto com `fill=(255,255,255,40)` direto no canvas produzia uma pilula branca
solida que engolia o proprio texto, porque o alfa sumia no `convert("RGB")` final.
A pilula e desenhada numa camada e entra por `alpha_composite`.

## Quando publicar

Duas perguntas separadas, em `marketing_schedule_service.py`:

**Que horas?** Sai do historico do proprio perfil, cruzando a hora de cada post com o
engajamento que ele teve, no fuso de Sao Paulo. Usa **media** por hora, nao soma: somar
premiaria a hora em que o perfil mais publicou, que e justamente o vicio a corrigir.
Abaixo de 8 publicacoes com engajamento, devolve 9h e marca como **nao medido** — a
tela avisa. Tabela generica de "melhores horarios do Instagram" nao serve: o publico
da 4Core e decisor de PME e RH.

**Que dia?** Cadencia fixa, padrao de 2 dias, contada a partir da ultima publicacao ja
comprometida (agendada no ERP ou registrada como externa), nunca a partir de hoje.
Sem isso, rodar a esteira duas vezes no mesmo dia marcaria duas pecas para a mesma data.
Fim de semana e pulado: publico B2B conversa em dia util.

## Fuso horario

Duas correcoes de 16/11/2026 que vale nao desfazer.

**O horario na tela vinha 3h adiantado.** O SQLite devolve datetime sem tzinfo
mesmo com `DateTime(timezone=True)`, e `isoformat()` sem fuso faz o `new Date()`
do navegador ler o valor UTC como se fosse local. As datas da rodada saem por
`_iso_utc()`, que marca o fuso antes de serializar.

**A peca publicava 3h adiantada.** Mais serio que o anterior. O `slot` do
agendador nasce em `America/Sao_Paulo`, porque o publico e brasileiro e "9h" quer
dizer 9h daqui. Ele era gravado como estava, enquanto o `process_due` compara com
`datetime.now(timezone.utc)`: uma peca marcada para as 9h era considerada vencida
quando o relogio UTC batia 9h, ou seja, **as 6h da manha de Sao Paulo**, bem longe
do horario que o agendador calculou pelo engajamento.

Agora a esteira grava `slot.astimezone(timezone.utc)`, que e a convencao que o
Estudio (`marketing_content.py`) ja usava com `_utc()` e `_iso()`. Tem teste
fixando que 9h de Sao Paulo chega ao banco como 12h.

> Pecas agendadas **antes** dessa correcao guardam hora local e saem 3h adiantadas.
> Sao poucas e de teste; se aparecer alguma antiga agendada, conferir o horario.

## Custo

Cada passo grava uma linha em `marketing_agent_steps` com provedor, modelo, tokens,
imagens, custo e duracao. O painel soma por agente e por periodo.

Ha duas qualidades de numero, e a tela distingue as duas:

- **Medido**: o provedor devolveu o custo da chamada. O OpenRouter faz isso em
  `usage.cost`, desde que a requisicao va com `usage: {include: true}`.
- **Estimado** (marcado com asterisco): so vieram os tokens, e o valor sai da tabela
  de precos em `marketing_agent_cost.py`. Preco de modelo muda, entao estimativa
  envelhece. Conferir em console.groq.com/docs/pricing e openrouter.ai/models quando
  a conta nao bater com o painel do provedor.

A Cloudflare entra como custo zero de proposito: ela cobra por neuronio dentro de uma
franquia diaria, e nao por imagem. Dentro da franquia o custo marginal e zero mesmo;
estourar a franquia aparece na fatura da Cloudflare, nao aqui.

Na pratica o ilustrador sozinho pesa mais que todos os agentes de texto somados.

## Provedores de imagem

Ordem em `generate_art_with_usage`:

1. **OpenRouter**, se `OPENROUTER_API_KEY` existir. Endpoint `POST /api/v1/images`,
   compativel com o formato da OpenAI. Modelo padrao `black-forest-labs/flux.2-klein-4b`,
   cobrado por megapixel (cerca de 0,0145 dolar numa arte 1080x1350). Vale pela chave
   unica e pelo custo real na resposta.
2. **Cloudflare Workers AI**, se as credenciais existirem. Mais barato dentro da
   franquia, mas nao informa custo por chamada.

O texto continua no Groq quando `GROQ_API_KEY` existe. O OpenRouter so assume o texto
se `OPENROUTER_TEXT_MODEL` for preenchido de proposito, para ninguem trocar de provedor
sem querer so por ter colado a chave para gerar imagem.

## De onde vem o dado do concorrente

Da **Business Discovery** do Graph API. Oficial, usa o token ja conectado em
Marketing > Conexoes e nao cobra por chamada.

- So enxerga conta **Comercial ou Criador de conteudo**. Perfil pessoal ou privado o
  Instagram nao abre para terceiros.
- So devolve o que e publico: seguidores, publicacoes, curtidas e comentarios.
  **Alcance, impressoes e salvamentos de concorrente nao existem em API nenhuma.**
- Crescimento de seguidores so aparece na **segunda** sincronizacao.
- **@ que nao existe volta como "Invalid user id"**, subcode 2207013, e nao como
  "does not exist". Vale lembrar ao mexer no tradutor de erro: a frase da Meta nao
  e a que se espera, e antes de 16/11/2026 isso fazia a tela pedir para tentar de
  novo num perfil que nunca iria responder.

## Metricas

- **Taxa de engajamento**: `(media de curtidas + media de comentarios) / seguidores * 100`.
- **Posts por semana**: publicacoes na janela, normalizadas para sete dias.
- Janela padrao de 30 dias. Perfil que nao publicou na janela cai para o historico
  inteiro em vez de sumir da comparacao.

## Rodada automatica

`.github/workflows/agente-conteudo.yml` chama `POST /marketing/agent/run-cron` toda
segunda as 11h UTC, autenticado pelo `MARKETING_CRON_SECRET`. Cria 2 pecas de feed em
vez das 3 da rodada manual, porque ninguem esta olhando na hora para descartar.

## Quando algo nao aparece

| Sintoma | Causa provavel |
|---|---|
| "Configure META_PAGE_ID e META_PAGE_ACCESS_TOKEN" | Conexao com a Meta ausente ou expirada |
| Concorrente com erro de "so enxerga perfil Comercial" | Conta pessoal, privada ou @ errado. A mensagem diz que tentar de novo nao resolve, porque a Meta responde `is_transient: false`: o @ precisa ser conferido no proprio Instagram |
| Leitura sem pautas, aviso de "sem IA" | Nem `GROQ_API_KEY` nem `OPENROUTER_API_KEY` com modelo de texto |
| Custo com asterisco | Estimado pela tabela, nao informado pelo provedor |
| Horario marcado como nao medido | Menos de 8 publicacoes com engajamento no historico |
| Esteira para no ilustrador | Sem credencial de imagem, ou cota do provedor estourada |
| Crescimento de seguidores zerado | So houve uma sincronizacao ate agora |

## Conferir o ambiente

`Sistema > Ambiente` lista os 8 grupos de variaveis, o que cada um desbloqueia e
onde a chave e obtida. No terminal, o mesmo relatorio sai com:

```
python backend/scripts/check_env.py
```

Tela e script leem o mesmo `GROUPS` de `env_status_service.py`, entao nunca
discordam. Nenhum dos dois imprime valor de chave, so se esta preenchida.

Dois detalhes que custaram tempo e viraram regra:

- **Ler o Instagram nao depende do app da Meta.** `META_APP_ID` e `META_APP_SECRET`
  servem so ao botao Conectar via Meta. Para a esteira ler perfil, posts e
  concorrentes bastam `META_PAGE_ID` e `META_PAGE_ACCESS_TOKEN`.
- **`[SENSITIVE]` nao conta como preenchido.** E o que o `vercel env pull` grava no
  lugar de variavel do tipo Secret, que a Vercel nunca devolve. Sem essa regra a
  tela diria que esta tudo certo com um .env inutil.

## Arquivos

- `backend/app/services/marketing_agent_service.py` (a esteira e os agentes)
- `backend/app/services/marketing_agent_llm.py` (chamada de modelo com medicao)
- `backend/app/services/marketing_agent_cost.py` (tabela de precos e contabilidade)
- `backend/app/services/marketing_schedule_service.py` (melhor horario e cadencia)
- `backend/app/services/marketing_competitor_service.py` (Business Discovery)
- `backend/app/services/marketing_content_service.py` (arte de feed e provedores)
- `backend/app/routes/marketing_agent.py`
- `backend/alembic/versions/011_marketing_agent.py` e `012_marketing_agent_steps.py`
- `frontend/src/pages/marketing/AgenteIaPage.tsx`
- `backend/app/services/env_status_service.py` e `backend/scripts/check_env.py`
- `frontend/src/pages/sistema/AmbientePage.tsx`
- `backend/tests/test_marketing_competitors.py`, `test_marketing_pipeline.py` e `test_env_status.py`
