import json
from decimal import Decimal
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services import ollama

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"


@pytest.fixture
def client(db, tmp_path, monkeypatch):
    monkeypatch.setenv("UPLOADS_DIR", str(tmp_path / "uploads"))
    from app.core.config import get_settings
    get_settings.cache_clear()
    yield TestClient(app)
    get_settings.cache_clear()


def model_says_correct(monkeypatch) -> None:
    async def chat(messages, **kwargs):
        user = messages[1]["content"]
        return json.dumps({"candidate_id": "P002" if "Pomme" in user else "P003",
                           "reason": "test", "needs_review": False})
    monkeypatch.setattr(ollama, "chat", chat)


def model_down(monkeypatch) -> None:
    async def chat(*args, **kwargs):
        raise ollama.OllamaError("down")
    monkeypatch.setattr(ollama, "chat", chat)


def upload(client, **extra):
    files = {"purchase_order": ("po.png", (FIXTURES / "purchase_order.png").read_bytes(), "image/png"),
             "delivery_note": ("dn.png", (FIXTURES / "delivery_note.png").read_bytes(), "image/png")}
    files.update(extra)
    return client.post("/api/reconciliations", files=files)


def test_full_flow_scan_to_persisted_approval(client, monkeypatch) -> None:
    model_says_correct(monkeypatch)
    res = upload(client)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ready" and body["warnings"] == []
    [d] = body["discrepancies"]
    assert (d["description"], Decimal(d["difference"])) == ("Tomatoes, case 5 kg", Decimal(-6))
    assert body["claim"]["status"] == "draft"

    rid = body["id"]
    assert client.get(f"/api/reconciliations/{rid}").json()["claim"]["status"] == "draft"
    approved = client.post(f"/api/reconciliations/{rid}/approve")
    assert approved.status_code == 200 and approved.json()["claim"]["status"] == "approved"
    assert client.get(f"/api/reconciliations/{rid}").json()["status"] == "approved"
    assert client.post(f"/api/reconciliations/{rid}/approve").status_code == 409


def test_model_outage_requires_review_and_blocks_approval(client, monkeypatch) -> None:
    model_down(monkeypatch)
    body = upload(client).json()
    assert body["status"] == "needs_review"
    assert any(m["status"] == "needs_review" for m in body["matches"])
    assert any("not confirmed" in w for w in body["warnings"])
    assert client.post(f"/api/reconciliations/{body['id']}/approve").status_code == 409


def test_original_scan_is_served(client, monkeypatch) -> None:
    model_says_correct(monkeypatch)
    body = upload(client).json()
    doc = body["documents"][1]
    res = client.get(f"/api/reconciliations/{body['id']}/documents/{doc['id']}/file")
    assert res.status_code == 200 and res.headers["content-type"] == "image/png"
    assert res.content == (FIXTURES / "delivery_note.png").read_bytes()
    assert client.get(f"/api/reconciliations/{body['id']}/documents/..%2F..%2Fx/file").status_code == 404


def test_invoice_is_stored_but_flagged_not_reconciled(client, monkeypatch) -> None:
    model_says_correct(monkeypatch)
    inv = ("inv.png", (FIXTURES / "delivery_note.png").read_bytes(), "image/png")
    body = upload(client, invoice=inv).json()
    assert any("Invoice" in w for w in body["warnings"])
    assert body["documents"][-1]["status"] == "not_reconciled"


def test_unreadable_file_is_422_and_nothing_persisted(client, monkeypatch) -> None:
    model_says_correct(monkeypatch)
    res = upload(client, delivery_note=("dn.txt", b"hello", "text/plain"))
    assert res.status_code == 422


def test_empty_and_oversized_uploads_rejected(client) -> None:
    assert upload(client, delivery_note=("dn.png", b"", "image/png")).status_code == 422
    big = b"0" * (10 * 1024 * 1024 + 1)
    assert upload(client, delivery_note=("dn.png", big, "image/png")).status_code == 413


def test_unknown_reconciliation_is_404(client) -> None:
    assert client.get("/api/reconciliations/nope").status_code == 404
    assert client.post("/api/reconciliations/nope/approve").status_code == 404
