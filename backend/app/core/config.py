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
    meta_app_id: str = ""
    meta_app_secret: str = ""
    meta_access_token: str = ""
    instagram_business_account_id: str = ""
    meta_webhook_verify_token: str = ""
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    resend_api_key: str = ""
    email_from: str = ""
    email_to: str = ""

    class Config:
        env_file = str(Path(__file__).resolve().parents[3] / ".env")
        extra = "ignore"


settings = Settings()