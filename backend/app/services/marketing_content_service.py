from __future__ import annotations

import base64
import io
import json
from typing import Any

import httpx
from fastapi import HTTPException
from PIL import Image, ImageDraw, ImageFont

from app.core.config import settings
from app.services.marketing_asset_service import store_generated_art
from app.services.marketing_brand_system import (
    CAPTION_ONLY_SYSTEM_PROMPT,
    COPY_SYSTEM_PROMPT,
    TOPIC_SUGGESTION_SYSTEM_PROMPT,
    build_image_prompt,
)


BRAND_LOGO_URL = (
    "https://erp-4-core.vercel.app/"
    "Logo%20com%20Tipografia%204Core%20-%20Principal%20Transparente.png"
)


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


async def suggest_content_topics(recent_captions: list[str], existing_titles: list[str]) -> list[dict[str, str]]:
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
                "model": settings.groq_model,
                "temperature": 0.78,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": TOPIC_SUGGESTION_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
            },
        )
    if response.status_code >= 400:
        raise HTTPException(502, f"Falha ao sugerir temas: {response.text[:220]}")
    try:
        raw = json.loads(response.json()["choices"][0]["message"]["content"])["suggestions"]
        suggestions = []
        used_titles = {" ".join(title.lower().split()) for title in existing_titles}
        for value in raw[:6]:
            suggestion = {
                "title": str(value["title"]).strip()[:180],
                "pillar": str(value["pillar"]).strip()[:60],
                "objective": str(value["objective"]).strip()[:500],
                "brief": str(value["brief"]).strip()[:2000],
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


async def generate_copy_and_prompt(title: str, brief: str, recent_captions: list[str]) -> dict[str, str]:
    if not settings.groq_api_key:
        headline = " ".join(title.split())[:90]
        return {
            "headline": headline,
            "caption": f"{title}\n\n{brief}".strip(),
            "image_prompt": build_image_prompt(headline, brief or title),
        }

    payload = {
        "title": title,
        "brief": brief,
        "recent_instagram_captions": recent_captions[:12],
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
            json={
                "model": settings.groq_model,
                "temperature": 0.55,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": COPY_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
            },
        )
    if response.status_code >= 400:
        raise HTTPException(502, f"Falha ao gerar a redação: {response.text[:220]}")
    try:
        result = json.loads(response.json()["choices"][0]["message"]["content"])
        return {
            "headline": str(result["headline"]),
            "caption": str(result["caption"]),
            "image_prompt": build_image_prompt(str(result["headline"]), str(result["visual_concept"])),
        }
    except (KeyError, TypeError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(502, "A IA de redação retornou um formato inválido.") from exc


async def generate_caption_only(
    title: str,
    brief: str,
    caption_reference: str,
    recent_captions: list[str],
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
                "model": settings.groq_model,
                "temperature": 0.55,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": CAPTION_ONLY_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
            },
        )
    if response.status_code >= 400:
        raise HTTPException(502, f"Falha ao gerar a legenda: {response.text[:220]}")
    try:
        result = json.loads(response.json()["choices"][0]["message"]["content"])
        return str(result["caption"])
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
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if not current or draw.textbbox((0, 0), candidate, font=font, stroke_width=2)[2] <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _compose_brand_art(background: bytes, logo_content: bytes, headline: str) -> bytes:
    canvas = Image.open(io.BytesIO(background)).convert("RGBA")
    width, height = canvas.size

    # Protege a leitura sem transformar a arte em um card sobreposto.
    shade = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shade_pixels = shade.load()
    shade_limit = max(1, round(width * 0.72))
    for x in range(shade_limit):
        progress = x / shade_limit
        alpha = round(185 * (1 - progress) ** 1.7)
        for y in range(height):
            shade_pixels[x, y] = (16, 0, 31, alpha)
    canvas = Image.alpha_composite(canvas, shade)

    logo = Image.open(io.BytesIO(logo_content)).convert("RGBA")
    logo_bbox = logo.getbbox()
    if logo_bbox is None:
        raise ValueError("Logo oficial sem conteudo visivel")
    logo = logo.crop(logo_bbox)
    logo_width = round(width * 0.29)
    logo_height = round(logo.height * logo_width / logo.width)
    logo = logo.resize((logo_width, logo_height), Image.Resampling.LANCZOS)
    margin_x = round(width * 0.065)
    margin_top = round(height * 0.055)
    canvas.alpha_composite(logo, (margin_x, margin_top))

    draw = ImageDraw.Draw(canvas)
    safe_headline = " ".join(headline.strip().split())[:90]
    max_text_width = round(width * 0.52)
    max_text_height = round(height * 0.34)
    selected_font = ImageFont.load_default(size=64)
    selected_lines: list[str] = [safe_headline]
    selected_spacing = 8
    for font_size in range(68, 43, -2):
        font = ImageFont.load_default(size=font_size)
        lines = _wrap_headline(draw, safe_headline, font, max_text_width)
        line_height = draw.textbbox((0, 0), "Ag", font=font, stroke_width=2)[3]
        spacing = max(7, round(font_size * 0.13))
        total_height = line_height * len(lines) + spacing * max(0, len(lines) - 1)
        if len(lines) <= 4 and total_height <= max_text_height:
            selected_font = font
            selected_lines = lines
            selected_spacing = spacing
            break

    accent_y = margin_top + logo_height + round(height * 0.09)
    draw.rounded_rectangle(
        (margin_x, accent_y, margin_x + round(width * 0.08), accent_y + 7),
        radius=4,
        fill=(123, 0, 255, 255),
    )
    text_y = accent_y + round(height * 0.04)
    line_height = draw.textbbox((0, 0), "Ag", font=selected_font, stroke_width=2)[3]
    for line in selected_lines:
        draw.text(
            (margin_x, text_y),
            line,
            font=selected_font,
            fill=(255, 255, 255, 255),
            stroke_width=2,
            stroke_fill=(255, 255, 255, 255),
        )
        text_y += line_height + selected_spacing

    output = io.BytesIO()
    canvas.convert("RGB").save(output, format="PNG", optimize=True)
    return output.getvalue()


async def _generate_cloudflare_art(prompt: str, headline: str) -> bytes:
    model = settings.cloudflare_image_model.strip() or "@cf/leonardo/lucid-origin"
    endpoint = (
        "https://api.cloudflare.com/client/v4/accounts/"
        f"{settings.cloudflare_account_id.strip()}/ai/run/{model}"
    )
    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {settings.cloudflare_api_token.strip()}",
                "Content-Type": "application/json",
            },
            json={
                "prompt": prompt,
                "negative_prompt": (
                    "flowers, lavender flowers, violet flowers, plants, leaves, garden, nature, landscape, "
                    "wellness, cosmetics, unrelated decorative object, any text, words, letters, numbers, "
                    "typography, pseudo-text, watermarks, misspelled text, invented logo, "
                    "fake certification, generic blue corporate style, stock photo smile, handshake, "
                    "analog clock, calendar, clutter, tiny typography, malformed hands, distorted device"
                ),
                "width": 720,
                "height": 1280,
                "num_steps": 20,
                "guidance": 6,
            },
        )
    if response.status_code >= 400:
        raise _cloudflare_error(response)
    try:
        content_type = response.headers.get("content-type", "").lower()
        raw = response.content
        looks_like_image = (
            raw.startswith(b"\x89PNG")
            or raw.startswith(b"\xff\xd8\xff")
            or (raw.startswith(b"RIFF") and raw[8:12] == b"WEBP")
        )
        if content_type.startswith("image/") or looks_like_image:
            content = response.content
        else:
            payload = response.json()
            result = payload.get("result", payload)
            encoded = result.get("image") if isinstance(result, dict) else result
            if not isinstance(encoded, str):
                raise ValueError("Resposta sem imagem")
            if encoded.startswith("data:"):
                encoded = encoded.split(",", 1)[1]
            content = base64.b64decode(encoded)
        cropped = _crop_to_story(content)
        async with httpx.AsyncClient(timeout=30.0) as client:
            logo_response = await client.get(BRAND_LOGO_URL)
        if logo_response.status_code >= 400:
            raise HTTPException(502, "Nao foi possivel carregar a logo oficial da 4Core.")
        return _compose_brand_art(cropped, logo_response.content, headline)
    except (TypeError, ValueError, OSError, json.JSONDecodeError) as exc:
        raise HTTPException(502, "A Cloudflare não retornou uma imagem válida.") from exc


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
