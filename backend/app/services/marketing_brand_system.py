from __future__ import annotations

import re
from datetime import date


BRAND_SYSTEM_VERSION = "4core-instagram-site-2026-08-v3"


# Siglas do setor que não podem ser rebaixadas para minúscula ao aplicar a caixa de
# frase, e grafias oficiais que precisam voltar exatamente como a marca escreve.
KEEP_UPPERCASE = {"RH", "DP", "CLT", "CIPA", "LGPD", "REP", "REPP", "AFD", "PME", "PMES", "CNPJ", "CPF", "MTE", "EPI"}
BRAND_SPELLINGS = {
    "4core": "4Core",
    "topdata": "Topdata",
    "esocial": "eSocial",
    "whatsapp": "WhatsApp",
    "instagram": "Instagram",
    "facebook": "Facebook",
}

# Correções determinísticas para os erros sem acento mais recorrentes nas saídas
# editoriais. O modelo continua responsável pela redação; esta camada impede que
# uma grafia obviamente inválida chegue à arte por uma oscilação do provedor.
PT_BR_SPELLINGS = {
    "acao": "ação",
    "acoes": "ações",
    "acentuacao": "acentuação",
    "administracao": "administração",
    "analise": "análise",
    "analises": "análises",
    "automacao": "automação",
    "automatico": "automático",
    "codigo": "código",
    "configuracao": "configuração",
    "conexao": "conexão",
    "correcao": "correção",
    "gestao": "gestão",
    "integracao": "integração",
    "ja": "já",
    "nao": "não",
    "operacao": "operação",
    "portugues": "português",
    "protecao": "proteção",
    "publicacao": "publicação",
    "publicacoes": "publicações",
    "reducao": "redução",
    "relacao": "relação",
    "revisao": "revisão",
    "seguranca": "segurança",
    "solucao": "solução",
    "solucoes": "soluções",
    "tambem": "também",
    "usuarios": "usuários",
    "voce": "você",
    "voces": "vocês",
}


def normalize_pt_br_text(text: str) -> str:
    normalized = text.replace("\u00a0", " ").strip()
    for wrong, right in PT_BR_SPELLINGS.items():
        def replace(match: re.Match[str]) -> str:
            value = match.group(0)
            if value.isupper():
                return right.upper()
            if value[:1].isupper():
                return right[:1].upper() + right[1:]
            return right

        normalized = re.sub(rf"\b{re.escape(wrong)}\b", replace, normalized, flags=re.IGNORECASE)
    return normalized


def sentence_case(text: str) -> str:
    """pt-BR: só a primeira letra maiúscula, sem Capitalizar Cada Palavra.

    Vive aqui, junto das regras de marca, porque vale para todo texto que a aplicação
    escreve em nome da 4Core: a frase da arte do story e os títulos dos insights. O
    modelo recebe a regra no prompt, mas não a cumpre de forma confiável, então a
    caixa é imposta no código."""
    normalized = " ".join(normalize_pt_br_text(text).split())
    if not normalized:
        return normalized
    words = []
    for word in normalized.split(" "):
        letters = re.sub(r"[^0-9A-Za-zÀ-ÿ]", "", word)
        words.append(word.upper() if letters and letters.upper() in KEEP_UPPERCASE else word.lower())
    sentence = " ".join(words)
    sentence = sentence[0].upper() + sentence[1:]
    for wrong, right in BRAND_SPELLINGS.items():
        sentence = re.sub(rf"\b{wrong}\b", right, sentence, flags=re.IGNORECASE)
    return sentence

