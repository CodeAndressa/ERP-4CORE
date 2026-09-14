from __future__ import annotations

import base64
import io
import json
import re
from pathlib import Path
from typing import Any

import httpx
from fastapi import HTTPException
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

FONT_PATH = Path(__file__).resolve().parents[1] / "assets" / "fonts" / "Inter-Variable.ttf"


def _font(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    """Inter suporta acentuacao pt-BR (ç, ã, õ...) — o load_default() do
    Pillow usa uma fonte embutida com charset limitado que quebra esses
    caracteres."""
    font = ImageFont.truetype(str(FONT_PATH), size=size)
    try:
        font.set_variation_by_name(weight)
    except OSError:
        pass
    return font

from app.core.config import settings
from app.services.groq_service import groq_error_detail, groq_model_id
from app.services.marketing_asset_service import store_generated_art
from app.services.marketing_brand_system import (
    AI_LOOK_NEGATIVE,
    normalize_pt_br_text,
    sentence_case,
    build_caption_only_system_prompt,
    build_copy_system_prompt,
    build_image_prompt,
    build_topic_suggestion_system_prompt,
)


BRAND_LOGO_URL = (
    "https://erp-4-core.vercel.app/"
    "Logo%20com%20Tipografia%204Core%20-%20Principal%20Transparente.png"
)

CLOUDFLARE_KLEIN_MODEL = "@cf/black-forest-labs/flux-2-klein-4b"
CLOUDFLARE_SCHNELL_MODEL = "@cf/black-forest-labs/flux-1-schnell"
# A variável pode continuar salva com o valor antigo na Vercel. Esse modelo custa
# dezenas de vezes mais neurônios por story, então fazemos a migração também em
# runtime e não dependemos de uma alteração manual no painel.
DEPRECATED_CLOUDFLARE_IMAGE_MODELS = {"@cf/leonardo/lucid-origin"}


FALLBACK_TOPIC_SUGGESTIONS = [
    {
        "title": "Seu ponto resiste a uma auditoria?",
        "pillar": "Conformidade",
        "objective": "Ajudar o RH a reconhecer fragilidades antes que elas se transformem em risco trabalhista.",
        "brief": "Mostre os sinais de um controle de ponto pouco confiável. Oriente uma revisão preventiva de processos, registros e responsabilidades.",
    },
    {
        "title": "Quando a planilha vira risco",
        "pillar": "Gestão de ponto",
        "objective": "Evidenciar os limites do controle manual de jornada.",
        "brief": "Compare a rotina manual sujeita a retrabalho com um processo centralizado e rastreável, sem prometer resultados numéricos.",
    },
    {
        "title": "Acesso seguro sem criar filas",
        "pillar": "Controle de acesso",
        "objective": "Mostrar que segurança e fluidez operacional podem caminhar juntas.",
        "brief": "Explique como um projeto adequado de acesso protege ambientes sem prejudicar a experiência de colaboradores e visitantes.",
    },
    {
        "title": "O fechamento não precisa ser caos",
        "pillar": "RH e DP",
        "objective": "Conectar tecnologia de ponto a uma rotina de fechamento mais previsível.",
        "brief": "Aborde os erros acumulados durante o mês e a importância de acompanhar divergências antes do fechamento da folha.",
    },
    {
        "title": "Biometria certa para cada operação",
        "pillar": "Produto",
        "objective": "Educar sobre a escolha do equipamento conforme o ambiente e a operação.",
        "brief": "Mostre que a decisão envolve fluxo, ambiente, integração e perfil de uso, e não apenas o modelo do equipamento.",
    },
    {
        "title": "Conformidade começa no processo",
        "pillar": "Consultoria",
        "objective": "Posicionar a 4Core como parceira de diagnóstico e implantação.",
        "brief": "Explique por que tecnologia sem processo bem definido não elimina riscos e como uma implantação consultiva faz diferença.",
    },
    {
        "title": "5 riscos que ninguém te conta sobre ponto e acesso",
        "pillar": "Ponto e controle de acesso",
        "objective": "Entregar avisos rápidos e pouco discutidos que façam o gestor salvar o post antes de terminar de ler.",
        "brief": (
            "Monte um carrossel ou estático com exatamente 5 dicas, cada uma com no máximo 12 palavras, "
            "diretas e pouco faladas sobre falhas comuns em relógio ponto e controle de acesso. Use estas "
            "cinco como base, sem inventar estatística ou selo:\n"
            "1. Espelho de ponto sem assinatura digital enfraquece sua prova em ação trabalhista.\n"
            "2. Ajuste manual de ponto sem justificativa registrada pode virar passivo trabalhista.\n"
            "3. Catraca sem antipassback deixa um crachá liberar várias pessoas juntas.\n"
            "4. Biometria facial ao ar livre erra mais que a leitura digital.\n"
            "5. App de ponto sem geolocalização não comprova onde o funcionário estava.\n"
            "Tom direto, sem gancho de venda, foco em fazer o leitor salvar o post."
        ),
    },
]


async def suggest_content_topics(
    recent_captions: list[str],
    existing_titles: list[str],
    learned_copy: str = "",
) -> list[dict[str, str]]:
    if not settings.groq_api_key:
        return FALLBACK_TOPIC_SUGGESTIONS
    payload = {
        "recent_instagram_captions": recent_captions[:15],
        "titles_already_in_editorial_queue": existing_titles[:40],
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
            json={
                "model": groq_model_id(),
                "temperature": 0.78,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": build_topic_suggestion_system_prompt(learned_copy)},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
            },
        )
    if response.status_code >= 400:
        raise HTTPException(502, groq_error_detail(response, "sugerir temas"))
    try:
        raw = json.loads(response.json()["choices"][0]["message"]["content"])["suggestions"]
        suggestions = []
        used_titles = {" ".join(title.lower().split()) for title in existing_titles}
        for value in raw[:6]:
            suggestion = {
                "title": normalize_pt_br_text(str(value["title"]))[:180],
                "pillar": str(value["pillar"]).strip()[:60],
                "objective": normalize_pt_br_text(str(value["objective"]))[:500],
                "brief": normalize_pt_br_text(str(value["brief"]))[:2000],
            }
            normalized_title = " ".join(suggestion["title"].lower().split())
            if len(suggestion["title"]) >= 3 and normalized_title not in used_titles:
                suggestions.append(suggestion)
                used_titles.add(normalized_title)
        for fallback in FALLBACK_TOPIC_SUGGESTIONS:
            normalized_title = " ".join(fallback["title"].lower().split())
            if len(suggestions) >= 6:
                break
            if normalized_title not in used_titles:
                suggestions.append(fallback)
                used_titles.add(normalized_title)
        return suggestions or FALLBACK_TOPIC_SUGGESTIONS
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(502, "A IA retornou sugestoes em formato invalido.") from exc


def normalize_uploaded_art(content: bytes) -> bytes:
    try:
        image = Image.open(io.BytesIO(content))
        image.load()
        image = image.convert("RGB")
    except (OSError, ValueError) as exc:
        raise HTTPException(422, "Envie uma imagem PNG, JPG ou WEBP valida.") from exc
    width, height = image.size
    if width < 400 or height < 500:
        raise HTTPException(422, "A arte precisa ter no minimo 400 x 500 pixels.")
    if abs((width / height) - 0.8) > 0.012:
        raise HTTPException(422, "A arte precisa estar no formato retrato 4:5, por exemplo 1080 x 1350 px.")
    image = image.resize((1080, 1350), Image.Resampling.LANCZOS)
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


async def generate_copy_and_prompt(
    title: str,
    brief: str,
    recent_captions: list[str],
    revision_notes: str = "",
    learned: dict[str, str] | None = None,
) -> dict[str, str]:
    """revision_notes são os ajustes pedidos nesta peça; learned é o feedback já
    consolidado de todos os stories anteriores. A redação também devolve as
    restrições visuais em inglês, então o feedback escrito em português chega bem
    formado ao gerador de imagem sem custar uma chamada extra de tradução."""
    learned = learned or {}
    if not settings.groq_api_key:
        headline = normalize_pt_br_text(" ".join(title.split()))[:90]
        return {
            "headline": headline,
            "caption": normalize_pt_br_text(f"{title}\n\n{brief}".strip()),
            "image_prompt": build_image_prompt(
                headline,
                brief or title,
                learned_image_guidance=learned.get("image", ""),
            ),
        }

    payload = {
        "title": title,
        "brief": brief,
        "recent_instagram_captions": recent_captions[:12],
        "ajustes_pedidos": [note for note in revision_notes.splitlines() if note.strip()],
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
            json={
                "model": groq_model_id(),
                "temperature": 0.55,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": build_copy_system_prompt(learned.get("copy", ""))},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
            },
        )
    if response.status_code >= 400:
        raise HTTPException(502, groq_error_detail(response, "gerar a redação"))
    try:
        result = json.loads(response.json()["choices"][0]["message"]["content"])
        headline = normalize_pt_br_text(str(result["headline"]))
        return {
            "headline": headline,
            "caption": normalize_pt_br_text(str(result["caption"])),
            "image_prompt": build_image_prompt(
                headline,
                str(result["visual_concept"]),
                str(result.get("visual_constraints") or ""),
                learned.get("image", ""),
            ),
        }
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(502, "A IA de redação retornou um formato inválido.") from exc


async def generate_caption_only(
    title: str,
    brief: str,
    caption_reference: str,
    recent_captions: list[str],
    learned_copy: str = "",
) -> str:
    """Só a legenda — usada quando a arte já existe (gerada aqui ou enviada
    pronta pela usuária) e não precisa passar pelo gerador de imagem de novo."""
    if not settings.groq_api_key:
        base = caption_reference.strip() or f"{title}\n\n{brief}".strip()
        return base

    payload = {
        "title": title,
        "brief": brief,
        "caption_reference": caption_reference.strip(),
        "recent_instagram_captions": recent_captions[:12],
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
            json={
                "model": groq_model_id(),
                "temperature": 0.55,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": build_caption_only_system_prompt(learned_copy)},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
            },
        )
    if response.status_code >= 400:
        raise HTTPException(502, groq_error_detail(response, "gerar a legenda"))
    try:
        result = json.loads(response.json()["choices"][0]["message"]["content"])
        return normalize_pt_br_text(str(result["caption"]))
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(502, "A IA de redação retornou um formato inválido.") from exc


def _openai_error(response: httpx.Response) -> HTTPException:
    detail: Any = response.text[:300]
    code = ""
    try:
        error = response.json().get("error", {})
        detail = error.get("message", detail)
        code = str(error.get("code") or error.get("type") or "")
    except ValueError:
        pass
    marker = f"{code} {detail}".lower()
    if "billing hard limit" in marker or "billing_hard_limit" in marker or "insufficient_quota" in marker:
        return HTTPException(
            402,
            "A OpenAI bloqueou a geração porque o limite de cobrança do projeto foi atingido. "
            "Regularize os créditos ou aumente o limite em platform.openai.com/settings/organization/billing e tente novamente.",
        )
    return HTTPException(502, f"Falha ao gerar a arte: {detail}")


def _cloudflare_error(response: httpx.Response) -> HTTPException:
    detail: Any = response.text[:300]
    try:
        payload = response.json()
        errors = payload.get("errors") or []
        if errors:
            detail = errors[0].get("message") or detail
    except ValueError:
        pass
    marker = str(detail).lower()
    if response.status_code == 429 or "quota" in marker or "neuron" in marker or "limit" in marker:
        return HTTPException(
            429,
            "A franquia gratuita diária do Cloudflare Workers AI foi atingida. "
            "Ela é renovada diariamente às 00:00 UTC; tente novamente depois das 21h no horário de Brasília.",
        )
    if response.status_code in {401, 403}:
        return HTTPException(
            503,
            "A Cloudflare recusou as credenciais. Confirme CLOUDFLARE_ACCOUNT_ID e "
            "CLOUDFLARE_API_TOKEN com permissões Workers AI Ler e Editar.",
        )
    return HTTPException(502, f"Falha ao gerar a arte na Cloudflare: {detail}")


def _crop_to_story(content: bytes) -> bytes:
    """A arte por IA agora só alimenta Stories (9:16) — os posts de feed usam
    arte enviada pronta pela usuária, sem passar por geração/recorte aqui."""
    source = Image.open(io.BytesIO(content)).convert("RGB")
    target_ratio = 9 / 16
    width, height = source.size
    crop_height = min(height, round(width / target_ratio))
    crop_width = min(width, round(height * target_ratio))
    left = max(0, (width - crop_width) // 2)
    top = max(0, (height - crop_height) // 2)
    cropped = source.crop((left, top, left + crop_width, top + crop_height))
    output = io.BytesIO()
    cropped.save(output, format="PNG", optimize=True)
    return output.getvalue()


def _wrap_headline(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if not current or draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


# O endereço vai desenhado na arte porque a API da Meta não permite anexar sticker
# de link em Story publicado por aplicativo — sem isso não há como o story levar
# ninguém para o site.
STORY_SITE_URL = "4core.site"

PLUM = (14, 0, 26)
VIOLET = (123, 0, 255)


def _story_scrim(width: int, height: int) -> Image.Image:
    """Gradiente montado em uma coluna de 1px e esticado na horizontal. A versão
    anterior percorria pixel a pixel, o que dava centenas de milhares de iterações
    de Python por arte.

    Também escurece de leve o topo: é onde o Instagram desenha avatar, nome e X, e
    deixar aquela faixa com contraste é o que faz o story parecer desenhado para o
    formato em vez de uma imagem qualquer jogada no fundo."""
    column = Image.new("RGBA", (1, height), (0, 0, 0, 0))
    pixels = column.load()
    bottom_span = max(1, round(height * 0.56))
    bottom_start = height - bottom_span
    top_span = max(1, round(height * 0.16))
    for y in range(height):
        if y >= bottom_start:
            alpha = round(236 * ((y - bottom_start) / bottom_span) ** 1.7)
        elif y < top_span:
            alpha = round(96 * (1 - y / top_span) ** 1.6)
        else:
            alpha = 0
        if alpha:
            pixels[0, y] = (*PLUM, min(255, alpha))
    return column.resize((width, height), Image.Resampling.NEAREST)


def _sanitize_generated_layout(image: Image.Image) -> Image.Image:
    """Neutraliza letras inventadas no topo sem desenhar um bloco sobre a foto.

    O tratamento anterior cobria também o quadrante superior esquerdo com dois
    recortes opacos. Mesmo com feather, os limites do segundo recorte apareciam
    como um quadrado escuro sobre a fotografia. Agora o blur e a cor se dissipam
    verticalmente por toda a largura, dentro da área já reservada para a interface
    do Instagram.
    """
    result = image.convert("RGBA")
    width, height = result.size
    top_span = max(1, round(height * 0.20))
    softened = result.filter(ImageFilter.GaussianBlur(radius=max(8, round(width * 0.018))))
    softened = Image.alpha_composite(softened, Image.new("RGBA", result.size, (*PLUM, 178)))

    mask = Image.new("L", result.size, 0)
    mask_draw = ImageDraw.Draw(mask)
    for y in range(top_span):
        opacity = round(236 * (1 - y / top_span) ** 1.8)
        mask_draw.line((0, y, width, y), fill=opacity)
    result.paste(softened, (0, 0), mask)
    return result


def _film_grain(image: Image.Image, strength: float = 0.11) -> Image.Image:
    """Grão sutil aplicado por cima de tudo, tipografia incluída. Fundo liso com
    texto perfeitamente limpo é um dos sinais mais fáceis de imagem gerada por
    computador; o grão coloca foto e texto na mesma superfície."""
    noise = Image.effect_noise((image.width, image.height), 16).convert("L")
    grain = Image.merge("RGB", (noise, noise, noise))
    return Image.blend(image, ImageChops.overlay(image, grain), strength)


def _compose_brand_art(background: bytes, logo_content: bytes, headline: str) -> bytes:
    """Composição exclusiva de Stories (9:16): frase, endereço do site e logo em uma
    pilha alinhada à esquerda na metade inferior, deixando o topo limpo para a
    interface da Meta e a base com folga acima da barra de resposta.

    O alinhamento à esquerda é intencional. Tudo centralizado, com filete decorativo
    no meio, é a assinatura de template automático — e contradizia a própria direção
    de arte da marca, que descreve o bloco de título à esquerda."""
    canvas = _sanitize_generated_layout(Image.open(io.BytesIO(background)))
    width, height = canvas.size
    canvas = Image.alpha_composite(canvas, _story_scrim(width, height))
    draw = ImageDraw.Draw(canvas)

    margin_x = round(width * 0.085)
    content_width = width - margin_x * 2
    bottom_safe = round(height * 0.105)

    logo = Image.open(io.BytesIO(logo_content)).convert("RGBA")
    logo_bbox = logo.getbbox()
    if logo_bbox is None:
        raise ValueError("Logo oficial sem conteúdo visível")
    logo = logo.crop(logo_bbox)
    logo_width = round(width * 0.23)
    logo_height = round(logo.height * logo_width / logo.width)
    logo = logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS)

    # A frase define a altura de todo o bloco, então é medida antes de posicionar.
    safe_headline = sentence_case(headline)[:90]
    max_text_height = round(height * 0.30)
    headline_font = _font(round(height * 0.052), "ExtraBold")
    headline_lines = [safe_headline]
    line_step = round(height * 0.055)
    for font_size in range(round(height * 0.072), round(height * 0.035), -2):
        font = _font(font_size, "ExtraBold")
        lines = _wrap_headline(draw, safe_headline, font, content_width)
        ascent, descent = font.getmetrics()
        # 1.06em: entrelinha fechada, como se espera de tipografia de display. O
        # 1.14em anterior deixava a frase com cara de parágrafo de texto corrido.
        step = round(font_size * 1.06)
        if len(lines) <= 5 and step * (len(lines) - 1) + ascent + descent <= max_text_height:
            headline_font, headline_lines, line_step = font, lines, step
            break

    url_font = _font(max(20, round(height * 0.0245)), "SemiBold")
    url_width = round(draw.textlength(STORY_SITE_URL, font=url_font))
    url_ascent, url_descent = url_font.getmetrics()
    url_height = url_ascent + url_descent
    pad_x = round(height * 0.020)
    pad_y = round(height * 0.011)
    arrow_size = round(url_height * 0.34)
    arrow_gap = round(url_height * 0.42)
    pill_width = pad_x * 2 + url_width + arrow_gap + arrow_size
    pill_height = pad_y * 2 + url_height

    # Empilhamento de baixo para cima: logo, endereço, frase, filete.
    cursor = height - bottom_safe
    logo_y = cursor - logo_height
    cursor = logo_y - round(height * 0.030)
    pill_bottom = cursor
    pill_top = pill_bottom - pill_height
    cursor = pill_top - round(height * 0.034)

    headline_ascent, headline_descent = headline_font.getmetrics()
    headline_height = line_step * (len(headline_lines) - 1) + headline_ascent + headline_descent
    headline_top = cursor - headline_height
    shadow_offset = max(1, round(headline_font.size * 0.045))
    text_y = headline_top
    for line in headline_lines:
        # Sombra deslocada em vez do contorno branco sobre texto branco que existia
        # antes: aquele stroke engrossava a letra de forma irregular e era o defeito
        # que mais denunciava montagem automática.
        draw.text((margin_x + shadow_offset, text_y + shadow_offset), line, font=headline_font, fill=(*PLUM, 150))
        draw.text((margin_x, text_y), line, font=headline_font, fill=(255, 255, 255, 255))
        text_y += line_step

    rule_height = max(3, round(height * 0.0045))
    rule_width = round(width * 0.115)
    rule_y = headline_top - round(height * 0.028) - rule_height
    draw.rounded_rectangle(
        (margin_x, rule_y, margin_x + rule_width, rule_y + rule_height),
        radius=rule_height // 2,
        fill=(*VIOLET, 255),
    )

    draw.rounded_rectangle(
        (margin_x, pill_top, margin_x + pill_width, pill_bottom),
        radius=pill_height // 2,
        fill=(*VIOLET, 255),
    )
    draw.text((margin_x + pad_x, pill_top + pad_y), STORY_SITE_URL, font=url_font, fill=(255, 255, 255, 255))
    # Seta desenhada como polígono, e não como glifo: não depende de a fonte trazer
    # o caractere de flecha.
    arrow_x = margin_x + pad_x + url_width + arrow_gap
    arrow_center = pill_top + pill_height / 2
    draw.polygon(
        [
            (arrow_x, arrow_center - arrow_size * 0.62),
            (arrow_x + arrow_size, arrow_center),
            (arrow_x, arrow_center + arrow_size * 0.62),
        ],
        fill=(255, 255, 255, 255),
    )

    canvas.alpha_composite(logo, (margin_x, logo_y))

    output = io.BytesIO()
    _film_grain(canvas.convert("RGB")).save(output, format="PNG", optimize=True)
    return output.getvalue()


def _cloudflare_candidate_models() -> list[str]:
    primary = settings.cloudflare_image_model.strip() or CLOUDFLARE_KLEIN_MODEL
    if primary.lower() in DEPRECATED_CLOUDFLARE_IMAGE_MODELS:
        primary = CLOUDFLARE_KLEIN_MODEL
    fallback = settings.cloudflare_image_fallback_model.strip() or CLOUDFLARE_SCHNELL_MODEL
    return list(dict.fromkeys((primary, fallback)))


def _cloudflare_request_kwargs(model: str, prompt: str) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {settings.cloudflare_api_token.strip()}"}
    if "flux-2-klein" in model.lower():
        # O Klein exige multipart mesmo em text-to-image. Não se define Content-Type
        # manualmente: o httpx inclui o boundary correto ao serializar `files`.
        return {
            "headers": headers,
            "files": {
                "prompt": (None, prompt),
                "width": (None, "720"),
                "height": (None, "1280"),
            },
        }
    if "flux-1-schnell" in model.lower():
        return {
            "headers": {**headers, "Content-Type": "application/json"},
            "json": {"prompt": prompt, "width": 720, "height": 1280, "steps": 4},
        }
    return {
        "headers": {**headers, "Content-Type": "application/json"},
        "json": {
            "prompt": prompt,
            "negative_prompt": (
                f"{AI_LOOK_NEGATIVE}, "
                "logo, logotype, wordmark, monogram, emblem, brand mark, company name, "
                "flowers, lavender flowers, violet flowers, plants, leaves, garden, nature, landscape, "
                "wellness, cosmetics, unrelated decorative object, any text, words, letters, numbers, "
                "typography, pseudo-text, watermarks, misspelled text, invented logo, "
                "fake certification, generic blue corporate style, handshake, "
                "analog clock, calendar, clutter, tiny typography, malformed hands, distorted device"
            ),
            "width": 720,
            "height": 1280,
            "num_steps": 20,
            "guidance": 6,
        },
    }


def _cloudflare_image_bytes(response: httpx.Response) -> bytes:
    content_type = response.headers.get("content-type", "").lower()
    raw = response.content
    looks_like_image = (
        raw.startswith(b"\x89PNG")
        or raw.startswith(b"\xff\xd8\xff")
        or (raw.startswith(b"RIFF") and raw[8:12] == b"WEBP")
    )
    if content_type.startswith("image/") or looks_like_image:
        return raw
    payload = response.json()
    result = payload.get("result", payload)
    encoded = result.get("image") if isinstance(result, dict) else result
    if not isinstance(encoded, str):
        raise ValueError("Resposta sem imagem")
    if encoded.startswith("data:"):
        encoded = encoded.split(",", 1)[1]
    return base64.b64decode(encoded, validate=True)


async def _generate_cloudflare_art(prompt: str, headline: str) -> bytes:
    models = _cloudflare_candidate_models()
    content: bytes | None = None
    cropped: bytes | None = None
    last_error: HTTPException | None = None
    async with httpx.AsyncClient(timeout=180.0) as client:
        for index, model in enumerate(models):
            endpoint = (
                "https://api.cloudflare.com/client/v4/accounts/"
                f"{settings.cloudflare_account_id.strip()}/ai/run/{model}"
            )
            try:
                response = await client.post(endpoint, **_cloudflare_request_kwargs(model, prompt))
            except httpx.HTTPError as exc:
                last_error = HTTPException(502, f"Não foi possível acessar o modelo {model} na Cloudflare.")
                if index == len(models) - 1:
                    raise last_error from exc
                continue
            if response.status_code >= 400:
                last_error = _cloudflare_error(response)
                # Credencial inválida ou cota diária esgotada também impedirá o
                # fallback na mesma conta; nesse caso não gastamos outra chamada.
                if last_error.status_code in {429, 503} or index == len(models) - 1:
                    raise last_error
                continue
            try:
                content = _cloudflare_image_bytes(response)
                cropped = _crop_to_story(content)
                break
            except (TypeError, ValueError, OSError, json.JSONDecodeError) as exc:
                last_error = HTTPException(502, f"O modelo {model} não retornou uma imagem válida.")
                if index == len(models) - 1:
                    raise last_error from exc

        if content is None or cropped is None:
            raise last_error or HTTPException(502, "A Cloudflare não retornou uma imagem válida.")
        logo_response = await client.get(BRAND_LOGO_URL, timeout=30.0)
        if logo_response.status_code >= 400:
            raise HTTPException(502, "Nao foi possivel carregar a logo oficial da 4Core.")
        try:
            return _compose_brand_art(cropped, logo_response.content, headline)
        except (TypeError, ValueError, OSError) as exc:
            raise HTTPException(502, "Não foi possível finalizar a arte gerada.") from exc


async def _generate_openai_art(prompt: str, headline: str) -> bytes:
    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            "https://api.openai.com/v1/images/generations",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": settings.openai_image_model,
                "prompt": prompt,
                "size": "1024x1536",
                "quality": "medium",
                "output_format": "png",
            },
        )
    if response.status_code >= 400:
        raise _openai_error(response)
    try:
        encoded = response.json()["data"][0]["b64_json"]
        cropped = _crop_to_story(base64.b64decode(encoded))
        async with httpx.AsyncClient(timeout=30.0) as client:
            logo_response = await client.get(BRAND_LOGO_URL)
        if logo_response.status_code >= 400:
            raise HTTPException(502, "Nao foi possivel carregar a logo oficial da 4Core.")
        return _compose_brand_art(cropped, logo_response.content, headline)
    except (KeyError, IndexError, TypeError, ValueError, OSError) as exc:
        raise HTTPException(502, "A OpenAI não retornou uma imagem válida.") from exc


async def generate_art(prompt: str, headline: str) -> str:
    if settings.cloudflare_account_id and settings.cloudflare_api_token:
        content = await _generate_cloudflare_art(prompt, headline)
    elif settings.openai_api_key:
        content = await _generate_openai_art(prompt, headline)
    else:
        raise HTTPException(
            503,
            "Configure as credenciais do Cloudflare Workers AI ou OPENAI_API_KEY para gerar artes.",
        )
    return await store_generated_art(content, "image/png")
