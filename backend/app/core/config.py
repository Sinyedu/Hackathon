from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:1.7b"
    database_url: str = "sqlite:///./dockproof.db"
    uploads_dir: str = "./uploads"
    suppliers_path: str = str(Path(__file__).resolve().parents[3] / "fixtures" / "suppliers.json")
    catalog_path: str = str(Path(__file__).resolve().parents[3] / "fixtures" / "catalog.json")
    # Comma-separated exact origins allowed to call the API (e.g. your Vercel URL).
    cors_origins: str = "http://localhost:5173"
    # Optional regex for extra origins. Default allows the Vite dev server from a phone on a
    # private LAN. Override in production, e.g. https://dockproof.*\\.vercel\\.app
    cors_origin_regex: str = r"http://(127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+):5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
