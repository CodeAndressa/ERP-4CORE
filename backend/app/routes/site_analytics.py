from typing import Annotated

from fastapi import APIRouter, HTTPException, Query

from app.services.site_analytics_service import SiteAnalyticsNotConfigured, get_site_dashboard

router = APIRouter(prefix="/site", tags=["site analytics"])


@router.get("/dashboard")
async def site_dashboard(days: Annotated[int, Query(ge=1, le=90)] = 30):
    """Métricas agregadas e seguras do 4core.site, próprias para o frontend."""
    try:
        payload = await get_site_dashboard(days)
        payload.pop("recent_leads", None)
        return payload
    except SiteAnalyticsNotConfigured:
        return {
            "configured": False,
            "message": "Configure SITE_SUPABASE_URL e SITE_SUPABASE_SERVICE_ROLE_KEY no ambiente do backend.",
        }
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Não foi possível sincronizar os dados do site.") from exc
