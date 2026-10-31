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
