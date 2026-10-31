from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:1.7b"
    database_url: str = "sqlite:///./dockproof.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()