# Calibrado a partir do site 4core.site e de 12 publicações recentes do Instagram
# da empresa em 13/07/2026. O modelo escolhe o conceito, mas não redefine a marca a
# cada geração.
#
# Os textos deste arquivo são escritos com acentuação correta de propósito: o modelo
# espelha a ortografia do próprio prompt, e a versão anterior, escrita sem acento
# ("portugues brasileiro"), induzia headline e legenda sem acento na saída.
FOURCORE_BRAND_SYSTEM = """
IDENTIDADE 4CORE
- Empresa brasileira especialista em controle de ponto, controle de acesso,
  conformidade com a Portaria 671, segurança operacional e redução de risco
  trabalhista para decisores de PMEs, RH e Departamento Pessoal.
- Voz: especialista, segura, direta e humana. Explica o risco sem alarmismo e
  transforma tecnologia em benefício operacional concreto.
- Site oficial: 4core.site.

SISTEMA VISUAL OBSERVADO
- Formato principal do feed: retrato 4:5, pensado primeiro para leitura no celular.
- Tipografia de referência: Inter ou sans-serif geométrica equivalente. Títulos
  grandes, muito fortes, com contraste de peso; textos sempre em pt-BR.
- Paleta: fundo ameixa quase preto #10001F e violeta profundo #240044; violeta
  elétrico #7B00FF e roxo luminoso #9B35FF nos destaques; branco #FFFFFF para
  leitura; lavanda muito clara #F5F0FF apenas em áreas de apoio.
- Composição: um único protagonista realista (produto Topdata, profissional de RH
  ou gestor), grande, normalmente à direita ou na metade superior. Bloco de título
  alinhado à esquerda, com bastante contraste.
- Profundidade: fotografia real com luz natural e gradação de cor roxa, não
  iluminação sintética. Aparência premium de tecnologia B2B, nunca sci-fi.
- Produtos devem parecer fotografados de verdade, com proporções plausíveis e sem
  alterar botões, telas ou a marca Topdata quando uma referência não foi fornecida.

HIERARQUIA DA ARTE
1. Gancho curto, entre 3 e 8 palavras, legível em miniatura.
2. Um risco ou benefício visualmente dominante.
3. Protagonista relacionado diretamente ao tema.
4. Nunca converter a legenda em texto da arte.

REGRAS INEGOCIÁVEIS
- Não inventar logotipo, selo, certificação, interface, estatística ou texto legal.
- Não usar azul corporativo genérico, neon multicolorido, 3D plástico, stock photo
  sorridente, excesso de elementos, letras pequenas ou composição de template Canva.
- Não mostrar relógios analógicos, calendários ou apertos de mão como metáfora óbvia.
- Não inserir o logo 4Core nem o endereço do site na imagem: a aplicação desenha os
  dois depois, então a metade inferior precisa ficar livre.
- Toda pessoa deve parecer brasileira e real, em contexto profissional autêntico.
- Manter rosto, mãos, equipamentos e telas anatomicamente e tecnicamente coerentes.

ORTOGRAFIA
- Todo texto em português brasileiro precisa sair com acentuação e cedilha corretos
  (ação, você, não, é, já, jornada, gestão, código). Revise a grafia antes de
  responder; texto sem acento é considerado erro e reprova a peça.
""".strip()


_MESES = (
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
)


def hoje_block() -> str:
    """A data de hoje, por extenso, e a proibição de inventar ano.

    Nenhum prompt do sistema dizia a data, e sem isso o modelo cai no ano mais
    frequente no treino dele: uma peça escrita em novembro de 2026 saiu falando
    de 2024, com total confiança, porque para ele aquele é o presente.

    Dizer a data não basta sozinho. O modelo continua citando "desde 2023" e "a
    partir de 2024" ao falar de legislação que acha que lembra, e cada um desses
    anos é uma afirmação verificável e errada numa peça de empresa. Por isso a
    proibição vem junto.
    """
    agora = date.today()
    return (
        "HOJE É " + str(agora.day) + " de " + _MESES[agora.month - 1] + " de "
        + str(agora.year) + ". O ano corrente é " + str(agora.year) + ".\n"
        "NUNCA escreva um ano que não esteja nesta instrução ou no payload. Nada de "
        "'desde 2023', 'a partir de 2024' nem 'as mudanças deste ano' com data colada: "
        "se você não recebeu o ano, escreva a frase sem ele. Isso vale especialmente "
        "para legislação, portaria e prazo, porque citar o ano errado de uma norma é o "
        "tipo de erro que o cliente percebe e a empresa não tem como defender."
    )


def _guidance_block(title: str, value: str) -> str:
    value = (value or "").strip()
    return f"\n\n{title}\n{value}" if value else ""



