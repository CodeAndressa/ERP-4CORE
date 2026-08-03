"""Aprendizado por feedback das artes de story.

Nem o Groq nem o gerador de imagem permitem fine-tuning aqui, então o aprendizado
acontece por condicionamento de prompt: todo feedback registrado na tela do Estúdio
é reinjetado nas gerações seguintes. O efeito prático é o que se espera de um
sistema treinado — o que foi reprovado uma vez não volta — sem depender de nenhum
passo manual depois do clique.

São duas camadas:

1. Bruta, sempre ativa. Os feedbacks mais recentes entram na íntegra, o que faz o
   primeiro feedback já valer na geração seguinte.
2. Destilada, a partir de DISTILL_MINIMUM feedbacks. A IA condensa o histórico
   inteiro em regras curtas e resolve contradições, e o resultado fica em cache em
   MarketingArtLesson. Sem isso o prompt cresceria indefinidamente e ficaria
   ambíguo conforme o histórico aumenta.

A camada 1 continua sendo anexada mesmo quando existe destilação, senão um feedback
dado agora só valeria depois da próxima redestilação.
"""

from __future__ import annotations

import json

import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.marketing import MarketingArtFeedback, MarketingArtLesson, MarketingContent


# As tags que a tela oferece. O roteamento por tag é o que mantém o aprendizado
# preciso: "a pessoa ficou com cara de boneco" não tem nada a ver com a redação.
ASPECT_LABELS = {
    "imagem": "cena e fotografia",
    "cores": "cor e luz",
    "texto": "frase escrita na arte",
    "tom": "tom de voz",
    "legibilidade": "leitura do texto sobre a imagem",
    "marca": "logo e link do site",
}
COPY_ASPECTS = {"texto", "tom"}
IMAGE_ASPECTS = {"imagem", "cores", "legibilidade", "marca"}

SENTIMENTS = {"liked", "disliked"}

RAW_WINDOW = 4        # feedbacks recentes sempre injetados na íntegra
DISTILL_MINIMUM = 8   # abaixo disso o histórico bruto ainda é curto o bastante
DISTILL_STEP = 4      # só redestila quando entram tantos feedbacks novos
MAX_RULES = 10

DISTILL_SYSTEM_PROMPT = """
Você é a diretora de arte da 4Core consolidando o feedback da equipe sobre os
stories já gerados. Recebe a lista de feedbacks e devolve regras curtas, para que
as próximas gerações não repitam o que foi reprovado e mantenham o que foi elogiado.

Regras da destilação:
- no máximo 10 regras em copy_rules e 10 em image_rules;
- cada regra é uma ordem curta e verificável, nunca um comentário vago;
- quando dois feedbacks se contradizem, vale o mais recente, e a regra sai só uma vez;
- feedback positivo vira regra de manutenção ("manter ..."), negativo vira proibição
  ("nunca ...", "evitar ...");
- não invente preferência que não esteja no feedback.

copy_rules trata da frase escrita na arte e do tom de voz, e deve ser escrita em
português brasileiro com acentuação correta.
image_rules trata da fotografia, cor, luz, composição e espaço da marca, e deve ser
escrita EM INGLÊS, porque vai direto para o gerador de imagem.

Responda somente JSON válido: {"copy_rules": [string], "image_rules": [string]}
""".strip()


def normalize_aspects(values: list[str] | str | None) -> str:
    """Aceita lista ou string separada por vírgula e devolve só as tags conhecidas,
    sem repetir e na ordem de ASPECT_LABELS, para o texto do prompt ficar estável."""
    if not values:
        return ""
    raw = values.split(",") if isinstance(values, str) else values
    marked = {str(value).strip().lower() for value in raw}
    return ",".join(aspect for aspect in ASPECT_LABELS if aspect in marked)


def _aspects_of(feedback: MarketingArtFeedback) -> set[str]:
    return {value for value in (feedback.aspects or "").split(",") if value}


def _relevant_for(feedback: MarketingArtFeedback, group: set[str]) -> bool:
    """Feedback sem tag alguma vale para os dois prompts: sem informação de escopo,
    descartar seria pior do que aplicar nos dois lados."""
    marked = _aspects_of(feedback)
    return not marked or bool(marked & group)


def record_feedback(
    db: Session,
    *,
    content: MarketingContent,
    sentiment: str,
    notes: str,
    aspects: list[str] | str | None,
) -> MarketingArtFeedback:
    feedback = MarketingArtFeedback(
        content_id=content.id,
        sentiment=sentiment if sentiment in SENTIMENTS else "disliked",
        aspects=normalize_aspects(aspects),
        notes=notes.strip()[:2000],
        headline=(content.headline or content.title or "")[:200],
        image_prompt=(content.image_prompt or "")[:4000],
    )
    db.add(feedback)
    db.commit()
    db.refresh(feedback)
    return feedback


def list_feedback(db: Session, content_id: int | None = None, limit: int = 60) -> list[MarketingArtFeedback]:
    query = db.query(MarketingArtFeedback)
    if content_id is not None:
        query = query.filter(MarketingArtFeedback.content_id == content_id)
    return query.order_by(MarketingArtFeedback.created_at.desc(), MarketingArtFeedback.id.desc()).limit(limit).all()


