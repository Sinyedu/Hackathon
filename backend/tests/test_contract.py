from fastapi.testclient import TestClient

from app.services import store
from app.main import app

client = TestClient(app)


def test_contract_routes_registered() -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/reconciliations" in paths
    assert "/api/reconciliations/{reconciliation_id}" in paths
    assert "/api/reconciliations/{reconciliation_id}/approve" in paths


def test_unknown_reconciliation_404(db) -> None:
    assert client.get("/api/reconciliations/abc").status_code == 404


def test_process_local_store(db) -> None:
    assert store.state.reconciliations == {}
    assert store.state.sessions == {}


def test_catalog_lists_known_products() -> None:
    items = client.get("/api/catalog").json()
    assert {"id": "P001", "description": "Tomatoes, case 5 kg", "unit": "case"} in items