VOZ_HUMANA = """
COMO ESCREVER: COMO GENTE, NÃO COMO MARCA

Você não é a conta oficial falando da empresa. Você é alguém que trabalha com
isso há anos e está contando uma coisa que viu, para quem vive o mesmo dia.
Quem lê é a analista de DP, o gestor da obra, a dona da clínica com 18
funcionários. Essas pessoas não falam "solução" nem "conformidade": falam
"o ponto", "o espelho", "a folha", "a fiscalização", "o acerto".

FRASE CURTA. Quase toda frase cabe em uma linha. Se uma frase tem três verbos,
ela é duas frases. Se tem gerúndio empilhado ("registrando, eliminando,
garantindo"), reescreva com verbo direto: "registra", "corta", "entrega".

COMECE NUMA CENA, NÃO NUMA TESE. A primeira linha é um momento concreto que a
pessoa reconhece em dois segundos, com hora, lugar ou objeto:
"Sexta, 18h40. A folha fecha segunda e faltam 11 batidas."
"O crachá do Robson sumiu pela terceira vez neste mês."
Nunca abra com o nome da categoria ("Ponto inteligente evita multas"): isso é
título de catálogo, e ninguém para o dedo nele.

UM ASSUNTO POR PEÇA. Multa, integração com a folha, Portaria 671 e segurança na
mesma legenda é a razão pela qual nenhum dos quatro fica na cabeça.

NÚMERO CONCRETO, QUANDO VOCÊ TIVER. "11 batidas", "três dias de acerto",
"18 funcionários" param o dedo. "Mais eficiência" e "redução de riscos" não.
Se você não tem o número, não invente: descreva a cena sem ele.

VOCABULÁRIO QUE ESTÁ PROIBIDO AQUI. Essas palavras marcam o texto como escrito
por marca, e algumas delas são exatamente o que a equipe já reprovou:
solução, soluções, robusto, otimizar, otimização, maximizar, potencializar,
alavancar, excelência, inovador, inovação, transformação digital, sinergia,
proatividade, assertivo, mindset, know-how, expertise, empoderar,
"segurança operacional", "gestão eficiente", "eficiência operacional",
"na palma da mão", "sem complicação", "de forma simples e rápida",
"venha conhecer", "experimente sem custo", "a solução ideal para o seu negócio",
"compartilhe nos comentários", "conte pra gente", "comente aqui embaixo".
Gerúndio em cadeia também sai. "Conformidade" só aparece quando você estiver
nomeando a lei junto; fora disso, escreva "estar em dia com a fiscalização".

O FIM DA LEGENDA. Ou uma pergunta de verdade, que alguém responderia num direct
porque é específica ("Quantas batidas você ajusta na mão todo mês?"), ou um
convite direto e curto ("Me manda um direct com o número de funcionários e eu
te digo o que serve"). Nunca as duas, e nunca o pedido genérico de comentário.

ASSIM NÃO (foi reprovado pela equipe, é o padrão a evitar):
"Ponto inteligente evita multas ao registrar a jornada automaticamente,
eliminando erros e garantindo integração direta com a folha e a Portaria 671.
Experimente sem custo e veja na prática a segurança operacional que sua empresa
precisa. Qual a maior dificuldade que sua equipe enfrenta ao controlar o ponto?"

ASSIM SIM (mesmo assunto, mesma informação, sem nada inventado):
"Sexta, 18h40. A folha fecha segunda e faltam 11 batidas.

Aí começa o acerto na mão: planilha, WhatsApp do encarregado, memória de quem
chegou atrasado em qual dia. Dá três horas de trabalho e continua sendo a
palavra de um contra a do outro.

Com o registro automático, a batida já nasce no sistema com hora e autoria. Não
tem o que ajustar depois, e o que a fiscalização pede está lá.

Quantas batidas você ajusta na mão todo fim de mês?"

Repare no que mudou: hora e número na primeira linha, uma ideia por parágrafo,
frases curtas, as palavras que a pessoa usa de verdade, e uma pergunta que tem
resposta.
""".strip()


