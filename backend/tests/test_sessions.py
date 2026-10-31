from helpers import FIXTURES, model_says_correct


def test_session_pair_upload_and_question(client, monkeypatch) -> None:
    model_says_correct(monkeypatch)
    session = client.post("/api/session").json()
    sid = session["id"]
    assert client.post(f"/api/session/{sid}/join").status_code == 200
    files = {"purchase_order": ("po.png", (FIXTURES / "purchase_order.png").read_bytes(), "image/png"),
             "delivery_note": ("dn.png", (FIXTURES / "delivery_note.png").read_bytes(), "image/png")}
    response = client.post(f"/api/session/{sid}/upload", files=files)
    assert response.status_code == 200
    state = response.json()
    assert state["reconciliation_id"]
    assert any(event["type"] == "extracted" for event in state["events"])
    questions = [event for event in state["events"] if event["type"] == "question"]
    assert questions
    question = questions[0]["data"]
    answer = client.post(f"/api/session/{sid}/answer", json={**question, "yes": True})
    assert answer.status_code == 200
    assert any(event["type"] == "answered" for event in answer.json()["events"])
    assert client.get(f"/api/session/{sid}").json()["reconciliation_id"] == state["reconciliation_id"]


def test_waits_for_both_documents(client) -> None:
    sid = client.post("/api/session").json()["id"]
    response = client.post(f"/api/session/{sid}/upload", files={"purchase_order":
        ("po.png", (FIXTURES / "purchase_order.png").read_bytes(), "image/png")})
    assert response.status_code == 200
    assert response.json()["reconciliation_id"] is None
    assert response.json()["events"][-1]["data"]["waiting_for"] == "delivery_note"


def test_count_replaces_note_quantity_and_updates_draft(client, monkeypatch) -> None:
    model_says_correct(monkeypatch)
    sid = client.post("/api/session").json()["id"]
    files = {"purchase_order": ("po.png", (FIXTURES / "purchase_order.png").read_bytes(), "image/png"),
             "delivery_note": ("dn.png", (FIXTURES / "delivery_note.png").read_bytes(), "image/png")}
    state = client.post(f"/api/session/{sid}/upload", files=files).json()
    for question in [e["data"] for e in state["events"] if e["type"] == "question"]:
        answer = client.post(f"/api/session/{sid}/answer", json={**question, "yes": True})
        assert answer.status_code == 200
    rec = client.get(f"/api/reconciliations/{state['reconciliation_id']}").json()
    line = next(line for line in rec["line_items"] if "delivery_note" in line["source_document_id"] and "Tomato" in line["description"])
    updated = client.post(f"/api/session/{sid}/count", json={"line_id": line["id"], "counted": "16"})
    assert updated.status_code == 200
    row = next(row for row in updated.json()["verdict"] if row["catalog_item_id"] == "P001")
    assert row["received"] == "16" and row["shortage"] == "8"
    rec = client.get(f"/api/reconciliations/{state['reconciliation_id']}").json()
    assert rec["claim"]["status"] == "draft"
    assert next(d for d in rec["discrepancies"] if d["catalog_item_id"] == "P001")["delivered_quantity"] == "16"


def test_agent_imports_files_by_name(client, monkeypatch, tmp_path) -> None:
    model_says_correct(monkeypatch)
    monkeypatch.setenv("DOCKPROOF_FILES_DIR", str(tmp_path))
    (tmp_path / "PO-4501 purchase order.png").write_bytes((FIXTURES / "purchase_order.png").read_bytes())
    (tmp_path / "delivery_note.png").write_bytes((FIXTURES / "delivery_note.png").read_bytes())
    (tmp_path / "notes.txt").write_text("not a document")
    sid = client.post("/api/session").json()["id"]

    listing = client.get(f"/api/session/{sid}/files").json()["files"]
    assert [(f["name"], f["kind"]) for f in listing] == [("delivery_note.png", "delivery_note"),
                                                          ("PO-4501 purchase order.png", "purchase_order")]

    first = client.post(f"/api/session/{sid}/import", json={"filename": "PO-4501 purchase order.png"})
    assert first.status_code == 200 and first.json()["reconciliation_id"] is None
    second = client.post(f"/api/session/{sid}/import", json={"filename": "delivery_note.png"})
    assert second.status_code == 200 and second.json()["reconciliation_id"]


def test_import_rejects_unlisted_and_unclassified_files(client, monkeypatch, tmp_path) -> None:
    monkeypatch.setenv("DOCKPROOF_FILES_DIR", str(tmp_path))
    (tmp_path / "scan.png").write_bytes(b"\x89PNG")
    sid = client.post("/api/session").json()["id"]
    for name in ["../backend/app/main.py", "missing_delivery_note.png"]:
        assert client.post(f"/api/session/{sid}/import", json={"filename": name, "kind": "delivery_note"}).status_code == 404
    assert client.post(f"/api/session/{sid}/import", json={"filename": "scan.png"}).status_code == 422
