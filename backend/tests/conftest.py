import pytest

from app.core.config import get_settings


@pytest.fixture
def db(tmp_path, monkeypatch):
    """Isolated SQLite file per test."""
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    get_settings.cache_clear()
    yield tmp_path / "test.db"
    get_settings.cache_clear()
