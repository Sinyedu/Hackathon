import pytest

from app.services import speech
from app.services.store import state


@pytest.fixture(autouse=True)
def no_speech_warmup(monkeypatch):
    """App startup warms Whisper in a background thread; tests must not download or load that model."""
    monkeypatch.setattr(speech, "warm", lambda: None)


@pytest.fixture
def db():
    """Clear process-local state between tests."""
    state.reconciliations.clear()
    state.audit_log.clear()
    state.sessions.clear()
    state.uploads.clear()
    state.suppliers.clear()
    state.supplier_products.clear()
    state.recovery_plans.clear()
    state.replacement_orders.clear()
    yield state
    state.reconciliations.clear()
    state.audit_log.clear()
    state.sessions.clear()
    state.uploads.clear()
    state.suppliers.clear()
    state.supplier_products.clear()
    state.recovery_plans.clear()
    state.replacement_orders.clear()


@pytest.fixture
def client(db):
    from fastapi.testclient import TestClient

    from app.main import app

    yield TestClient(app)
@pytest.fixture
def seeded(client):
    """Client whose process-local state holds synthetic suppliers."""
    from app.services.suppliers import seed_suppliers

    seed_suppliers()
    return client
