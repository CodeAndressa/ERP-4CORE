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


def cloudflare_image_models() -> list[str]:
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
    models = cloudflare_image_models()
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


# ─── Feed 4:5 ──────────────────────────────────────────────────────────────────
# O story nasceu primeiro e por isso a composição acima é 9:16. O feed tem outras
# restrições: nada de faixa escura no topo (ali não existe interface da Meta, e
# escurecer sem motivo só suja a foto) e a frase sobe para o terço superior, que é
# o que aparece no corte quadrado da grade do perfil.

FEED_SIZE = (1080, 1350)


def _crop_to_feed(content: bytes) -> bytes:
    """Recorte central para 4:5. O gerador devolve proporções variadas e o Instagram
    corta sozinho o que não encaixa; cortar aqui garante que a perda seja nas bordas
    e não em cima da frase."""
    source = Image.open(io.BytesIO(content)).convert("RGB")
    target_ratio = 4 / 5
    width, height = source.size
    crop_height = min(height, round(width / target_ratio))
    crop_width = min(width, round(height * target_ratio))
    left = max(0, (width - crop_width) // 2)
    top = max(0, (height - crop_height) // 2)
    cropped = source.crop((left, top, left + crop_width, top + crop_height))
    cropped = cropped.resize(FEED_SIZE, Image.Resampling.LANCZOS)
    output = io.BytesIO()
    cropped.save(output, format="PNG", optimize=True)
    return output.getvalue()


def _feed_scrim(width: int, height: int) -> Image.Image:
    """Assenta a base da peça sem apagar a foto.

    Era 62% da altura com opacidade subindo até 240, de quando a frase era texto
    branco solto sobre a foto e precisava daquele contraste todo. Hoje cada linha
    do título vai dentro de caixa sólida, que já garante a leitura, e o véu
    continuava lá escurecendo a imagem inteira: a peça saía cinza-arroxeada e
    pesada, que foi o "cru e sombrio" apontado.

    Ficou a faixa curta do rodapé, onde moram logo, endereço e a curva, que
    precisam de fundo para não disputar com a foto.
    """
    column = Image.new("RGBA", (1, height), (0, 0, 0, 0))
    pixels = column.load()
    span = max(1, round(height * 0.34))
    start = height - span
    for y in range(start, height):
        alpha = round(185 * ((y - start) / span) ** 1.9)
        pixels[0, y] = (*PLUM, min(255, alpha))
    return column.resize((width, height), Image.Resampling.NEAREST)


# As palavras que nunca levam o destaque de cor: destacar "de" ou "para" num
# titulo chama atencao para o lugar errado.
_SEM_DESTAQUE = {
    "de", "da", "do", "das", "dos", "e", "ou", "a", "o", "as", "os", "em", "no",
    "na", "nos", "nas", "um", "uma", "por", "para", "com", "sem", "que", "se",
    "ao", "aos", "a\u00e0", "mais", "menos", "ja", "j\u00e1", "nao", "n\u00e3o",
}


def _destaque(palavras: list[str]) -> set[int]:
    """Quais palavras do gancho saem em violeta dentro do titulo branco.

    A marca destaca o dado: em "76% das empresas ainda enfrentam dificuldades",
    o violeta pega "76%". Entao a regra e procurar numero primeiro, porque e o
    que o olho busca na miniatura.

    Sem numero nenhum, destaca a ultima palavra util, que e onde quase todo
    gancho bom poe a carga ("...sem crach\u00e1", "...na m\u00e3o"). Destacar nada
    deixaria a peca sem o elemento de cor que a identidade tem.
    """
    com_numero = {
        i for i, palavra in enumerate(palavras)
        if any(caractere.isdigit() for caractere in palavra)
    }
    if com_numero:
        return com_numero

    for i in range(len(palavras) - 1, -1, -1):
        limpa = palavras[i].strip(".,;:!?\u2014-").lower()
        if limpa and limpa not in _SEM_DESTAQUE:
            return {i}
    return set()


def _curva_de_canto(width: int, height: int, cor: tuple[int, int, int]) -> Image.Image:
    """A curva fina do canto inferior esquerdo, que a marca usa como assinatura.

    Desenhada em dobro e reduzida, porque o Pillow nao suaviza linha: traco de
    3px desenhado direto sai serrilhado, e serrilhado numa peca que se quer
    premium e a primeira coisa que denuncia.
    """
    escala = 2
    camada = Image.new("RGBA", (width * escala, height * escala), (0, 0, 0, 0))
    traco = ImageDraw.Draw(camada)
    espessura = max(2, round(width * 0.0035)) * escala
    raio = round(width * 0.30) * escala
    esquerda = round(width * 0.03) * escala
    base = height * escala - round(height * 0.015) * escala
    traco.arc(
        (esquerda, base - raio, esquerda + raio, base + raio),
        start=180, end=270, fill=(*cor, 190), width=espessura,
    )
    traco.line(
        (esquerda + raio // 2, base, width * escala, base),
        fill=(*cor, 190), width=espessura,
    )
    return camada.resize((width, height), Image.Resampling.LANCZOS)


def _compose_feed_art(
    background: bytes,
    logo_content: bytes,
    headline: str,
    cta: str = "",
    palette: dict | None = None,
) -> bytes:
    """Monta a peca de feed na identidade que a 4Core publica.

    Cada linha do gancho vai dentro de uma caixa solida com barra de acento a
    esquerda, o termo-chave sai em cor dentro do titulo branco, e o rodape leva
    logo centralizado, endereco e o CTA. Antes era frase branca solta sobre a
    foto: sem caixa, o contraste depende da foto que veio, e peca a peca o texto
    some ou fica cru.
    """
    acento = _hex_rgb(str((palette or {}).get("acento", "")), VIOLET)
    fundo_caixa = _hex_rgb(str((palette or {}).get("fundo", "")), PLUM)

    canvas = Image.open(io.BytesIO(background)).convert("RGBA")
    width, height = canvas.size
    canvas = Image.alpha_composite(canvas, _feed_scrim(width, height))
    canvas = Image.alpha_composite(canvas, _curva_de_canto(width, height, acento))
    draw = ImageDraw.Draw(canvas)

    margin_x = round(width * 0.068)
    content_width = width - margin_x * 2
    bottom_safe = round(height * 0.055)

    # ── o rodape, montado de baixo para cima ──
    logo = Image.open(io.BytesIO(logo_content)).convert("RGBA")
    logo_bbox = logo.getbbox()
    if logo_bbox is None:
        raise ValueError("Logo oficial sem conteudo visivel")
    logo = logo.crop(logo_bbox)
    logo_width = round(width * 0.23)
    logo_height = round(logo.height * logo_width / logo.width)
    logo = logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS)

    # O selo da data, no topo à direita, do lado oposto ao logo. Fica em cima
    # porque é ali que o olho entra na peça, e é o que faz alguém entender que a
    # peça é de campanha antes de ler o gancho. Só aparece quando há data ativa:
    # peça comum não leva selo nenhum.
    selo = " ".join(str((palette or {}).get("nome", "")).split()).upper()[:18]
    if selo:
        selo_font = _font(max(16, round(height * 0.0195)), "ExtraBold")
        selo_w = round(draw.textlength(selo, font=selo_font))
        s_asc, s_desc = selo_font.getmetrics()
        pad_x, pad_y = round(width * 0.022), round(height * 0.0095)
        caixa_w, caixa_h = selo_w + pad_x * 2, s_asc + s_desc + pad_y * 2
        caixa_x = width - margin_x - caixa_w
        caixa_y = round(height * 0.045)

        # Camada própria: o ImageDraw escreve o pixel direto e não compõe alfa,
        # então retângulo translúcido desenhado no canvas sai chapado.
        marca = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        ImageDraw.Draw(marca).rounded_rectangle(
            (caixa_x, caixa_y, caixa_x + caixa_w, caixa_y + caixa_h),
            radius=round(caixa_h * 0.28), fill=(*acento, 255),
        )
        canvas = Image.alpha_composite(canvas, marca)
        draw = ImageDraw.Draw(canvas)
        # Letra espaçada: em caixa alta e corpo pequeno, o espaçamento é o que
        # faz o selo ler como selo e não como mais uma palavra na foto.
        cursor_selo = caixa_x + pad_x
        for letra in selo:
            draw.text((cursor_selo, caixa_y + pad_y), letra, font=selo_font, fill=(255, 255, 255, 255))
            cursor_selo += round(draw.textlength(letra, font=selo_font) * 1.08)

    # O logo sobe para o topo. No rodape ele dividia a faixa com o CTA e o
    # endereco, e tres elementos empilhados embaixo empurravam o titulo para o
    # meio da foto. Em cima ele assina a peca na primeira olhada, que e o que a
    # marca quer de uma peca vista na grade do perfil.
    canvas.alpha_composite(logo, (margin_x, round(height * 0.045)))

    # O endereco fica embaixo e pequeno: ele e referencia, nao chamada. Quem vai
    # agir age pelo CTA ou pelo perfil, e o site so precisa estar legivel para
    # quem procurar por ele.
    url_font = _font(max(15, round(height * 0.0165)), "SemiBold")
    url_width = round(draw.textlength(STORY_SITE_URL, font=url_font))
    url_ascent, url_descent = url_font.getmetrics()

    cursor = height - bottom_safe
    url_y = cursor - (url_ascent + url_descent)
    draw.text(
        ((width - url_width) // 2, url_y),
        STORY_SITE_URL, font=url_font, fill=(226, 214, 255, 200),
    )
    cursor = url_y - round(height * 0.022)

    # ── o CTA, quando o redator mandou um ──
    texto_cta = " ".join((cta or "").split())[:34]
    if texto_cta:
        cta_font = _font(max(20, round(height * 0.0255)), "Bold")
        cta_width = round(draw.textlength(texto_cta, font=cta_font))
        cta_ascent, cta_descent = cta_font.getmetrics()
        pad_x, pad_y = round(width * 0.028), round(height * 0.014)
        caixa_w = cta_width + pad_x * 2
        caixa_h = cta_ascent + cta_descent + pad_y * 2
        caixa_x = (width - caixa_w) // 2
        caixa_y = cursor - caixa_h

        # Em camada propria: o ImageDraw escreve o pixel direto e nao compoe
        # alfa, entao pilula translucida desenhada no canvas sai chapada.
        pilula = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        ImageDraw.Draw(pilula).rounded_rectangle(
            (caixa_x, caixa_y, caixa_x + caixa_w, caixa_y + caixa_h),
            radius=caixa_h // 2, fill=(*acento, 255),
        )
        canvas = Image.alpha_composite(canvas, pilula)
        draw = ImageDraw.Draw(canvas)
        draw.text((caixa_x + pad_x, caixa_y + pad_y), texto_cta, font=cta_font, fill=(255, 255, 255, 255))
        cursor = caixa_y - round(height * 0.030)

    # ── o titulo em caixas solidas ──
    safe_headline = sentence_case(headline)[:90]
    max_text_height = round(height * 0.40)
    headline_font, headline_lines, line_step = _fit_headline(
        draw, safe_headline, content_width - round(width * 0.055),
        max_text_height, round(height * 0.082), round(height * 0.040), max_lines=4,
    )

    palavras = safe_headline.split()
    destacadas = _destaque(palavras)
    ascent, descent = headline_font.getmetrics()
    altura_linha = ascent + descent
    pad_h = round(width * 0.022)
    pad_v = round(height * 0.009)
    barra = max(4, round(width * 0.0075))

    # As caixas sao desenhadas numa camada so, e o texto por cima, para o alfa
    # compor uma vez e nao linha a linha.
    caixas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pincel = ImageDraw.Draw(caixas)

    topo = cursor - (line_step * (len(headline_lines) - 1) + altura_linha + pad_v * 2)
    y = topo
    posicoes: list[tuple[int, int, str]] = []
    indice_palavra = 0
    for linha in headline_lines:
        largura = round(draw.textlength(linha, font=headline_font))
        caixa_w = largura + pad_h * 2
        pincel.rectangle((margin_x, y, margin_x + caixa_w, y + altura_linha + pad_v * 2), fill=(*fundo_caixa, 232))
        pincel.rectangle((margin_x, y, margin_x + barra, y + altura_linha + pad_v * 2), fill=(*acento, 255))
        posicoes.append((margin_x + barra + pad_h, y + pad_v, linha))
        y += line_step

    canvas = Image.alpha_composite(canvas, caixas)
    draw = ImageDraw.Draw(canvas)

    for x, y_texto, linha in posicoes:
        cursor_x = x
        for palavra in linha.split():
            cor = (*acento, 255) if indice_palavra in destacadas else (255, 255, 255, 255)
            draw.text((cursor_x, y_texto), palavra, font=headline_font, fill=cor)
            cursor_x += round(draw.textlength(palavra + " ", font=headline_font))
            indice_palavra += 1

    output = io.BytesIO()
    _film_grain(canvas.convert("RGB")).save(output, format="PNG", optimize=True)
    return output.getvalue()


def _fit_headline(
    draw: ImageDraw.ImageDraw,
    text: str,
    max_width: int,
    max_height: int,
    biggest: int,
    smallest: int,
    max_lines: int = 4,
) -> tuple[ImageFont.FreeTypeFont, list[str], int]:
    """O maior corpo em que a frase ainda cabe na caixa, já quebrada em linhas.

    O retorno do último caso importa: mesmo quando nem o menor corpo cabe na
    altura, a frase volta QUEBRADA na largura pedida. Devolver a linha inteira ali
    foi o que fez o gancho sair cortado pela margem na primeira versão.
    """
    for size in range(biggest, smallest, -2):
        font = _font(size, "ExtraBold")
        lines = _wrap_headline(draw, text, font, max_width)
        ascent, descent = font.getmetrics()
        step = round(size * 1.06)
        if len(lines) <= max_lines and step * (len(lines) - 1) + ascent + descent <= max_height:
            return font, lines, step
    font = _font(smallest, "ExtraBold")
    return font, _wrap_headline(draw, text, font, max_width), round(smallest * 1.06)


# Palavras curtas e de ligacao nao contam como repeticao: quase toda frase as tem.
_STOPWORDS = {
    "a", "as", "o", "os", "de", "da", "do", "das", "dos", "e", "em", "no", "na",
    "nos", "nas", "um", "uma", "por", "para", "com", "sem", "que", "se", "ao",
    "aos", "mais", "seu", "sua", "the",
}


def _echoes(primeira: str, segunda: str, limite: float = 0.4) -> bool:
    """Duas frases dizem a mesma coisa? Compara os radicais das palavras de peso.

    Corta em 4 letras para "feche" e "fecha" contarem como a mesma ideia, que e
    justamente o caso que aparece quando o gancho e o apoio falam do mesmo verbo.
    """
    def radicais(texto: str) -> set[str]:
        limpo = "".join(c if c.isalnum() or c.isspace() else " " for c in texto.lower())
        return {p[:4] for p in limpo.split() if len(p) > 3 and p not in _STOPWORDS}

    a, b = radicais(primeira), radicais(segunda)
    if not a or not b:
        return False
    return len(a & b) / min(len(a), len(b)) >= limite


def _draw_check(draw: ImageDraw.ImageDraw, x: int, cy: int, radius: int) -> None:
    """Marcador de selo: disco violeta com um tique branco desenhado dentro."""
    draw.ellipse((x, cy - radius, x + radius * 2, cy + radius), fill=(*VIOLET, 255))
    draw.line(
        (
            x + radius * 0.58, cy + radius * 0.02,
            x + radius * 0.88, cy + radius * 0.40,
            x + radius * 1.44, cy - radius * 0.42,
        ),
        fill=(255, 255, 255, 255),
        width=max(2, round(radius * 0.30)),
        joint="curve",
    )


def _hex_rgb(valor: str, reserva: tuple[int, int, int]) -> tuple[int, int, int]:
    """Converte #RRGGBB em tupla, caindo na reserva quando o valor não presta."""
    texto = (valor or "").strip().lstrip("#")
    if len(texto) != 6:
        return reserva
    try:
        return (int(texto[0:2], 16), int(texto[2:4], 16), int(texto[4:6], 16))
    except ValueError:
        return reserva


def _brand_gradient(width: int, height: int, palette: dict | None = None) -> Image.Image:
    """O fundo da peça de produto: violeta vivo caindo para o quase-preto da marca.

    Montado como 2x2 pixels e esticado. O Pillow interpola os quatro cantos de uma
    vez, o que dá um degradê diagonal suave sem percorrer pixel nenhum em Python.

    Com `palette`, o degradê assume as cores da data sazonal. Sem ela, continua
    sendo o da marca: uma peça de Black Friday com o mesmo violeta de sempre é
    uma peça em que nada na tela diz que é Black Friday.
    """
    if palette:
        alto = _hex_rgb(str(palette.get("acento", "")), VIOLET)
        baixo = _hex_rgb(str(palette.get("fundo", "")), PLUM)
        meio = _hex_rgb(str(palette.get("fundo_2", "")), (42, 10, 74))
    else:
        alto, meio, baixo = VIOLET, (42, 10, 74), PLUM

    seed = Image.new("RGB", (2, 2))
    seed.putpixel((0, 0), alto)          # alto à esquerda: onde a frase começa
    seed.putpixel((1, 0), tuple((a + m) // 2 for a, m in zip(alto, meio)))
    seed.putpixel((0, 1), meio)
    seed.putpixel((1, 1), baixo)         # baixo à direita: onde a foto se apoia
    return seed.resize((width, height), Image.Resampling.BICUBIC).convert("RGBA")


def _visible_bbox(image: Image.Image, threshold: int = 24) -> tuple[int, int, int, int] | None:
    """A caixa do que realmente se vê, ignorando sombra quase transparente.

    O `getbbox` do Pillow considera qualquer alfa acima de zero, e os PNGs de
    produto do site trazem uma sombra larga e levíssima em volta. Cortar por ela
    deixava o produto pequeno e fora do centro dentro da própria caixa.
    """
    alpha = image.getchannel("A").point(lambda value: 255 if value > threshold else 0)
    return alpha.getbbox()


def _round_corners(image: Image.Image, radius: int) -> Image.Image:
    """Arredonda os cantos preservando a transparência que a imagem já tinha."""
    mask = Image.new("L", image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width - 1, image.height - 1), radius=radius, fill=255)
    out = image.copy()
    out.putalpha(ImageChops.darker(image.getchannel("A"), mask))
    return out


def _fit_product(product: Image.Image, box_w: int, box_h: int) -> Image.Image:
    """Encaixa a foto do produto na caixa sem deformar e sem sobra transparente.

    Produto recortado (o leitor facial, o notebook) entra com a silhueta que já
    tem. Foto de cena, que chega como um retângulo cheio, ganha canto arredondado:
    sem isso ela fica um bloco colado por cima do degradê.
    """
    cropped = product.crop(
        _visible_bbox(product) or product.getbbox() or (0, 0, product.width, product.height)
    )
    scale = min(box_w / cropped.width, box_h / cropped.height)
    fitted = cropped.resize(
        (max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))),
        Image.Resampling.LANCZOS,
    )
    alpha = fitted.getchannel("A")
    # Quase todo pixel opaco quer dizer que não há recorte: é uma foto inteira.
    opaco = alpha.histogram()[255] / float(fitted.width * fitted.height)
    if opaco > 0.97:
        fitted = _round_corners(fitted, max(12, round(min(fitted.size) * 0.055)))
    return fitted


def _pill(canvas: Image.Image, draw: ImageDraw.ImageDraw, x: int, y: int, texto: str,
          font: ImageFont.FreeTypeFont, pad_x: int, pad_y: int) -> int:
    """Pílula de rótulo. Devolve a base, para o chamador continuar dali.

    O véu vai numa camada própria porque o ImageDraw grava o pixel em vez de
    compor alfa: desenhado direto, o branco translúcido vira bloco sólido e come
    o texto que vem por cima.
    """
    ascent, descent = font.getmetrics()
    altura = ascent + descent
    base = y + altura + pad_y * 2
    veil = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(veil).rounded_rectangle(
        (x, y, x + round(draw.textlength(texto, font=font)) + pad_x * 2, base),
        radius=(base - y) // 2,
        fill=(255, 255, 255, 40),
    )
    canvas.alpha_composite(veil)
    draw.text((x + pad_x, y + pad_y), texto, font=font, fill=(255, 255, 255, 255))
    return base


def _footer(canvas: Image.Image, draw: ImageDraw.ImageDraw, logo_content: bytes,
            width: int, height: int, margin: int) -> int:
    """Filete, logo e endereço. Devolve o topo do rodapé, que é o limite do conteúdo."""
    logo = Image.open(io.BytesIO(logo_content)).convert("RGBA")
    logo = logo.crop(logo.getbbox() or (0, 0, logo.width, logo.height))
    logo_width = round(width * 0.26)
    logo = logo.resize((logo_width, round(logo.height * logo_width / logo.width)), Image.Resampling.LANCZOS)
    logo_y = height - round(height * 0.062) - logo.height
    top = logo_y - round(height * 0.032)

    rule_height = max(3, round(height * 0.0042))
    draw.rounded_rectangle(
        (margin, top - rule_height, margin + round(width * 0.125), top),
        radius=rule_height // 2,
        fill=(*VIOLET, 255),
    )
    canvas.alpha_composite(logo, (margin, logo_y))
    url_font = _font(max(20, round(height * 0.0235)), "SemiBold")
    url_ascent, url_descent = url_font.getmetrics()
    draw.text(
        (width - margin - round(draw.textlength(STORY_SITE_URL, font=url_font)),
         logo_y + (logo.height - (url_ascent + url_descent)) // 2),
        STORY_SITE_URL,
        font=url_font,
        fill=(235, 225, 255, 255),
    )
    return top


def _draw_cross(draw: ImageDraw.ImageDraw, x: int, cy: int, radius: int) -> None:
    """Marcador do lado ruim do comparativo: disco apagado com um x branco."""
    draw.ellipse((x, cy - radius, x + radius * 2, cy + radius), fill=(255, 255, 255, 46))
    corte = radius * 0.46
    largura = max(2, round(radius * 0.26))
    draw.line((x + radius - corte, cy - corte, x + radius + corte, cy + corte),
              fill=(226, 212, 255, 255), width=largura)
    draw.line((x + radius - corte, cy + corte, x + radius + corte, cy - corte),
              fill=(226, 212, 255, 255), width=largura)


def _compose_stat_art(logo_content: bytes, headline: str, fact: dict, palette: dict | None = None) -> bytes:
    """Peça de dado: o número ocupa a peça e o gancho fica embaixo.

    É o layout que para o dedo de quem rola o feed. Existe porque a 4Core vende
    contra um risco concreto, e risco com número é mais concreto que risco com
    adjetivo. A fonte vai impressa na peça: o revisor reprova promessa sem origem,
    e esta é a peça onde inventar um percentual seria mais fácil e mais caro.
    """
    width, height = 1080, 1350
    canvas = _brand_gradient(width, height, palette)
    draw = ImageDraw.Draw(canvas)
    margin = round(width * 0.075)
    content_width = width - margin * 2
    footer_top = _footer(canvas, draw, logo_content, width, height, margin)

    label_font = _font(round(height * 0.0225), "Bold")
    cursor = _pill(canvas, draw, margin, margin, "O QUE ESTÁ EM JOGO", label_font,
                   round(width * 0.024), round(height * 0.010))

    # O número manda na peça: ocupa a largura que conseguir.
    numero = normalize_pt_br_text(str(fact.get("numero") or ""))
    numero_font = _font(round(height * 0.175), "ExtraBold")
    for size in range(round(height * 0.185), round(height * 0.070), -4):
        candidato = _font(size, "ExtraBold")
        if draw.textlength(numero, font=candidato) <= content_width:
            numero_font = candidato
            break
    n_ascent, n_descent = numero_font.getmetrics()

    contexto_font = _font(round(height * 0.034), "Medium")
    c_ascent, c_descent = contexto_font.getmetrics()
    contexto_linhas = _wrap_headline(
        draw, normalize_pt_br_text(str(fact.get("contexto") or "")), contexto_font, content_width
    )[:3]

    gancho_font, gancho_linhas, passo = _fit_headline(
        draw, sentence_case(headline)[:80], content_width, round(height * 0.17),
        round(height * 0.048), round(height * 0.030), max_lines=3,
    )
    g_ascent, g_descent = gancho_font.getmetrics()

    # Mede o miolo inteiro antes de desenhar e sobra o que sobrar em cima e embaixo
    # em partes iguais. Desenhar de cima para baixo deixava um vazio de um terço da
    # peça entre o gancho e o rodapé.
    miolo = (
        (n_ascent + n_descent) + round(height * 0.012)
        + (c_ascent + c_descent) * len(contexto_linhas)
        + round(height * 0.045) + 2 + round(height * 0.035)
        + passo * (len(gancho_linhas) - 1) + g_ascent + g_descent
    )
    livre = footer_top - round(height * 0.030) - cursor
    cursor += max(round(height * 0.030), (livre - miolo) // 2)

    draw.text((margin, cursor), numero, font=numero_font, fill=(255, 255, 255, 255))
    cursor += n_ascent + n_descent + round(height * 0.012)

    for linha in contexto_linhas:
        draw.text((margin, cursor), linha, font=contexto_font, fill=(226, 212, 255, 255))
        cursor += c_ascent + c_descent

    # O gancho do redator entra abaixo de uma divisória, como leitura seguinte.
    cursor += round(height * 0.045)
    draw.rounded_rectangle(
        (margin, cursor, margin + round(width * 0.30), cursor + 2), radius=1, fill=(255, 255, 255, 56)
    )
    cursor += round(height * 0.035)

    for linha in gancho_linhas:
        draw.text((margin, cursor), linha, font=gancho_font, fill=(255, 255, 255, 255))
        cursor += passo
    cursor += (g_ascent + g_descent) - passo



    output = io.BytesIO()
    _film_grain(canvas.convert("RGB")).save(output, format="PNG", optimize=True)
    return output.getvalue()


def _compose_compare_art(logo_content: bytes, headline: str, product: dict, palette: dict | None = None) -> bytes:
    """Peça comparativa: o que acontece sem a solução, e o que muda com ela.

    Duas colunas em vez de duas metades empilhadas: no feed a peça aparece em
    miniatura na grade do perfil, e lado a lado a oposição se lê antes de a pessoa
    abrir o post.
    """
    contraste = product.get("contraste") or {}
    sem = [str(item) for item in (contraste.get("sem") or [])][:2]
    com = [str(item) for item in (contraste.get("com") or [])][:2]
    if not sem or not com:
        raise ValueError("Produto sem contraste cadastrado")

    width, height = 1080, 1350
    canvas = _brand_gradient(width, height, palette)
    draw = ImageDraw.Draw(canvas)
    margin = round(width * 0.075)
    content_width = width - margin * 2
    footer_top = _footer(canvas, draw, logo_content, width, height, margin)

    label_font = _font(round(height * 0.0225), "Bold")
    cursor = _pill(canvas, draw, margin, margin,
                   normalize_pt_br_text(str(product.get("name") or "")).upper(),
                   label_font, round(width * 0.024), round(height * 0.010))

    cursor += round(height * 0.035)
    gancho_font, gancho_linhas, passo = _fit_headline(
        draw, sentence_case(headline)[:80], content_width, round(height * 0.22),
        round(height * 0.066), round(height * 0.038), max_lines=3,
    )
    for linha in gancho_linhas:
        draw.text((margin, cursor), linha, font=gancho_font, fill=(255, 255, 255, 255))
        cursor += passo
    g_ascent, g_descent = gancho_font.getmetrics()
    cursor += (g_ascent + g_descent) - passo + round(height * 0.055)

    coluna = (content_width - round(width * 0.045)) // 2
    titulo_font = _font(round(height * 0.0225), "Bold")
    item_font = _font(round(height * 0.0255), "SemiBold")
    t_ascent, t_descent = titulo_font.getmetrics()
    i_ascent, i_descent = item_font.getmetrics()
    mark = round(height * 0.0115)

    # Altura das colunas, medida antes de desenhar, para centralizar o bloco entre
    # o gancho e o rodapé em vez de deixá-lo colado no topo.
    def altura_coluna(itens: list[str]) -> int:
        total = t_ascent + t_descent + round(height * 0.024)
        for item in itens:
            linhas = _wrap_headline(
                draw, normalize_pt_br_text(item), item_font,
                coluna - (mark * 2 + round(width * 0.016))
            )[:3]
            total += (i_ascent + i_descent) * len(linhas) + round(height * 0.020)
        return total

    bloco = max(altura_coluna(sem), altura_coluna(com))
    livre = footer_top - round(height * 0.030) - cursor
    cursor += max(0, (livre - bloco) // 2)

    for indice, (titulo, itens, bom) in enumerate(
        (("HOJE, SEM ISSO", sem, False), ("COM A 4CORE", com, True))
    ):
        x = margin + indice * (coluna + round(width * 0.045))
        draw.text((x, cursor), titulo, font=titulo_font,
                  fill=(255, 255, 255, 255) if bom else (196, 178, 230, 255))
        y = cursor + t_ascent + t_descent + round(height * 0.024)
        for item in itens:
            centro = y + (i_ascent + i_descent) // 2
            if bom:
                _draw_check(draw, x, centro, mark)
            else:
                _draw_cross(draw, x, centro, mark)
            texto_x = x + mark * 2 + round(width * 0.016)
            for linha in _wrap_headline(
                draw, normalize_pt_br_text(item), item_font, coluna - (texto_x - x)
            )[:3]:
                draw.text((texto_x, y), linha, font=item_font,
                          fill=(255, 255, 255, 255) if bom else (206, 190, 236, 255))
                y += i_ascent + i_descent
            y += round(height * 0.020)

    output = io.BytesIO()
    _film_grain(canvas.convert("RGB")).save(output, format="PNG", optimize=True)
    return output.getvalue()


def _compose_product_art(
    product_content: bytes,
    logo_content: bytes,
    headline: str,
    product: dict,
    palette: dict | None = None,
) -> bytes:
    """Peça de feed que mostra o que a 4Core vende.

    Fundo na identidade da marca, foto real do produto, o gancho, o que o produto
    resolve e os selos de conformidade. Nada aqui passa por modelo de imagem.

    O texto é montado de cima para baixo, na largura inteira, e a foto ocupa o que
    sobra. O contrário (ancorar a foto primeiro e espremer o texto na coluna que
    restasse) dava uma coluna estreita demais para um gancho de oito palavras.
    """
    width, height = 1080, 1350
    canvas = _brand_gradient(width, height, palette)
    draw = ImageDraw.Draw(canvas)

    margin = round(width * 0.075)
    content_width = width - margin * 2
    bottom_safe = round(height * 0.062)

    logo = Image.open(io.BytesIO(logo_content)).convert("RGBA")
    logo = logo.crop(logo.getbbox() or (0, 0, logo.width, logo.height))
    logo_width = round(width * 0.26)
    logo = logo.resize((logo_width, round(logo.height * logo_width / logo.width)), Image.Resampling.LANCZOS)
    logo_y = height - bottom_safe - logo.height
    footer_top = logo_y - round(height * 0.032)

    # ── 1. a pílula com o nome do produto, no alto ──
    label = normalize_pt_br_text(str(product.get("name") or "")).upper()
    label_font = _font(round(height * 0.0225), "Bold")
    label_ascent, label_descent = label_font.getmetrics()
    label_height = label_ascent + label_descent
    pad_x, pad_y = round(width * 0.024), round(height * 0.010)
    pill_top = margin
    pill_bottom = pill_top + label_height + pad_y * 2
    # Numa camada propria: o ImageDraw grava o pixel em vez de compor alfa, entao
    # desenhar o veu direto no canvas deixava uma pilula branca solida que comia o
    # texto por cima dela.
    veil = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(veil).rounded_rectangle(
        (margin, pill_top, margin + round(draw.textlength(label, font=label_font)) + pad_x * 2, pill_bottom),
        radius=(pill_bottom - pill_top) // 2,
        fill=(255, 255, 255, 40),
    )
    canvas.alpha_composite(veil)
    draw.text((margin + pad_x, pill_top + pad_y), label, font=label_font, fill=(255, 255, 255, 255))

    # ── 2. o gancho, na largura inteira ──
    cursor = pill_bottom + round(height * 0.035)
    headline_font, headline_lines, line_step = _fit_headline(
        draw,
        sentence_case(headline)[:80],
        content_width,
        round(height * 0.23),
        round(height * 0.070),
        round(height * 0.038),
        max_lines=3,
    )
    for line in headline_lines:
        draw.text((margin, cursor), line, font=headline_font, fill=(255, 255, 255, 255))
        cursor += line_step
    h_ascent, h_descent = headline_font.getmetrics()
    cursor += (h_ascent + h_descent) - line_step

    # ── 3. o que o produto resolve, quando acrescenta algo ──
    # O gancho vem do redator e o apoio vem do catalogo, entao os dois podem cair
    # na mesma ideia ("feche a folha" / "fecha a folha sem retrabalho"). Quando se
    # repetem, o apoio sai: espaco em branco vale mais que eco.
    resolve = normalize_pt_br_text(str(product.get("resolve") or ""))
    if resolve and not _echoes(headline, resolve):
        resolve_font = _font(round(height * 0.0295), "Medium")
        resolve_ascent, resolve_descent = resolve_font.getmetrics()
        cursor += round(height * 0.026)
        for linha in _wrap_headline(draw, resolve, resolve_font, content_width)[:2]:
            draw.text((margin, cursor), linha, font=resolve_font, fill=(226, 212, 255, 255))
            cursor += resolve_ascent + resolve_descent

    # ── 4. os selos ──
    seal_font = _font(round(height * 0.0250), "SemiBold")
    seal_ascent, seal_descent = seal_font.getmetrics()
    seal_step = round(height * 0.042)
    mark = round(height * 0.012)
    cursor += round(height * 0.028)
    for selo in [str(item) for item in (product.get("selos") or [])][:2]:
        _draw_check(draw, margin, cursor + (seal_ascent + seal_descent) // 2, mark)
        draw.text(
            (margin + mark * 2 + round(width * 0.018), cursor),
            normalize_pt_br_text(selo),
            font=seal_font,
            fill=(240, 234, 255, 255),
        )
        cursor += seal_step

    # ── 5. a foto, no espaço que sobrou entre o texto e o rodapé ──
    product_image = Image.open(io.BytesIO(product_content)).convert("RGBA")
    if product_image.getbbox() is None:
        raise ValueError("Imagem de produto sem conteúdo visível")
    area_top = cursor + round(height * 0.030)
    area_height = max(round(height * 0.12), footer_top - round(height * 0.030) - area_top)
    fitted = _fit_product(product_image, content_width, area_height)
    # Produto pequeno demais nao vende. Quando sobra altura de verdade, a foto
    # cresce ate a largura util antes de ficar boiando no meio do degrade.
    if fitted.width < content_width * 0.62 and fitted.height < area_height * 0.95:
        fitted = _fit_product(product_image, round(content_width * 0.92), area_height)
    # Só produto nitidamente em pé (o leitor facial, 2:1) encosta à direita, onde o
    # degradê escurece e o contraste ajuda. Quadrado conta como deitado: o notebook
    # tem 1,05 de razão e ancorá-lo à direita abria um vazio na metade esquerda.
    product_x = (
        width - margin - fitted.width
        if fitted.height > fitted.width * 1.4
        else margin + (content_width - fitted.width) // 2
    )
    canvas.alpha_composite(fitted, (product_x, area_top + (area_height - fitted.height) // 2))

    # ── 6. rodapé ──
    rule_height = max(3, round(height * 0.0042))
    draw.rounded_rectangle(
        (margin, footer_top - rule_height, margin + round(width * 0.125), footer_top),
        radius=rule_height // 2,
        fill=(*VIOLET, 255),
    )
    canvas.alpha_composite(logo, (margin, logo_y))
    url_font = _font(max(20, round(height * 0.0235)), "SemiBold")
    url_ascent, url_descent = url_font.getmetrics()
    draw.text(
        (width - margin - round(draw.textlength(STORY_SITE_URL, font=url_font)),
         logo_y + (logo.height - (url_ascent + url_descent)) // 2),
        STORY_SITE_URL,
        font=url_font,
        fill=(235, 225, 255, 255),
    )

    output = io.BytesIO()
    _film_grain(canvas.convert("RGB")).save(output, format="PNG", optimize=True)
    return output.getvalue()


async def _fetch_product_image(client: httpx.AsyncClient, url: str) -> bytes:
    response = await client.get(url, timeout=30.0)
    if response.status_code >= 400:
        raise HTTPException(502, "Nao foi possivel carregar a foto do produto no site da 4Core.")
    return response.content


async def _fetch_brand_logo(client: httpx.AsyncClient) -> bytes:
    response = await client.get(BRAND_LOGO_URL, timeout=30.0)
    if response.status_code >= 400:
        raise HTTPException(502, "Nao foi possivel carregar a logo oficial da 4Core.")
    return response.content


# Modelo de cena com referencia. Precisa aceitar imagem de ENTRADA: e isso que
# permite colocar o produto real dentro de uma cena em vez de pedir ao modelo que
# desenhe de cabeca um aparelho que ele nao conhece.
OPENROUTER_SCENE_MODEL = "google/gemini-2.5-flash-image"

# Vem ANTES do briefing da cena, nao depois. Numa primeira versao a exigencia de
# fidelidade estava concatenada no fim, depois de oitocentas palavras descrevendo
# o ambiente, e o modelo desenhou outro aparelho: tela alongada, sem a barra
# branca do topo, sem as quatro lentes, sem a marca. O que vem primeiro enquadra
# o resto; o que vem por ultimo compete com tudo que veio antes.
SCENE_DEVICE_FIRST = (
    "FIRST AND ABOVE EVERY OTHER INSTRUCTION: the attached reference photograph "
    "shows a REAL product that this company sells. Reproduce that exact device, "
    "pixel-faithful in shape and detail: same silhouette, same proportions, same "
    "housing, same bezel, same screen size relative to the body, same arrangement "
    "of lenses and sensors, same manufacturer wordmark in the same place. You are "
    "placing THIS object into a scene, not designing a device inspired by it. If "
    "the scene would look better with a different device, the scene is wrong, not "
    "the device. Showing a different product than the one in the reference makes "
    "the whole image unusable.\n\n"
)

SCENE_GUARDRAILS = (
    " Use the device in the reference image EXACTLY as it is: same proportions, same "
    "screen, same housing, same brand mark. Do not redesign it, do not invent another "
    "model. No text, no watermark, no logo overlay anywhere in the image. "
    "Photorealistic candid documentary photograph, natural light, shallow depth of field."
    # A referencia e a foto do aparelho sozinho, em fundo branco de catalogo. Sem
    # este trecho o modelo devolvia o aparelho um pouco maior, ainda sozinho numa
    # parede limpa: tecnicamente uma cena, na pratica a mesma foto de catalogo.
    " At least one real Brazilian worker must be in the frame, actively using the "
    "device, mid-gesture, in profile or three quarters, never looking at the lens. "
    "The device is mounted or placed where it would really be, inside a recognisable "
    "Brazilian workplace with everyday wear: a company entrance, a factory floor, a "
    "construction site, a clinic reception, a warehouse, a shop back office. Never an "
    "empty room, never a bare studio wall, never the device alone."
)


def _scene_consistency(headline: str) -> str:
    """Impede que a cena mostre justamente o que a frase diz que nao existe.

    Numa peca de 16/11/2026 o gancho era "Acesso rapido, sem cracha" e o modelo
    pendurou um cracha na parede, ao lado do leitor. A imagem desmentia a frase, e
    o gerador nao tinha como saber: ele nunca recebia o gancho.
    """
    if not headline.strip():
        return ""
    return (
        f' The final piece carries this headline: "{headline.strip()}". '
        "The scene must not contradict it: do not show any object or action that the "
        "headline says is unnecessary or replaced. If the headline mentions badges, "
        "cards, paper sheets or manual processes as the old way, none of them may "
        "appear in the image."
    )


async def _generate_openrouter_scene(
    prompt: str, reference: bytes, headline: str = "", appearance: str = ""
) -> tuple[bytes, Any]:
    """Cena fotografica construida a partir da foto real do produto.

    Usa `/chat/completions` com `modalities`, e nao o endpoint `/images`: so o
    caminho de chat aceita imagem de entrada. A resposta traz a imagem como data
    URI dentro de `message.images`, e o `usage.cost` com o custo real da chamada.
    """
    from app.services.marketing_agent_cost import image_usage

    corpo = {
        "model": OPENROUTER_SCENE_MODEL,
        "modalities": ["image", "text"],
        "usage": {"include": True},
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            SCENE_DEVICE_FIRST
                            + (
                                f"The device in the reference is {appearance}. "
                                "Check your result against this description before finishing.\n\n"
                                if appearance
                                else ""
                            )
                            + prompt
                            + SCENE_GUARDRAILS
                            + _scene_consistency(headline)
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": "data:image/png;base64," + base64.b64encode(reference).decode()
                        },
                    },
                ],
            }
        ],
    }
    async with httpx.AsyncClient(timeout=240.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": settings.openrouter_site_url,
                "X-Title": "ERP 4Core",
            },
            json=corpo,
        )
    if response.status_code == 402:
        raise HTTPException(
            502,
            "O OpenRouter pede saldo para gerar imagem. Adicione credito em "
            "openrouter.ai/settings/credits.",
        )
    if response.status_code >= 400:
        raise HTTPException(502, f"O OpenRouter recusou a cena ({response.status_code}).")

    payload = response.json()
    bruto = b""
    for escolha in payload.get("choices", []):
        for imagem in ((escolha.get("message") or {}).get("images") or []):
            url = (imagem.get("image_url") or {}).get("url") or imagem.get("url") or ""
            if url.startswith("data:"):
                bruto = base64.b64decode(url.split(",", 1)[1])
                break
        if bruto:
            break
    if not bruto:
        raise HTTPException(502, "O OpenRouter respondeu sem imagem.")

    uso = payload.get("usage") or {}
    custo = uso.get("cost")
    return bruto, image_usage(
        "openrouter",
        OPENROUTER_SCENE_MODEL,
        1,
        float(custo) if custo is not None else None,
    )


async def _generate_openrouter_image(prompt: str) -> tuple[bytes, Any]:
    """Imagem pelo OpenRouter. Vale a rota por dois motivos: uma chave só atende
    texto e imagem, e a resposta traz o custo real da chamada, que é o que o painel
    de custos mostra como medido em vez de estimado."""
    from app.services.marketing_agent_cost import image_usage

    model = settings.openrouter_image_model.strip()
    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            "https://openrouter.ai/api/v1/images",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                # O OpenRouter usa esses dois cabeçalhos para atribuir o consumo ao
                # aplicativo no painel da conta.
                "HTTP-Referer": settings.openrouter_site_url,
                "X-Title": "ERP 4Core",
            },
            json={"model": model, "prompt": prompt, "n": 1},
        )
    if response.status_code >= 400:
        detail = response.text[:200]
        if response.status_code in {401, 403}:
            raise HTTPException(502, "O OpenRouter recusou a chave. Confira OPENROUTER_API_KEY.")
        if response.status_code == 429:
            raise HTTPException(502, "O limite de uso do OpenRouter foi atingido. Tente mais tarde.")
        raise HTTPException(502, f"Falha ao gerar a arte no OpenRouter: {detail}")
    try:
        payload = response.json()
        item = payload["data"][0]
        encoded = item.get("b64_json") or item.get("image_base64")
        if encoded:
            content = base64.b64decode(encoded.split(",", 1)[-1], validate=False)
        else:
            async with httpx.AsyncClient(timeout=60.0) as client:
                downloaded = await client.get(item["url"])
            if downloaded.status_code >= 400:
                raise ValueError("url da imagem inacessivel")
            content = downloaded.content
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise HTTPException(502, "O OpenRouter não retornou uma imagem válida.") from exc

    reported = (payload.get("usage") or {}).get("cost")
    return content, image_usage("openrouter", model, 1, reported if isinstance(reported, (int, float)) else None)


async def _generate_cloudflare_image(prompt: str) -> tuple[bytes, Any]:
    """Só os bytes crus da Cloudflare, sem recorte nem composição: quem decide o
    formato final é o chamador, que sabe se a peça é story ou feed."""
    from app.services.marketing_agent_cost import image_usage

    models = cloudflare_image_models()
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
                if last_error.status_code in {429, 503} or index == len(models) - 1:
                    raise last_error
                continue
            try:
                return _cloudflare_image_bytes(response), image_usage("cloudflare", model, 1)
            except (TypeError, ValueError, OSError, json.JSONDecodeError) as exc:
                last_error = HTTPException(502, f"O modelo {model} não retornou uma imagem válida.")
                if index == len(models) - 1:
                    raise last_error from exc
    raise last_error or HTTPException(502, "A Cloudflare não retornou uma imagem válida.")


def scene_model_available() -> bool:
    """A cena com produto real so existe com OpenRouter: e o unico provedor ligado
    aqui que aceita imagem de entrada. A Cloudflare so recebe texto."""
    return bool(settings.openrouter_api_key)


def image_model_available() -> bool:
    """Se existe algum provedor capaz de gerar imagem a partir de texto.

    Separado de `scene_model_available` porque o layout "foto" nao precisa de
    imagem de entrada: ele roda na Cloudflare tambem. Sem essa distincao, uma
    instalacao so com Cloudflare perderia o unico layout fotografico que ela
    consegue fazer."""
    return bool(
        settings.openrouter_api_key
        or (settings.cloudflare_account_id and settings.cloudflare_api_token)
    )


async def generate_art_with_usage(
    prompt: str,
    headline: str,
    layout: str = "story",
    product: dict | None = None,
    fact: dict | None = None,
    template: str = "",
    palette: dict | None = None,
    cta: str = "",
) -> tuple[str, Any]:
    """Gera a arte no formato pedido e devolve também o consumo, para a esteira
    conseguir contabilizar o custo do passo.

    Ordem dos provedores: OpenRouter primeiro quando configurado, porque ele informa
    o custo real; Cloudflare depois, que é o mais barato dentro da franquia."""
    # Os três primeiros não passam por modelo de imagem nenhum. Saem sem custo,
    # sem texto ilegível e sem risco de o gerador inventar a marca de um terceiro.
    if layout == "feed" and template in {"produto", "comparativo", "dado"}:
        async with httpx.AsyncClient(timeout=40.0) as client:
            logo = await _fetch_brand_logo(client)
            photo = b""
            if template == "produto" and product:
                photo = await _fetch_product_image(client, str(product.get("image_url") or ""))
        try:
            if template == "dado" and fact:
                content = _compose_stat_art(logo, headline, fact, palette)
            elif template == "comparativo" and product:
                content = _compose_compare_art(logo, headline, product, palette)
            elif template == "produto" and product and photo:
                content = _compose_product_art(photo, logo, headline, product, palette)
            else:
                raise ValueError(f"template {template} sem o conteúdo que ele precisa")
        except (TypeError, ValueError, OSError) as exc:
            raise HTTPException(502, "Não foi possível montar a arte da peça.") from exc
        return await store_generated_art(content, "image/png"), None

    # Cena com o produto real dentro: a foto do catálogo vai como referência e o
    # modelo constrói o ambiente em volta, mantendo o aparelho que é da 4Core.
    if layout == "feed" and template == "cena" and product and scene_model_available():
        async with httpx.AsyncClient(timeout=40.0) as client:
            referencia = await _fetch_product_image(client, str(product.get("image_url") or ""))
            logo = await _fetch_brand_logo(client)
        from app.services.marketing_brand_system import product_appearance

        raw, usage = await _generate_openrouter_scene(
            prompt, referencia, headline, product_appearance(product)
        )
        try:
            content = _compose_feed_art(_crop_to_feed(raw), logo, headline, cta, palette)
        except (TypeError, ValueError, OSError) as exc:
            raise HTTPException(502, "Não foi possível finalizar a cena gerada.") from exc
        return await store_generated_art(content, "image/png"), usage

    if settings.openrouter_api_key:
        raw, usage = await _generate_openrouter_image(prompt)
    elif settings.cloudflare_account_id and settings.cloudflare_api_token:
        raw, usage = await _generate_cloudflare_image(prompt)
    else:
        raise HTTPException(
            503,
            "Configure OPENROUTER_API_KEY ou as credenciais do Cloudflare Workers AI para gerar artes.",
        )

    # O story limpa o topo dentro de _compose_brand_art, onde fica a interface da
    # Meta; o feed não precisa disso e por isso tem composição própria.
    async with httpx.AsyncClient(timeout=30.0) as client:
        logo = await _fetch_brand_logo(client)
    try:
        if layout == "feed":
            content = _compose_feed_art(_crop_to_feed(raw), logo, headline, cta, palette)
        else:
            # O story nao leva CTA: ali o rodape e o topo sao da interface da
            # Meta, e botao desenhado embaixo fica atras da barra de resposta.
            content = _compose_brand_art(_crop_to_story(raw), logo, headline)
    except (TypeError, ValueError, OSError) as exc:
        raise HTTPException(502, "Não foi possível finalizar a arte gerada.") from exc
    return await store_generated_art(content, "image/png"), usage