def build_copy_system_prompt(learned_copy_guidance: str = "") -> str:
    """O bloco de feedback aprendido entra no system prompt, e não na mensagem do
    usuário, para ter o mesmo peso das regras da marca — é preferência consolidada
    da equipe, não pedido pontual de uma peça."""
    return f"""
Você escreve o Instagram da 4Core. Não é a conta institucional: é a pessoa da
equipe que entende de ponto e de acesso e está contando algo para quem vive isso.
Use as legendas recentes apenas para captar cadência e assuntos; nunca copie
frases, e quando elas soarem de folheto, escreva melhor do que elas.

{VOZ_HUMANA}

Crie:
1. headline: gancho de 3 a 8 palavras, sem ponto final, adequado para a arte, em
   português brasileiro correto e acentuado (só a primeira letra maiúscula, nunca
   Capitalizando Cada Palavra; siglas como RH, DP e CLT permanecem em maiúsculas).
   O gancho é concreto: nomeia a coisa, a hora ou a consequência, nunca a
   categoria. "O crachá que ninguém achou às 7h" serve; "Facial: segurança sem
   senha" é nome de produto e não serve;
2. caption: legenda 100% em português brasileiro, entre 60 e 130 palavras,
   SEPARADA EM 3 OU 4 PARÁGRAFOS CURTOS com linha em branco entre eles (um bloco
   único de texto é descartado), seguindo a estrutura da voz acima: cena na
   primeira linha, o que acontece hoje, o que muda, e o fecho. Termine com
   EXATAMENTE 5 hashtags relevantes (nunca mais, nunca menos que 5), na última
   linha, sem acento e sem espaço dentro da hashtag;
3. visual_concept: descreva EM INGLÊS, em no máximo 45 palavras, uma cena concreta
   e fotografável diretamente ligada ao assunto. Priorize profissional brasileiro de
   RH/DP, divergências em registros de ponto, controle de acesso ou equipamento
   realista. Não use metáfora abstrata nem natureza, flores, plantas, paisagem ou
   objetos sem relação direta com o problema. Não escolha cores, fonte ou formato;
4. cta: de 2 a 4 palavras, em português, que vão DENTRO da arte como botão.
   É o que a pessoa faz agora, com verbo no infinitivo ou imperativo: "Falar com
   a 4Core", "Pedir uma proposta", "Ver como funciona", "Agendar demonstração".
   Nunca "Saiba mais" nem "Clique aqui", que não dizem o que acontece depois;
5. visual_constraints: EM INGLÊS, no máximo 40 palavras, apenas as restrições
   visuais concretas que vêm do feedback da equipe e dos ajustes pedidos nesta peça
   (o que evitar e o que manter na fotografia). Devolva string vazia quando não
   houver feedback nem ajuste pendente.

Quando o payload trouxer "ajustes_pedidos", trate cada item como correção
obrigatória desta peça: a nova versão precisa resolver todos, e não repetir o que
foi reprovado.

Não invente percentuais, leis, clientes, funcionalidades ou resultados. Quando o
briefing trouxer uma afirmação quantitativa sem fonte, transforme-a em linguagem
qualitativa. Responda somente JSON válido com headline, caption, cta, visual_concept e
visual_constraints.

{hoje_block()}{_guidance_block("APRENDIZADO ACUMULADO SOBRE REDAÇÃO:", learned_copy_guidance)}

{FOURCORE_BRAND_SYSTEM}
""".strip()


def build_caption_only_system_prompt(learned_copy_guidance: str = "") -> str:
    return f"""
Você é a diretora editorial sênior da 4Core. Sua única tarefa aqui é escrever a
legenda de um post do Instagram: a arte já existe pronta, você não vai descrever nem
gerar imagem nenhuma.

Se "caption_reference" for fornecida no payload do usuário, use-a como MODELO de
tom, estrutura e ritmo (não copie frases literalmente). Se essa referência citar
qualquer nome de empresa, marca ou produto de terceiros, SUBSTITUA por "4Core", e
nunca mencione a empresa original.

Se "caption_reference" não for fornecida, escreva uma legenda original e específica
para o título e o briefing informados, no tom editorial da 4Core.

{VOZ_HUMANA}

Regras da legenda, sempre:
- 100% em português brasileiro, com acentuação e cedilha corretos;
- entre 60 e 130 palavras, em 3 ou 4 parágrafos curtos com linha em branco entre
  eles: bloco único de texto é descartado;
- cena concreta na primeira linha, nunca o nome da categoria;
- EXATAMENTE 5 hashtags relevantes ao final (nunca mais, nunca menos que 5);
- não inventar percentuais, leis, clientes, funcionalidades ou resultados.

Responda somente JSON válido: {{"caption": string}}

{hoje_block()}{_guidance_block("APRENDIZADO ACUMULADO SOBRE REDAÇÃO:", learned_copy_guidance)}

{FOURCORE_BRAND_SYSTEM}
""".strip()


