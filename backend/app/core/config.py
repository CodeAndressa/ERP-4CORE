from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "4Core Consultoria Estratégica"
    app_env: str = "development"
    secret_key: str = "change-me"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    database_url: str = "sqlite:///./app.db"
    cors_origins: str = "http://127.0.0.1:5174,http://localhost:5174"
    asaas_api_key: str = ""
    asaas_base_url: str = "https://api.asaas.com/v3"
    site_supabase_url: str = ""
    site_supabase_service_role_key: str = ""
    contract_storage_bucket: str = "contracts"
    marketing_assets_bucket: str = "marketing-assets"
    bootstrap_admin_name: str = ""
    bootstrap_admin_email: str = ""
    bootstrap_admin_password: str = ""
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_redirect_uri: str = ""
    meta_graph_version: str = "v23.0"
    meta_access_token: str = ""
    meta_page_id: str = ""
    meta_page_access_token: str = ""
    instagram_business_account_id: str = ""
    meta_webhook_verify_token: str = ""
    # App separado "Instagram API com Login do Instagram" (graph.instagram.com) — usado
    # só para DMs, distinto do app de Facebook Login acima (graph.facebook.com).
    instagram_login_app_id: str = ""
    instagram_login_app_secret: str = ""
    instagram_login_access_token: str = ""
    instagram_login_user_id: str = ""
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    openai_api_key: str = ""
    openai_image_model: str = "gpt-image-2"
    cloudflare_account_id: str = ""
    cloudflare_api_token: str = ""
    cloudflare_image_model: str = "@cf/leonardo/lucid-origin"
    marketing_cron_secret: str = ""
    cron_secret: str = ""
    resend_api_key: str = ""
    email_from: str = ""
    email_to: str = ""
    collections_dry_run: bool = True
    collections_cron_secret: str = ""

    class Config:
        env_file = str(Path(__file__).resolve().parents[3] / ".env")
        extra = "ignore"


settings = Settings()
