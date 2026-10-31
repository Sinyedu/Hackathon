import pytest

from app.core.config import get_settings


@pytest.fixture
def db(tmp_path, monkeypatch):
    """Isolated SQLite file per test."""
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    get_settings.cache_clear()
    yield tmp_path / "test.db"
    get_settings.cache_clear()


@pytest.fixture
def client(db, tmp_path, monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path / "uploads"))
    get_settings.cache_clear()
    yield TestClient(app)
    get_settings.cache_clear()
