"""
Application Configuration
Reads all settings from environment variables / .env file.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_NAME: str = "AI Interview Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/ai_interview"

    @property
    def async_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_PASSWORD: str | None = None

    # JWT
    JWT_SECRET_KEY: str = "super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # AI Providers
    GEMINI_API_KEY: str = ""
    GEMINII_API_KEY: str = ""  # Fallback for user's custom naming

    # Google Cloud (Speech-to-Text)
    GOOGLE_APPLICATION_CREDENTIALS: str = ""

    # SMTP Email
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@ai-interview.com"
    SMTP_FROM_NAME: str = "AI Interview Platform"

    # Storage
    STORAGE_PATH: str = "./storage"

    # Internal API key (used by worker to call FastAPI internal endpoints)
    INTERNAL_API_KEY: str = "internal-secret-key-change-in-production"

    # CORS
    ALLOWED_ORIGINS: list[str] = ["*"]


@lru_cache()
def get_settings() -> Settings:
    return Settings()