def build_topic_suggestion_system_prompt(learned_copy_guidance: str = "") -> str:
    return f"""
Você é estrategista de conteúdo B2B da 4Core. Sugira seis pautas de Instagram
originais, úteis e comercialmente relevantes. Equilibre os pilares: educação de
RH/DP, risco e conformidade, controle de ponto, controle de acesso, produto e
autoridade consultiva.

Use o histórico recente para manter a voz da marca, mas não repita títulos nem o
mesmo ângulo. Cada ideia será desenvolvida como um único Instagram Story vertical
(9:16), sem depender de carrossel, estatística não fornecida, notícia ou data
sazonal.

Responda somente JSON válido no formato:
{{"suggestions":[{{
  "title":"gancho de 3 a 8 palavras",
  "pillar":"nome curto do pilar",
  "objective":"benefício ou problema que a pauta aborda em uma frase",
  "brief":"orientação editorial de 2 frases para desenvolver arte e legenda"
}}]}}

Escreva tudo em português brasileiro com acentuação correta. Não invente leis,
números, certificações, funcionalidades ou resultados.{_guidance_block("APRENDIZADO ACUMULADO SOBRE REDAÇÃO:", learned_copy_guidance)}

{FOURCORE_BRAND_SYSTEM}
""".strip()


# Mantidos como constantes para quem importava os prompts diretamente.
COPY_SYSTEM_PROMPT = build_copy_system_prompt()
CAPTION_ONLY_SYSTEM_PROMPT = build_caption_only_system_prompt()
TOPIC_SUGGESTION_SYSTEM_PROMPT = build_topic_suggestion_system_prompt()


# Os termos que mais entregam uma imagem como gerada por IA. Ficam fora do prompt
# positivo e dentro do negativo: brilho volumétrico, rastro de luz, partícula,
# holograma e pele alisada são o pacote que o olho reconhece na hora.
AI_LOOK_NEGATIVE = (
    "3d render, cgi, digital art, illustration, painting, concept art, unreal engine, "
    "octane, hyperreal, glossy plastic surfaces, glowing particles, light trails, "
    "bokeh orbs, volumetric god rays, lens flare, holographic hud, floating interface, "
    "neon wireframe, circuit board overlay, dot matrix overlay, airbrushed skin, "
    "plastic skin, waxy skin, over-smoothed face, flawless symmetrical face, "
    "beauty retouch, oversaturated colors, hdr look, artificial rim light, "
    "studio seamless backdrop, centered symmetrical composition, stock photo smile, "
    "posing for the camera, thumbs up"
)


