import pytest

from app.services.store import state


@pytest.fixture
def db():
    """Clear process-local state between tests."""
    state.reconciliations.clear()
    state.audit_log.clear()
    state.sessions.clear()
    state.uploads.clear()
    yield state
    state.reconciliations.clear()
    state.audit_log.clear()
    state.sessions.clear()
    state.uploads.clear()


@pytest.fixture
def client(db):
    from fastapi.testclient import TestClient

    from app.main import app

    yield TestClient(app)
