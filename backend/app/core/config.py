import os
from pathlib import Path

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), env_file_encoding="utf-8", extra="ignore")

    app_name: str = "EdeniSystem API"
    env: str = "dev"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 3
    refresh_token_expire_minutes: int = 60 * 24 * 30

    pii_encryption_key: str
    pii_hmac_key: str

    firebase_service_account_path: str | None = None
    firebase_service_account_json: str | None = None

    platform_admin_email: str | None = None
    platform_admin_password: str | None = None

    database_url: str
    database_url_clone: str | None = None

    supabase_url: str | None = None
    supabase_service_role_key: str | None = None

    cron_secret: str | None = None

    cors_origins: str = "http://localhost:3000"

    cookie_domain: str | None = None

    # Public base URL of this API (used to build shareable receipt links).
    # e.g. https://api.edenisystem.com  — defaults to localhost for dev.
    public_api_url: str = "http://localhost:8000"

    @computed_field
    @property
    def effective_database_url(self) -> str:
        use_clone = os.environ.get("USE_CLONE_DB", "").lower() in ("1", "true")
        if use_clone and self.database_url_clone:
            return self.database_url_clone
        return self.database_url

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
