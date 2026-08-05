from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "EdeniSystem API"
    env: str = "dev"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 3
    refresh_token_expire_minutes: int = 60 * 24 * 30

    pii_encryption_key: str
    pii_hmac_key: str

    firebase_service_account_path: str | None = None

    platform_admin_email: str | None = None
    platform_admin_password: str | None = None

    database_url: str

    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
