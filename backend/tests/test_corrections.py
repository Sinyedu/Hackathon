from decimal import Decimal

from helpers import model_down, model_says_correct, upload

from app.services import store


def line_id(body: dict, doc_kind: str, n: int) -> str:
    return next(d["id"] for d in body["documents"] if d["kind"] == doc_kind) + f"-L{n}"


def post(client, rid: str, payload: dict):
    return client.post(f"/api/reconciliations/{rid}/corrections", json=payload)


def test_manual_match_resolves_model_outage_and_unblocks_approval(client, monkeypatch) -> None:
    model_down(monkeypatch)
    body = upload(client).json()
    assert body["status"] == "needs_review"
    dn = lambda n: line_id(body, "delivery_note", n)  # noqa: E731
    res = post(client, body["id"], {"matches": [
        {"line_id": dn(2), "catalog_item_id": "P002"}, {"line_id": dn(3), "catalog_item_id": "P003"}]})
    assert res.status_code == 200
    fixed = res.json()
    assert fixed["status"] == "ready" and fixed["warnings"] == []
    assert {m["method"] for m in fixed["matches"] if m["source_line_id"] in (dn(2), dn(3))} == {"manual"}
    assert fixed["claim"]["id"] == body["claim"]["id"]  # draft claim kept, not duplicated
    assert client.post(f"/api/reconciliations/{body['id']}/approve").status_code == 200


def test_ocr_digit_fix_updates_discrepancy_and_keeps_claim_id(client, monkeypatch) -> None:
    model_says_correct(monkeypatch)
    body = upload(client).json()
    tomato = line_id(body, "delivery_note", 1)
    fixed = post(client, body["id"], {"lines": [{"line_id": tomato, "quantity": "20"}]}).json()
    assert Decimal(fixed["discrepancies"][0]["difference"]) == Decimal(-4)
    assert fixed["claim"]["id"] == body["claim"]["id"]
    assert fixed["claim"]["discrepancies"][0]["delivered_quantity"] == "20"
    edited = next(l for l in fixed["line_items"] if l["id"] == tomato)
    assert edited["corrected"] is True and edited["source_text"] == "Tomato Box 5KG 18 box"
    assert any("user-corrected" in e for e in fixed["discrepancies"][0]["evidence"])


def test_correction_that_removes_the_shortage_removes_the_draft_claim(client, monkeypatch) -> None:
    model_says_correct(monkeypatch)
    body = upload(client).json()
    fixed = post(client, body["id"], {"lines": [
        {"line_id": line_id(body, "delivery_note", 1), "quantity": "24"}]}).json()
    assert fixed["discrepancies"] == [] and fixed["claim"] is None and fixed["status"] == "ready"
    assert client.get(f"/api/reconciliations/{body['id']}").json()["claim"] is None


def test_editing_description_rematches_the_line(client, monkeypatch) -> None:
    model_down(monkeypatch)
    body = upload(client).json()
    potatoes = line_id(body, "delivery_note", 2)
    res = post(client, body["id"], {"lines": [{"line_id": potatoes, "description": "Potatoes, sack 10 kg"}]}).json()
    match = next(m for m in res["matches"] if m["source_line_id"] == potatoes)
    assert (match["catalog_item_id"], match["status"], match["method"]) == ("P002", "matched", "exact")


def test_corrections_are_audited_with_original_values(client, monkeypatch) -> None:
    model_says_correct(monkeypatch)
    body = upload(client).json()
    post(client, body["id"], {"lines": [{"line_id": line_id(body, "delivery_note", 1), "quantity": "20"}]})
    events = dict(store.get_audit_log(body["id"]))
    assert '"quantity": "18"' in events["corrected"]


def test_cannot_correct_after_approval(client, monkeypatch) -> None:
    model_says_correct(monkeypatch)
    body = upload(client).json()
    client.post(f"/api/reconciliations/{body['id']}/approve")
    res = post(client, body["id"], {"lines": [{"line_id": line_id(body, "delivery_note", 1), "quantity": "24"}]})
    assert res.status_code == 409


def test_invalid_corrections_are_rejected_and_change_nothing(client, monkeypatch) -> None:
    model_says_correct(monkeypatch)
    body = upload(client).json()
    rid, tomato = body["id"], line_id(body, "delivery_note", 1)
    assert post(client, rid, {}).status_code == 422
    assert post(client, rid, {"lines": [{"line_id": "nope", "quantity": "1"}]}).status_code == 422
    assert post(client, rid, {"lines": [{"line_id": tomato, "quantity": "-3"}]}).status_code == 422
    assert post(client, rid, {"lines": [{"line_id": tomato}]}).status_code == 422
    assert post(client, rid, {"matches": [{"line_id": tomato, "catalog_item_id": "P999"}]}).status_code == 422
    assert post(client, rid, {"lines": [{"line_id": tomato, "quantity": "1"},
                                        {"line_id": tomato, "quantity": "2"}]}).status_code == 422
    assert client.get(f"/api/reconciliations/{rid}").json() == body


def test_unknown_reconciliation_is_404(client) -> None:
    assert post(client, "nope", {"lines": [{"line_id": "x", "quantity": "1"}]}).status_code == 404