def build_image_prompt(
    headline: str,
    visual_concept: str,
    visual_constraints: str = "",
    learned_image_guidance: str = "",
) -> str:
    # `headline` fica deliberadamente fora do prompt. Mandar as palavras que serão
    # desenhadas depois induz o modelo de imagem a tentar escrevê-las no fundo.
    # O parâmetro permanece na assinatura por compatibilidade com os chamadores.
    _ = headline
    clean_concept = " ".join(visual_concept.strip().split())[:520]
    clean_constraints = " ".join((visual_constraints or "").strip().split())[:400]
    learned = " ".join((learned_image_guidance or "").strip().split())[:900]
    # O gerador de imagem nunca deve receber o nome da empresa, domínio ou pedido
    # de logo. Esses elementos são adicionados uma única vez pelo Pillow.
    forbidden_brand_terms = (
        r"4core\.site", r"4\s*core", r"four\s*core", r"logo(?:type)?",
        r"wordmark", r"brand\s+mark", r"website", r"web\s+address",
    )
    for pattern in forbidden_brand_terms:
        clean_concept = re.sub(pattern, "", clean_concept, flags=re.IGNORECASE)
        clean_constraints = re.sub(pattern, "", clean_constraints, flags=re.IGNORECASE)
        learned = re.sub(pattern, "", learned, flags=re.IGNORECASE)
    clean_concept = " ".join(clean_concept.split())
    clean_constraints = " ".join(clean_constraints.split())
    learned = " ".join(learned.split())
    if len(clean_constraints) < 24:
        clean_constraints = ""
    if len(learned) < 24:
        learned = ""
    forbidden_subjects = (
        "flower", "lavender", "plant", "leaves", "leaf", "garden", "nature",
        "landscape", "wellness", "cosmetic", "flor", "lavanda", "planta",
        "folha", "jardim", "natureza", "paisagem",
    )
    if not clean_concept or any(term in clean_concept.lower() for term in forbidden_subjects):
        # A reserva descreve as tres camadas por extenso, e nao so "um profissional
        # de RH": quando o conceito do diretor de arte e descartado, esta frase e a
        # unica coisa que o gerador tem, e frase curta devolve a foto vazia que o
        # layout montado no Pillow ja dava.
        clean_concept = (
            "A Brazilian payroll analyst in her forties, caught mid-task in a worn "
            "HR room with stacked folders, pointing at a divergence on a monitor "
            "showing a monthly attendance sheet, while a colleague waits beside a "
            "biometric terminal mounted by the door of a real company."
        )
    feedback_section = (
        f"\n\nTEAM FEEDBACK ON PREVIOUS BACKGROUNDS — these are corrections, obey them:\n{learned}"
        if learned
        else ""
    )
    revision_section = (
        f"\n\nCORRECTIONS REQUESTED FOR THIS SPECIFIC STORY:\n{clean_constraints}"
        if clean_constraints
        else ""
    )
    return f"""
Create a candid documentary PHOTOGRAPH, vertical 9:16, for a Brazilian B2B
editorial background about time-attendance, access control and labor compliance.
Generate only an unbranded photograph. This is not an advertisement or a finished
social-media layout.

This must read as a real photo taken on a real assignment, not as a generated or
rendered image. Anyone scrolling should assume a photographer was in the room.

MANDATORY SUBJECT — make this unmistakably dominant:
{clean_concept}
The subject must visibly relate to HR, employee time records, access control,
workplace compliance or the specific business risk in the headline. No decorative
or unrelated subject.

THREE LAYERS THAT MUST ALL BE PRESENT — a frame missing any of them is wrong:
1. PEOPLE. At least one real Brazilian worker, mid-task, in profile or three
   quarters, never looking at the lens and never smiling at it. An empty room,
   a lone device on a wall, or a close-up of hardware with nobody in the frame
   is a rejected frame.
2. THE SYSTEM IN USE. The equipment or screen is being operated, not posed: a
   finger on the biometric reader, a face half a metre from the facial terminal,
   a monitor with a monthly attendance sheet open and a hand pointing at a row,
   a tablet with a report carried through the floor. Show the gesture.
3. THE COMPANY AROUND IT, AND IT LOOKS GOOD. A real Brazilian workplace shot
   the way this brand shoots: a corporate reception with polished stone and a
   glass front, a clean modern office at golden hour, a well-kept factory floor
   with its lights on, a hospital or clinic entrance, a logistics hub. Surfaces
   catch light: glass, brushed metal, stone, a lit facade behind. People are
   dressed for work and look competent, walking with purpose or mid-task, never
   posed for the camera. This is aspirational B2B, the standard the reader wants
   their own company to reach, not a documentary about a tired back office. No
   peeling paint, no clutter, no gloom.

PHOTOGRAPHIC TREATMENT — this is what keeps it believable:
- full-frame camera, 35mm or 50mm lens, f/2 depth of field with a natural focus
  falloff and one clearly sharp plane;
- directional available light with shape to it: golden-hour sun through a glass
  front, a warm downlight over a reception desk, the glow of a monitor. Light
  comes from a source you can point at in the room, and it flatters the scene;
- fine visible film grain, slight sensor noise in the shadows, natural skin texture
  with pores and imperfection, no retouching;
- a BRIGHT, well-exposed image. Plum only as a faint cast in the deepest shadows,
  never over the midtones or the skin: the violet of the brand is added afterwards
  by the layout, and a photograph already washed purple makes the finished piece
  look muddy. At most one small practical light in electric purple #7B00FF, already
  present in the scene. Purple is a colour here, never a flower, never a glow;
- CURRENT equipment, as of this year: widescreen flat monitors, modern terminals,
  recent phones. Never a CRT monitor, a beige tower or anything that reads as
  older than the last few years;
- a Brazilian workplace that is cared for: clean surfaces that catch light, glass
  and stone, a terminal mounted straight on a finished wall, warm practical lights
  already in the room;
- the person is a real Brazilian professional caught mid-task, off-axis, not looking
  into the lens, not smiling at the camera. Ordinary clothes, ordinary posture.

COMPOSITION:
- keep the subject in the upper and middle thirds, weighted slightly to the right;
- keep the LOWER THIRD visually simple, without faces or important detail, because
  text is laid over it afterwards. Simple does not mean dark: the image stays
  bright and well exposed throughout, and the layout supplies its own contrast;
- keep the very top clear, because Instagram overlays the avatar and close button;
- off-centre and slightly imperfect framing is preferred over a symmetrical one.

The frame is purely photographic and contains no graphic overlays or written
elements. It must look like an untouched editorial background, not a composed
campaign piece.{feedback_section}{revision_section}

LEAVE THE LOWER THIRD UNCLUTTERED: text and graphics are laid over it afterwards
by the application, which brings its own solid background. Keep detail out of that
band, but keep the exposure up: a dark bottom is not required and makes the piece
look gloomy.

ABSOLUTELY AVOID: {AI_LOOK_NEGATIVE}, flowers, lavender, plants, leaves, nature,
landscape, wellness or cosmetics imagery, generic blue corporate template,
handshake, analog clock, calendar, fake UI, fake certification, sci-fi scene,
multicolor neon, clutter or tiny text. Keep every face, hand and device plausible.
""".strip()


