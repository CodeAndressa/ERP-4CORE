from __future__ import annotations

"""Leitura e comparação dos perfis concorrentes no Instagram.

A fonte é a Business Discovery do Graph API: oficial, sem custo adicional e com o
mesmo token da conta já conectada. Ela devolve só o que é público, então todo o
cálculo daqui em diante usa curtidas e comentários — nunca alcance ou impressões,
que a Meta não entrega para perfil de terceiro.
"""

from collections import Counter
from datetime import datetime, timedelta, timezone
import re
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.marketing import CompetitorPost, CompetitorSnapshot, MarketingCompetitor
from app.services.meta_marketing_service import MetaMarketingService

HASHTAG_RE = re.compile(r"#(\w{2,40})", re.UNICODE)
USERNAME_RE = re.compile(r"^[A-Za-z0-9._]{1,30}$")

# Janela padrão de análise. Trinta dias é o que cobre um mês de calendário
# editorial sem que um viral antigo distorça a média de engajamento.
DEFAULT_WINDOW_DAYS = 30


def normalize_username(value: str) -> str:
    handle = (value or "").strip().lstrip("@").strip()
    if not USERNAME_RE.fullmatch(handle):
        raise HTTPException(422, "Use apenas o @ do perfil, sem link nem espaços. Ex.: 4coreconsultoria")
    return handle.lower()


