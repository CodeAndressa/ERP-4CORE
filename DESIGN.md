---
name: 4Core ERP
description: Sistema interno de gestão comercial, financeira e de marketing da 4Core
colors:
  executive-indigo: "#2b165c"
  executive-indigo-light: "#3f2479"
  executive-indigo-soft: "#eeeaf6"
  executive-indigo-dim: "#2b165c17"
  neutral-bg: "#f8f7fb"
  surface: "#ffffff"
  surface-recessed: "#f4f2f8"
  surface-recessed-2: "#ebe7f3"
  border: "#2b165c21"
  border-strong: "#2b165c3d"
  ink: "#151127"
  ink-muted: "#5f5872"
  ink-dim: "#9189a3"
  success: "#047857"
  warning: "#b45309"
  danger: "#be123c"
  info: "#0891b2"
  sidebar-plum-deep: "#12081f"
  sidebar-plum-mid: "#1c0f42"
  sidebar-violet-active: "#4a2a94"
  sidebar-glow: "#7b00ff"
typography:
  heading:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0"
  title:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0"
  body:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "0"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.executive-indigo}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "#211047"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  badge:
    backgroundColor: "{colors.executive-indigo-soft}"
    textColor: "{colors.executive-indigo}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  input:
    backgroundColor: "{colors.surface-recessed}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
---

# Design System: 4Core ERP

## 1. Overview

**Creative North Star: "The Quiet Command Center"**

O 4Core ERP existe para desaparecer atrás da tarefa. A pessoa que abre o app no celular no meio de uma visita comercial, ou no financeiro fechando o mês, não deve notar o design — deve notar que encontrou o que precisava em segundos. A paleta gira inteira em torno de um único índigo executivo profundo sobre superfícies quase brancas: autoridade sem peso, precisão sem frieza. Não há teatro visual, não há gradientes de destaque, não há cards decorativos empilhados só para preencher espaço — cada elemento de cor, sombra ou movimento existe para comunicar estado (selecionado, pendente, sucesso, erro), nunca para decorar.

O sistema rejeita explicitamente o que PRODUCT.md chama de anti-referências: nada de landing page de SaaS, nada de dashboard genérico cheio de cards decorativos, nada de ERP antigo e pesado, nada de app desktop apenas encolhido no celular. Mobile é a superfície primária — cada fluxo (Leads, Pipeline, Follow-up, Agenda, Funil) precisa funcionar com o polegar antes de funcionar com o mouse.

**Key Characteristics:**
- Um único acento de cor (índigo executivo) carregando ações primárias, seleção e foco — nunca decoração.
- Superfícies quase-brancas em camadas sutis (branco → lavanda-cinza claro → lavanda-cinza mais escuro) em vez de sombras para indicar profundidade.
- Tipografia única (Inter) do título ao dado da tabela — sem par display/body.
- Bordas finas tingidas de índigo em vez de sombra como padrão; sombra reservada para elementos que literalmente flutuam sobre o conteúdo.
- Alvos de toque ≥44px e densidade calma: dados suficientes para decidir, nunca informação apertada.

## 2. Colors

Estratégia Restrained: neutros levemente tingidos de índigo + um único acento comprometido para ação e seleção. Cores semânticas (sucesso/aviso/erro/info) existem só para status, nunca como decoração de superfície.

### Primary
- **Índigo Executivo** (`#2b165c`): ação primária (botões, links ativos, ícone selecionado no menu), foco de formulário, barra de progresso do pipeline. É a única cor "cheia" do sistema — usada com moderação, nunca como fundo de tela inteira.
- **Índigo Executivo Claro** (`#3f2479`): texto/ícone sobre fundo claro quando o índigo sólido pesaria demais (badges, links secundários).
- **Índigo Suave** (`#eeeaf6`): fundo de badge padrão e hover discreto sobre itens de lista.

