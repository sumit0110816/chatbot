import secrets
from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "NOVA AI"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-4-hydrogen"
    AI_PROVIDER: str = "gemini"
    DATABASE_URL: str = "sqlite:///./nova_ai.db"
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    REMEMBER_TOKEN_EXPIRE_MINUTES: int = 43200
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173"
    SMTP_HOST: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def jwt_secret(self) -> str:
        if self.SECRET_KEY and len(self.SECRET_KEY.strip()) >= 16:
            return self.SECRET_KEY.strip()
        return _EPHEMERAL_SECRET

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


_EPHEMERAL_SECRET = secrets.token_hex(32)


@lru_cache
def get_settings() -> Settings:
    return Settings()