def delete_feedback(db: Session, feedback_id: int) -> bool:
    """Um aprendizado errado precisa ser removível, senão o sistema degrada sozinho
    e sem recurso. Zera a marca d'água para o histórico ser redestilado sem ele."""
    feedback = db.query(MarketingArtFeedback).filter(MarketingArtFeedback.id == feedback_id).first()
    if not feedback:
        return False
    db.delete(feedback)
    lesson = _current_lesson(db)
    if lesson:
        lesson.feedback_count = 0
    db.commit()
    return True


def _current_lesson(db: Session) -> MarketingArtLesson | None:
    return db.query(MarketingArtLesson).order_by(MarketingArtLesson.id.desc()).first()


def _rule_lines(value: str) -> list[str]:
    return [line.strip() for line in (value or "").splitlines() if line.strip()]


def _raw_lines(items: list[MarketingArtFeedback], group: set[str]) -> list[str]:
    lines: list[str] = []
    for feedback in items:
        if not feedback.notes or not _relevant_for(feedback, group):
            continue
        marked = _aspects_of(feedback) & group
        scope = f" [{', '.join(sorted(marked))}]" if marked else ""
        verb = "aprovado" if feedback.sentiment == "liked" else "reprovado"
        lines.append(f"- {verb}{scope}: {feedback.notes}")
    return lines


async def _distill(db: Session, items: list[MarketingArtFeedback], total: int) -> MarketingArtLesson | None:
    payload = {
        "feedbacks": [
            {
                "sentiment": item.sentiment,
                "aspects": item.aspects,
                "notes": item.notes,
                "headline_da_arte": item.headline,
            }
            for item in reversed(items)
            if item.notes
        ]
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.groq_api_key}", "Content-Type": "application/json"},
            json={
                "model": settings.groq_model,
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": DISTILL_SYSTEM_PROMPT},
                    {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
                ],
            },
        )
    if response.status_code >= 400:
        return None
    result = json.loads(response.json()["choices"][0]["message"]["content"])
    copy_rules = [str(rule).strip() for rule in result.get("copy_rules", []) if str(rule).strip()][:MAX_RULES]
    image_rules = [str(rule).strip() for rule in result.get("image_rules", []) if str(rule).strip()][:MAX_RULES]
    if not copy_rules and not image_rules:
        return None
    lesson = _current_lesson(db)
    if lesson is None:
        lesson = MarketingArtLesson()
        db.add(lesson)
    lesson.copy_rules = "\n".join(copy_rules)
    lesson.image_rules = "\n".join(image_rules)
    lesson.feedback_count = total
    db.commit()
    db.refresh(lesson)
    return lesson


async def learned_guidance(db: Session) -> dict[str, str]:
    """Blocos prontos para colar no prompt de redação e no de imagem. Nunca levanta
    exceção: uma falha no aprendizado não pode impedir a geração do story."""
    empty = {"copy": "", "image": ""}
    try:
        total = db.query(MarketingArtFeedback).count()
        if not total:
            return empty
        items = list_feedback(db)
        lesson = _current_lesson(db)
        stale = lesson is None or (total - lesson.feedback_count) >= DISTILL_STEP
        if settings.groq_api_key and total >= DISTILL_MINIMUM and stale:
            try:
                lesson = await _distill(db, items, total) or lesson
            except (httpx.HTTPError, KeyError, TypeError, ValueError, json.JSONDecodeError):
                pass

        recent = items[:RAW_WINDOW]
        blocks: dict[str, str] = {}
        for key, group, rules in (
            ("copy", COPY_ASPECTS, _rule_lines(lesson.copy_rules) if lesson else []),
            ("image", IMAGE_ASPECTS, _rule_lines(lesson.image_rules) if lesson else []),
        ):
            sections: list[str] = []
            if rules:
                sections.append("\n".join(f"- {rule}" for rule in rules))
            raw = _raw_lines(recent, group)
            if raw:
                sections.append("\n".join(raw))
            blocks[key] = (
                "FEEDBACK APRENDIDO DA EQUIPE 4CORE — cumprir sem exceção:\n" + "\n".join(sections)
                if sections
                else ""
            )
        return blocks
    except Exception:
        return empty


def learning_snapshot(db: Session) -> dict:
    """O que a tela mostra em "O que a IA aprendeu". Sem essa visibilidade o
    aprendizado seria uma caixa preta que ninguém consegue auditar nem corrigir."""
    lesson = _current_lesson(db)
    total = db.query(MarketingArtFeedback).count()
    liked = db.query(MarketingArtFeedback).filter(MarketingArtFeedback.sentiment == "liked").count()
    return {
        "total": total,
        "liked": liked,
        "disliked": total - liked,
        "copy_rules": _rule_lines(lesson.copy_rules) if lesson else [],
        "image_rules": _rule_lines(lesson.image_rules) if lesson else [],
        "distilled_at": lesson.updated_at.isoformat() if lesson and lesson.updated_at else None,
        "pending": max(0, total - lesson.feedback_count) if lesson else total,
        "distill_minimum": DISTILL_MINIMUM,
        "aspects": ASPECT_LABELS,
    }