### Neutral
- **Fundo da Aplicação** (`#f8f7fb`): camada mais externa, atrás de toda a interface.
- **Superfície** (`#ffffff`): cards, painéis, campos de formulário focados.
- **Superfície Recuada** (`#f4f2f8`): inputs em repouso, linhas de tabela em hover, chips de filtro inativos.
- **Superfície Recuada 2** (`#ebe7f3`): terceira camada, usada com parcimônia (divisores de seção densos).
- **Tinta** (`#151127`): texto primário, quase preto com leve tom índigo.
- **Tinta Suave** (`#5f5872`): texto secundário, labels de campo, metadados.
- **Tinta Diluída** (`#9189a3`): placeholder, texto desabilitado, ícones inativos.
- **Borda** (`rgba(43,22,92,0.13)`): borda padrão de cards, inputs, divisores.
- **Borda Forte** (`rgba(43,22,92,0.24)`): borda em hover/estado ativo de componentes com borda.

### Named Rules
**A Regra do Acento Único.** O índigo executivo sólido cobre no máximo ~10% de qualquer tela: um botão primário, um item de menu ativo, uma barra de progresso. Todo o resto da hierarquia visual vem de peso tipográfico e camadas de superfície, não de mais cor.

**A Regra do Estado, Não da Decoração.** Emerald (`#047857`), amber (`#b45309`), rose (`#be123c`) e cyan (`#0891b2`) só aparecem em badges, ícones de status e alertas — nunca como fundo de card, nunca como destaque de texto sem significado de estado por trás.

## 3. Typography