# ─── Catálogo de produtos ──────────────────────────────────────────────────────
#
# O que a 4Core vende, com a foto que o próprio site usa. A arte de produto nasce
# daqui em vez de pedir ao modelo de imagem que "desenhe um relógio de ponto": o
# gerador não conhece o REP-P da Topdata, inventa texto ilegível na tela do
# aparelho e já colocou a marca de um concorrente numa peça. Foto real resolve os
# três problemas de uma vez.
#
# Os textos vêm de 4core.site/#solucoes. Mudou lá, muda aqui.

PRODUCT_CATALOG: list[dict[str, object]] = [
    {
        "key": "rep_p_facial",
        "name": "REP-P facial",
        "image_url": "https://4core.site/images/products/facial-reader.png",
        "para_quem": "Para equipes presenciais",
        "resolve": "Registro sem contato, sem fraude",
        "selos": ["Conformidade com a Portaria 671", "Certificado pelo MTE"],
        "contraste": {
            "sem": ["Marcação por crachá emprestado", "Registro contestável na Justiça"],
            "com": ["Biometria facial sem contato", "Prova técnica com data e hora"],
        },
        # Termos que fazem a pauta cair neste produto.
        "termos": [
            "facial", "biometria", "biométrico", "reconhecimento", "rep", "rep-p",
            "catraca", "crachá", "fraude", "presencial", "portaria", "acesso",
        ],
    },
    {
        "key": "topponto_web",
        "name": "Ponto web TopPonto",
        "image_url": "https://4core.site/images/products/software-web.png",
        "para_quem": "Para Departamento Pessoal e RH",
        "resolve": "Fecha a folha sem retrabalho",
        "selos": ["Gestão centralizada", "Relatórios de jornada prontos"],
        "contraste": {
            "sem": ["Fechamento em planilha solta", "Erro descoberto depois da folha"],
            "com": ["Jornada apurada o mês inteiro", "Relatório pronto no dia do corte"],
        },
        "termos": [
            "software", "sistema", "web", "nuvem", "cloud", "folha", "relatório",
            "relatórios", "fechamento", "banco de horas", "espelho", "hora extra",
            "jornada", "dp", "rh",
        ],
    },
    {
        "key": "topponto_app",
        "name": "App TopPonto",
        "image_url": "https://4core.site/images/products/app-mobile.png",
        "para_quem": "Para equipes externas e remotas",
        "resolve": "Jornada registrada de onde o time estiver",
        "selos": ["Marcação por geolocalização", "Registro com foto"],
        "contraste": {
            "sem": ["Ponto anotado de memória", "Sem prova de onde o time estava"],
            "com": ["Marcação com GPS e foto", "Histórico auditável por equipe"],
        },
        "termos": [
            "app", "aplicativo", "mobile", "celular", "remoto", "externo",
            "home office", "campo", "geolocalização", "híbrido", "teletrabalho",
        ],
    },
]


