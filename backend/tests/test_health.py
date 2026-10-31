import asyncio

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import ollama

client = TestClient(app)


def test_health() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"service": "DockProof API", "status": "ok"}


def test_cors_allows_frontend_origin() -> None:
    response = client.get("/api/health", headers={"Origin": "http://localhost:5173"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_ollama_unreachable_raises_ollama_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OLLAMA_BASE_URL", "http://127.0.0.1:1")
    from app.core.config import get_settings

    get_settings.cache_clear()
    with pytest.raises(ollama.OllamaError):
        asyncio.run(ollama.chat([{"role": "user", "content": "hi"}], timeout=2))
    get_settings.cache_clear()