**Body Font:** Inter (com system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI" como fallback)

**Character:** Uma família só, do título de página ao dado de tabela. Ferramenta de trabalho não precisa de par display/body — precisa de uma escala apertada e consistente que não compita com o conteúdo.

### Hierarchy
- **Heading** (700, 1.5rem fixo — 1.35rem em mobile, 1.25 line-height): título de página (`<h1>`), um por tela.
- **Title** (600, 0.875rem, 1.4 line-height): título de card/seção, cabeçalho de tabela.
- **Body** (400, 0.875rem, 1.55 line-height): texto corrido, valores de tabela, descrições de campo. Prosa longa (ex.: notas de lead) respeita 65–75ch.
- **Label** (600, 0.75rem, 1.3 line-height): rótulo de campo de formulário, badge, texto auxiliar de ajuda abaixo de inputs.

### Named Rules
**A Regra da Escala Fixa.** Tamanhos em `rem` fixos, não `clamp()`. A pessoa usando o ERP olha a tela num DPI consistente; título que encolhe fluido dentro de uma sidebar fica pior, não melhor. A única exceção documentada é o `<h1>` de página, que reduz para 1.35rem em telas ≤640px via media query explícita — não via `clamp()`.

## 4. Elevation

O sistema é flat por padrão: profundidade vem de troca de superfície (branco → lavanda-cinza) e borda fina tingida de índigo, não de sombra. Sombra aparece só quando um elemento literalmente flutua acima do conteúdo — um menu de ações no rodapé mobile, um dropdown, um popover.

### Shadow Vocabulary
- **Painel Flutuante** (`box-shadow: 0 18px 45px rgba(43,22,92,0.18)`): menus e folhas de ação que flutuam sobre o conteúdo em mobile (ex.: menu de navegação inferior expandido).

### Named Rules
**A Regra do Flat-por-Padrão.** Superfícies em repouso nunca têm sombra. Sombra é reservada para o estado "flutuando acima do documento" — se o elemento rola junto com o conteúdo, ele não leva sombra, leva borda.

## 5. Components

### Buttons
- **Shape:** cantos suavemente curvados (12px de raio).
- **Primary:** fundo Índigo Executivo (`#2b165c`), texto branco, padding `10px 16px`, altura mínima 44px em telas de toque.
- **Hover / Focus:** hover escurece para `#211047`; foco visível usa contorno de 2px em `rgba(43,22,92,0.52)` com 2px de offset — nunca `outline: none` sem substituto.
- **Ghost:** fundo transparente, borda padrão, texto cor Tinta; usado para ações secundárias (cancelar, editar) ao lado de uma ação primária.

### Chips / Badges
- **Style:** pílula (raio total), fundo suave da cor semântica (`*-50` equivalente), texto na variante mais escura da mesma cor, borda 1px na variante intermediária.
- **State:** variante `dot` adiciona um ponto de 6px sólido antes do texto para status em listas densas (ex.: status de lead).

### Cards / Containers
- **Corner Style:** 16px de raio.
- **Background:** Superfície (`#ffffff`), ou 88% de opacidade com `backdrop-filter: blur(16px)` na variante `glass` (uso raro, para painéis sobrepostos).
- **Shadow Strategy:** nenhuma em repouso; ver seção Elevation.
- **Border:** 1px Borda (`rgba(43,22,92,0.13)`), Borda Forte em hover quando o card é clicável.
- **Internal Padding:** 12px (compacto), 16–20px (padrão), 16–24px (amplo) — variantes `sm`/`md`/`lg` do componente `Card`.

### Inputs / Fields
- **Style:** fundo Superfície Recuada (`#f4f2f8`), sem borda visível em repouso, raio 12px, fonte 16px em mobile (evita zoom automático do iOS).
- **Focus:** contorno de 2px em `rgba(43,22,92,0.52)`, 2px de offset — mesmo tratamento de foco de botões e links.
- **Error:** substitui o texto de ajuda abaixo do campo por mensagem em Danger (`#be123c`); a borda do campo não fica vermelha sozinha (não depender só de cor).

### Navigation
- **Style:** sidebar fixa em desktop (240px expandida / 64px recolhida, transição spring). **Exceção Committed deliberada** (a única do sistema): a sidebar usa um degradê escuro próprio — ameixa quase preta (`sidebar-plum-deep` → `sidebar-plum-mid` → Índigo Executivo) — em vez das superfícies quase-brancas do resto do app, com um glow radial sutil de violeta elétrico (`sidebar-glow`, `#7B00FF`) atrás da logo. Essa paleta estende a identidade visual já usada nas artes de Instagram da 4Core (ver `marketing_brand_system.py`), então não é uma cor nova — é a mesma marca em outro contexto. Item ativo usa um gradiente `sidebar-violet-active → executive-indigo` com glow sutil (`box-shadow` em violeta, nunca stripe lateral); item inativo em lavanda clara a 62% de opacidade (contraste ~5.9:1 confirmado); hover acrescenta um véu branco a 7% de opacidade. Em mobile, navegação inferior fixa continua na superfície clara padrão, com o mesmo vocabulário de estado ativo/inativo do resto do app.
- **Typography:** Label (600, 0.75–0.8125rem), ícone 18px alinhado à esquerda do texto (sidebar desktop); 16px no restante da navegação.

## 6. Do's and Don'ts

### Do:
- **Do** manter o índigo executivo como o único acento sólido da interface; tudo mais é neutro ou semântico de estado.
- **Do** usar borda fina + troca de superfície para hierarquia; reservar sombra para elementos flutuantes.
- **Do** manter alvos de toque ≥44px e fonte de input ≥16px em qualquer tela ≤640px.
- **Do** respeitar `prefers-reduced-motion` em toda transição.
- **Do** usar uma família tipográfica só (Inter) do título ao dado de tabela.

### Don't:
- **Don't** parecer landing page de SaaS — sem hero de métrica gigante, sem gradiente decorativo, sem ícone flutuando sobre blur.
- **Don't** empilhar cards decorativos idênticos só para preencher a tela; um card só é a resposta certa quando agrupa dados que pertencem juntos.
- **Don't** parecer ERP antigo e pesado — sem tabelas impossíveis de tocar, sem texto truncado sem critério, sem navegação que force rolagem horizontal.
- **Don't** encolher o desktop para caber no mobile; cada fluxo principal é desenhado mobile-first e depois expandido.
- **Don't** usar `border-left`/`border-right` colorido como stripe decorativo em card ou alerta.
- **Don't** usar texto cinza claro "por elegância" — corpo de texto sempre ≥4.5:1 de contraste contra o fundo.