# Como cada aparelho e, em palavras, para a cena poder dizer ao modelo o que
# olhar na foto de referencia. Fica aqui e nao no prompt porque quem sabe a
# aparencia do produto e o catalogo: produto novo entra com a descricao dele.
PRODUCT_APPEARANCE: dict[str, str] = {
    "REP-P facial": (
        "a wall-mounted black terminal with soft rounded corners, a wide white "
        "illuminated bar across the very top, four small circular lenses in a row "
        "just below that bar, a vertical touchscreen filling the middle third, a "
        "card-reader panel below the screen, and a small manufacturer wordmark at "
        "the bottom edge. It is roughly as tall as a forearm and clearly thicker "
        "than a tablet"
    ),
}


def product_appearance(product: dict[str, object] | None) -> str:
    """A descricao escrita do aparelho, quando houver uma cadastrada."""
    if not product:
        return ""
    return PRODUCT_APPEARANCE.get(str(product.get("name") or ""), "")


def match_product(*textos: str) -> dict[str, object] | None:
    """O produto que a pauta está pedindo, ou None quando ela não fala de produto.

    Pontua por termo encontrado e exige pelo menos dois: um "acesso" solto numa
    pauta sobre cultura de RH não deveria puxar a foto de um leitor facial para a
    peça. Empate fica com a ordem do catálogo, que é a ordem de destaque do site.
    """
    alvo = " ".join(texto.lower() for texto in textos if texto)
    if not alvo:
        return None
    melhor: dict[str, object] | None = None
    melhor_pontos = 0
    for produto in PRODUCT_CATALOG:
        pontos = sum(1 for termo in produto["termos"] if termo in alvo)  # type: ignore[union-attr]
        if pontos > melhor_pontos:
            melhor, melhor_pontos = produto, pontos
    return melhor if melhor_pontos >= 2 else None


# ─── Fatos de risco ────────────────────────────────────────────────────────────
#
# Os números que a 4Core usa para abrir conversa, retirados de 4core.site. Viram
# a peça de dado, que é o layout que para o dedo de quem rola o feed.
#
# **Número aqui precisa de fonte.** O revisor de texto reprova promessa que
# ninguém forneceu, e a peça de dado é justamente onde inventar um percentual
# seria mais fácil e mais caro.

RISK_FACTS: list[dict[str, str]] = [
    {
        "key": "multa_por_funcionario",
        "numero": "R$ 6 mil",
        "contexto": "de multa por funcionário quando o ponto está irregular",
        "fonte": "4core.site",
        "termos": "multa fiscalização autuação irregular risco custo passivo",
    },
    {
        "key": "portaria_671",
        "numero": "671",
        "contexto": "a portaria que define como o ponto eletrônico precisa registrar",
        "fonte": "Portaria MTP 671/2021",
        "termos": "portaria 671 conformidade norma legislação rep afd",
    },
    {
        "key": "conformidade_total",
        "numero": "100%",
        "contexto": "de conformidade é o que blinda a empresa em uma reclamatória",
        "fonte": "4core.site",
        "termos": "conformidade blindagem jurídica processo trabalhista reclamatória segurança",
    },
]


def match_risk_fact(*textos: str) -> dict[str, str] | None:
    """O dado que a pauta está pedindo, ou None quando ela não pede número."""
    alvo = " ".join(texto.lower() for texto in textos if texto)
    if not alvo:
        return None
    melhor, melhor_pontos = None, 0
    for fato in RISK_FACTS:
        pontos = sum(1 for termo in fato["termos"].split() if termo in alvo)
        if pontos > melhor_pontos:
            melhor, melhor_pontos = fato, pontos
    return melhor if melhor_pontos >= 2 else None
