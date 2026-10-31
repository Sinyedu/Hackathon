from fastapi.testclient import TestClient

from app.core.db import init_db
from app.main import app

client = TestClient(app)


def test_contract_routes_registered() -> None:
    paths = client.get("/openapi.json").json()["paths"]
    assert "/api/reconciliations" in paths
    assert "/api/reconciliations/{reconciliation_id}" in paths
    assert "/api/reconciliations/{reconciliation_id}/approve" in paths


def test_unimplemented_routes_say_so() -> None:
    assert client.get("/api/reconciliations/abc").status_code == 501


def test_init_db(db) -> None:
    init_db()
    assert db.exists()
