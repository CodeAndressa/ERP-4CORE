from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.services.marketing_agent_service import (
    AGENT_ROSTER,
    MAX_IDEAS_PER_RUN,
    cost_dashboard,
    created_from_run,
    get_run,
    list_runs,
    list_steps,
    run_cost,
    run_pipeline,
    serialize_run,
    serialize_step,
)
from app.services.marketing_discovery_service import DEFAULT_HASHTAGS, discover_brands
from app.services.marketing_competitor_service import (
    DEFAULT_WINDOW_DAYS,
    add_competitor,
    build_benchmark,
    competitor_profile,
    delete_competitor,
    get_competitor,
    list_competitors,
    serialize_competitor,
    sync_all,
    sync_competitor,
)

router = APIRouter(prefix="/marketing/agent", tags=["marketing-agent"])


class CompetitorCreate(BaseModel):
    username: str = Field(min_length=1, max_length=60)
    display_name: str = Field(default="", max_length=180)
    notes: str = Field(default="", max_length=2000)


class CompetitorUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=180)
    notes: str | None = Field(default=None, max_length=2000)
    active: bool | None = None


class DiscoverRequest(BaseModel):
    hashtags: list[str] = Field(default_factory=lambda: list(DEFAULT_HASHTAGS), max_length=5)


class RunRequest(BaseModel):
    window_days: int = Field(default=DEFAULT_WINDOW_DAYS, ge=7, le=90)
    sync_first: bool = True
    # 0 roda so a analise, sem produzir peca nenhuma.
    content_limit: int = Field(default=3, ge=0, le=MAX_IDEAS_PER_RUN)
    layout: Literal["feed", "story"] = "feed"
    with_art: bool = True
    cadence_days: int = Field(default=2, ge=1, le=14)


@router.get("/competitors")
def get_competitors(db: Session = Depends(get_db)):
    return [serialize_competitor(competitor) for competitor in list_competitors(db)]


@router.post("/competitors", status_code=201)
def create_competitor(payload: CompetitorCreate, db: Session = Depends(get_db)):
    competitor = add_competitor(db, payload.username, payload.display_name, payload.notes)
    return serialize_competitor(competitor)


@router.patch("/competitors/{competitor_id}")
def update_competitor(competitor_id: int, payload: CompetitorUpdate, db: Session = Depends(get_db)):
    competitor = get_competitor(db, competitor_id)
    if payload.display_name is not None:
        competitor.display_name = payload.display_name.strip()[:180]
    if payload.notes is not None:
        competitor.notes = payload.notes.strip()[:2000]
    if payload.active is not None:
        competitor.active = payload.active
    db.commit()
    db.refresh(competitor)
    return serialize_competitor(competitor)


@router.delete("/competitors/{competitor_id}", status_code=204)
def remove_competitor(competitor_id: int, db: Session = Depends(get_db)):
    delete_competitor(db, competitor_id)


@router.post("/competitors/sync")
async def sync_competitors(db: Session = Depends(get_db)):
    competitors = await sync_all(db)
    return [serialize_competitor(competitor) for competitor in competitors]


@router.post("/competitors/{competitor_id}/sync")
async def sync_one(competitor_id: int, db: Session = Depends(get_db)):
    competitor = await sync_competitor(db, get_competitor(db, competitor_id))
    return serialize_competitor(competitor)


@router.get("/competitors/{competitor_id}/profile")
def competitor_detail(
    competitor_id: int,
    window_days: int = Query(default=DEFAULT_WINDOW_DAYS, ge=7, le=90),
    db: Session = Depends(get_db),
):
    return competitor_profile(db, get_competitor(db, competitor_id), window_days)


@router.get("/benchmark")
async def benchmark(
    window_days: int = Query(default=DEFAULT_WINDOW_DAYS, ge=7, le=90),
    db: Session = Depends(get_db),
):
    """Comparativo puro, sem IA. É a tela abrindo: mostra os números mesmo que a
    chave do modelo não esteja configurada ou a cota do dia tenha acabado."""
    return await build_benchmark(db, window_days)


@router.post("/discover")
async def discover(payload: DiscoverRequest):
    """Marcas do setor ativas nas hashtags informadas.

    Devolve nome e evidencia, nao o @: a Meta nao liga hashtag a perfil, e adivinhar
    handle a partir do nome erra quase sempre. O @ fica com a usuaria, que confere
    pela busca do proprio Instagram."""
    result, usage = await discover_brands(payload.hashtags)
    return {**result, "cost": usage.as_dict() if usage else None}


@router.get("/hashtags/suggestions")
def hashtag_suggestions():
    return DEFAULT_HASHTAGS


@router.get("/roster")
def agent_roster():
    """Quem sao os agentes e o que cada um faz. A tela desenha a esteira a partir
    daqui, entao acrescentar um agente no servico ja o faz aparecer no painel."""
    return AGENT_ROSTER


@router.get("/costs")
def costs(days: int = Query(default=90, ge=1, le=365), db: Session = Depends(get_db)):
    return cost_dashboard(db, days)


@router.post("/run")
async def start_run(payload: RunRequest, db: Session = Depends(get_db)):
    return await run_pipeline(
        db,
        window_days=payload.window_days,
        sync_first=payload.sync_first,
        content_limit=payload.content_limit,
        layout=payload.layout,
        with_art=payload.with_art,
        cadence_days=payload.cadence_days,
        trigger="manual",
    )


@router.post("/run-cron")
async def start_run_cron(db: Session = Depends(get_db)):
    """Rodada agendada. A autenticação é o segredo de cron conferido no middleware,
    igual às outras rotas automáticas. Cria menos peças que a rodada manual porque
    ninguém está olhando na hora para descartar o que não presta."""
    return await run_pipeline(
        db,
        sync_first=True,
        content_limit=2,
        layout="feed",
        with_art=True,
        cadence_days=2,
        trigger="cron",
    )


@router.get("/runs")
def get_runs(limit: int = Query(default=20, ge=1, le=100), db: Session = Depends(get_db)):
    return [serialize_run(run) for run in list_runs(db, limit)]


@router.get("/runs/{run_id}")
def get_run_detail(run_id: int, db: Session = Depends(get_db)):
    run = get_run(db, run_id)
    return {
        **serialize_run(run, full=True),
        "steps": [serialize_step(step) for step in list_steps(db, run.id)],
        "costs": run_cost(db, run.id),
        # Sem isto a tela abre a rodada do historico sem as pecas dela, que e
        # exatamente o que se clica para ver.
        "created": created_from_run(db, run),
    }
