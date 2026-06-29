from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/integrations", tags=["integrations"])


@router.get("/status")
def integration_status():
    """Exibe flags de configuração, sem retornar chaves ou dados sensíveis."""
    return {
        "site_analytics": bool(settings.site_supabase_url and settings.site_supabase_service_role_key),
        "financial": bool(settings.asaas_api_key),
        "instagram": bool(settings.meta_access_token and settings.instagram_business_account_id),
        "ai": bool(settings.groq_api_key),
        "email": bool(settings.resend_api_key and settings.email_from),
        "contract_storage": bool(settings.site_supabase_url and settings.site_supabase_service_role_key and settings.contract_storage_bucket),
    }