def _aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _parse_timestamp(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def list_competitors(db: Session, only_active: bool = False) -> list[MarketingCompetitor]:
    query = db.query(MarketingCompetitor)
    if only_active:
        query = query.filter(MarketingCompetitor.active.is_(True))
    return query.order_by(MarketingCompetitor.followers_count.desc(), MarketingCompetitor.username).all()


def add_competitor(db: Session, username: str, display_name: str = "", notes: str = "") -> MarketingCompetitor:
    handle = normalize_username(username)
    existing = db.query(MarketingCompetitor).filter(MarketingCompetitor.username == handle).first()
    if existing:
        raise HTTPException(409, f"@{handle} já está na lista de concorrentes.")
    competitor = MarketingCompetitor(
        username=handle,
        display_name=display_name.strip()[:180],
        notes=notes.strip()[:2000],
    )
    db.add(competitor)
    db.commit()
    db.refresh(competitor)
    return competitor


def get_competitor(db: Session, competitor_id: int) -> MarketingCompetitor:
    competitor = db.query(MarketingCompetitor).filter(MarketingCompetitor.id == competitor_id).first()
    if not competitor:
        raise HTTPException(404, "Concorrente não encontrado.")
    return competitor


def delete_competitor(db: Session, competitor_id: int) -> None:
    competitor = get_competitor(db, competitor_id)
    db.query(CompetitorPost).filter(CompetitorPost.competitor_id == competitor.id).delete()
    db.query(CompetitorSnapshot).filter(CompetitorSnapshot.competitor_id == competitor.id).delete()
    db.delete(competitor)
    db.commit()


async def sync_competitor(db: Session, competitor: MarketingCompetitor, media_limit: int = 24) -> MarketingCompetitor:
    """Atualiza perfil e posts de um concorrente. Guarda o erro na própria linha em
    vez de estourar para o chamador: numa sincronização em lote, um perfil que virou
    privado não pode derrubar a leitura dos outros."""
    try:
        data = await MetaMarketingService().business_discovery(competitor.username, media_limit)
    except HTTPException as exc:
        competitor.last_error = str(exc.detail)[:2000]
        competitor.last_synced_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(competitor)
        return competitor

    competitor.display_name = str(data.get("name") or competitor.display_name or "")[:180]
    competitor.biography = str(data.get("biography") or "")[:4000]
    competitor.profile_picture_url = str(data.get("profile_picture_url") or "")[:600]
    competitor.followers_count = int(data.get("followers_count") or 0)
    competitor.follows_count = int(data.get("follows_count") or 0)
    competitor.media_count = int(data.get("media_count") or 0)
    competitor.last_error = ""
    competitor.last_synced_at = datetime.now(timezone.utc)

    db.add(
        CompetitorSnapshot(
            competitor_id=competitor.id,
            followers_count=competitor.followers_count,
            media_count=competitor.media_count,
        )
    )

    media = (data.get("media") or {}).get("data") or []
    for item in media:
        media_id = str(item.get("id") or "")
        if not media_id:
            continue
        post = db.query(CompetitorPost).filter(CompetitorPost.media_id == media_id).first()
        if not post:
            post = CompetitorPost(competitor_id=competitor.id, media_id=media_id)
            db.add(post)
        post.media_type = str(item.get("media_type") or "")[:30]
        post.media_product_type = str(item.get("media_product_type") or "")[:30]
        post.caption = str(item.get("caption") or "")[:6000]
        post.permalink = str(item.get("permalink") or "")[:600]
        post.like_count = int(item.get("like_count") or 0)
        post.comments_count = int(item.get("comments_count") or 0)
        post.posted_at = _parse_timestamp(item.get("timestamp"))
        post.synced_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(competitor)
    return competitor


async def sync_all(db: Session, media_limit: int = 24) -> list[MarketingCompetitor]:
    results = []
    for competitor in list_competitors(db, only_active=True):
        results.append(await sync_competitor(db, competitor, media_limit))
    return results


def _posting_cadence(posts: list[dict[str, Any]], window_days: int) -> float:
    if not posts:
        return 0.0
    return round(len(posts) * 7 / window_days, 2)


def _engagement(posts: list[dict[str, Any]], followers: int) -> dict[str, Any]:
    """Engajamento por post em relação aos seguidores. É a única métrica que compara
    perfis de tamanhos diferentes: 300 curtidas valem muito em uma base de 2 mil e
    quase nada em uma de 200 mil."""
    if not posts:
        return {"avg_likes": 0.0, "avg_comments": 0.0, "engagement_rate": 0.0}
    likes = sum(post["like_count"] for post in posts) / len(posts)
    comments = sum(post["comments_count"] for post in posts) / len(posts)
    rate = ((likes + comments) / followers * 100) if followers else 0.0
    return {
        "avg_likes": round(likes, 1),
        "avg_comments": round(comments, 1),
        "engagement_rate": round(rate, 2),
    }


def _formats(posts: list[dict[str, Any]]) -> dict[str, int]:
    counter = Counter(post.get("media_type") or "DESCONHECIDO" for post in posts)
    return dict(counter.most_common())


def _hashtags(posts: list[dict[str, Any]], limit: int = 12) -> list[str]:
    counter: Counter[str] = Counter()
    for post in posts:
        counter.update(tag.lower() for tag in HASHTAG_RE.findall(post.get("caption") or ""))
    return [f"#{tag}" for tag, _ in counter.most_common(limit)]


def _top_posts(posts: list[dict[str, Any]], limit: int = 5) -> list[dict[str, Any]]:
    """Comentário pesa mais que curtida no ranking porque custa mais ao seguidor —
    um post com 40 comentários diz mais sobre o que engaja do que um com 400 curtidas."""
    ordered = sorted(posts, key=lambda post: post["like_count"] + post["comments_count"] * 3, reverse=True)
    return [
        {
            "caption": (post.get("caption") or "")[:400],
            "media_type": post.get("media_type"),
            "like_count": post["like_count"],
            "comments_count": post["comments_count"],
            "permalink": post.get("permalink"),
            "posted_at": post["posted_at"].isoformat() if post.get("posted_at") else None,
        }
        for post in ordered[:limit]
    ]


def _follower_delta(db: Session, competitor_id: int, window_days: int) -> dict[str, Any]:
    """Crescimento no período, medido entre o primeiro e o último snapshot dentro da
    janela. Volta zerado enquanto houver só uma sincronização: sem duas fotos não há
    variação, e inventar uma base daria um crescimento falso."""
    since = datetime.now(timezone.utc) - timedelta(days=window_days)
    snapshots = (
        db.query(CompetitorSnapshot)
        .filter(CompetitorSnapshot.competitor_id == competitor_id, CompetitorSnapshot.captured_at >= since)
        .order_by(CompetitorSnapshot.captured_at)
        .all()
    )
    if len(snapshots) < 2:
        return {"followers_gained": 0, "followers_growth_pct": 0.0, "growth_measured": False}
    first, last = snapshots[0], snapshots[-1]
    gained = last.followers_count - first.followers_count
    pct = (gained / first.followers_count * 100) if first.followers_count else 0.0
    return {"followers_gained": gained, "followers_growth_pct": round(pct, 2), "growth_measured": True}


def _window_view(posts: list[dict[str, Any]], window_days: int, followers: int) -> dict[str, Any]:
    """Separa o que aconteceu na janela do que e so historico.

    A primeira versao, quando a janela vinha vazia, caia para o historico inteiro
    e dividia por `window_days`. Num perfil parado ha dois meses isso devolvia 24
    posts por semana, ou seja, dizia que a conta estava bombando justamente quando
    tinha parado. Agora cadencia e sempre da janela, podendo ser zero, e o
    engajamento, quando nao ha nada na janela, vem do historico recente marcado
    como tal."""
    now = datetime.now(timezone.utc)
    since = now - timedelta(days=window_days)
    dated = [post for post in posts if post.get("posted_at")]
    in_window = [post for post in dated if post["posted_at"] >= since]

    last_post = max((post["posted_at"] for post in dated), default=None)
    days_silent = (now - last_post).days if last_post else None

    # Sem nada na janela, o engajamento sai das publicacoes recentes do historico.
    # E referencia, nao desempenho atual, e a tela precisa dizer isso.
    basis = in_window or dated[:12]
    from_history = not in_window and bool(basis)

    # Formato e hashtag descrevem estilo, não desempenho, então vale uma amostra
    # maior que a do engajamento. Com as 12 de engajamento, um perfil que mistura
    # vídeo e carrossel aparecia como se só publicasse imagem, e o estrategista
    # chegou a recomendar "comece a usar vídeo" para quem já usava.
    style_basis = in_window or dated[:40]

    return {
        "posts_analyzed": len(in_window),
        "posts_per_week": _posting_cadence(in_window, window_days),
        **_engagement(basis, followers),
        "engagement_from_history": from_history,
        "engagement_sample": len(basis),
        "last_post_at": last_post.isoformat() if last_post else None,
        "days_since_last_post": days_silent,
        "is_silent": bool(days_silent is not None and days_silent > window_days),
        "formats": _formats(style_basis),
        "style_sample": len(style_basis),
        "top_hashtags": _hashtags(style_basis),
        "top_posts": _top_posts(basis),
    }


def competitor_profile(
    db: Session,
    competitor: MarketingCompetitor,
    window_days: int = DEFAULT_WINDOW_DAYS,
) -> dict[str, Any]:
    rows = (
        db.query(CompetitorPost)
        .filter(CompetitorPost.competitor_id == competitor.id)
        .order_by(CompetitorPost.posted_at.desc())
        .limit(100)
        .all()
    )
    posts = [
        {
            "caption": row.caption,
            "media_type": row.media_type,
            "like_count": row.like_count,
            "comments_count": row.comments_count,
            "permalink": row.permalink,
            "posted_at": _aware(row.posted_at),
        }
        for row in rows
    ]
    return {
        "id": competitor.id,
        "username": competitor.username,
        "display_name": competitor.display_name,
        "biography": competitor.biography,
        "profile_picture_url": competitor.profile_picture_url,
        "active": competitor.active,
        "notes": competitor.notes,
        "followers_count": competitor.followers_count,
        "media_count": competitor.media_count,
        **_window_view(posts, window_days, competitor.followers_count),
        **_follower_delta(db, competitor.id, window_days),
        "last_synced_at": _aware(competitor.last_synced_at).isoformat() if competitor.last_synced_at else None,
        "last_error": competitor.last_error,
    }


async def own_profile_metrics(window_days: int = DEFAULT_WINDOW_DAYS) -> dict[str, Any]:
    """Os mesmos cálculos aplicados à conta da 4Core, para a comparação ficar maçã
    com maçã. Usa curtidas e comentários públicos, e não os insights da conta, de
    propósito: só assim a taxa sai pela mesma régua usada nos concorrentes."""
    service = MetaMarketingService()
    profile = await service.instagram_profile()
    # Teto alto o bastante para cobrir a janela inteira mesmo publicando todo dia:
    # o corte por data vem depois, e o que importa e nao perder post dentro dela.
    media = await service.instagram_media(limit=max(120, window_days * 3))
    posts = [
        {
            "caption": str(item.get("caption") or ""),
            "media_type": str(item.get("media_type") or ""),
            "like_count": int(item.get("like_count") or 0),
            "comments_count": int(item.get("comments_count") or 0),
            "permalink": item.get("permalink"),
            "posted_at": _parse_timestamp(item.get("timestamp")),
        }
        for item in media
    ]
    followers = int(profile.get("followers_count") or 0)
    view = _window_view(posts, window_days, followers)
    return {
        "username": profile.get("username") or "",
        "display_name": profile.get("name") or "",
        "biography": profile.get("biography") or "",
        "followers_count": followers,
        "media_count": int(profile.get("media_count") or 0),
        **view,
        # A redação imita o tom das legendas recentes, então aqui vale o histórico
        # mesmo quando a janela está vazia: sem isso um perfil parado perderia a voz.
        "recent_captions": [post["caption"][:600] for post in posts if post["caption"]][:15],
    }


async def build_benchmark(db: Session, window_days: int = DEFAULT_WINDOW_DAYS) -> dict[str, Any]:
    """Painel comparativo: a 4Core de um lado, os concorrentes do outro, e a posição
    dela no ranking de engajamento. É o insumo da análise da IA e também o que a tela
    mostra direto, sem precisar de IA nenhuma."""
    competitors = [
        competitor_profile(db, competitor, window_days)
        for competitor in list_competitors(db, only_active=True)
    ]
    own: dict[str, Any] = {}
    own_error = ""
    try:
        own = await own_profile_metrics(window_days)
    except HTTPException as exc:
        own_error = str(exc.detail)
    except Exception:
        own_error = "Não foi possível ler o perfil da 4Core no Instagram agora."

    rated = [item for item in competitors if item["posts_analyzed"]]
    avg_rate = round(sum(item["engagement_rate"] for item in rated) / len(rated), 2) if rated else 0.0
    avg_cadence = round(sum(item["posts_per_week"] for item in rated) / len(rated), 2) if rated else 0.0

    ranking_pool = sorted(
        [*rated, *([own] if own.get("posts_analyzed") else [])],
        key=lambda item: item["engagement_rate"],
        reverse=True,
    )
    position = next(
        (index + 1 for index, item in enumerate(ranking_pool) if item.get("username") == own.get("username")),
        None,
    ) if own.get("username") else None

    return {
        "window_days": window_days,
        "own": own,
        "own_error": own_error,
        "competitors": competitors,
        "market": {
            "competitors_tracked": len(competitors),
            "avg_engagement_rate": avg_rate,
            "avg_posts_per_week": avg_cadence,
            "own_position": position,
            "ranking_size": len(ranking_pool),
            "engagement_gap": round((own.get("engagement_rate") or 0) - avg_rate, 2),
            "cadence_gap": round((own.get("posts_per_week") or 0) - avg_cadence, 2),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def serialize_competitor(competitor: MarketingCompetitor) -> dict[str, Any]:
    return {
        "id": competitor.id,
        "username": competitor.username,
        "display_name": competitor.display_name,
        "notes": competitor.notes,
        "active": competitor.active,
        "followers_count": competitor.followers_count,
        "media_count": competitor.media_count,
        "last_synced_at": _aware(competitor.last_synced_at).isoformat() if competitor.last_synced_at else None,
        "last_error": competitor.last_error,
    }
