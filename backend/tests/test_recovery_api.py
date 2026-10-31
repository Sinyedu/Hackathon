from decimal import Decimal

from helpers import CHERRY_OK, model_down, model_router, upload

from app.services import store, suppliers
from app.schemas.recovery import SupplierProduct

ITEM = "P001"


def shortage(client, monkeypatch, compat=None) -> str:
    model_router(monkeypatch, compat)
    body = upload(client).json()
    assert body["status"] == "ready" and body["discrepancies"][0]["catalog_item_id"] == ITEM
    return body["id"]


def recover(client, rid, priority="cost"):
    return client.post(f"/api/reconciliations/{rid}/discrepancies/{ITEM}/recover?priority={priority}")


def option(plan, product_id):
    return next(o for o in plan["options"] if o["option_id"] == product_id)


def test_spec_scenario_options_and_costs(seeded, monkeypatch) -> None:
    rid = shortage(seeded, monkeypatch)
    res = recover(seeded, rid)
    assert res.status_code == 200
    plan = res.json()
    assert (Decimal(plan["missing_quantity"]), Decimal(plan["required_amount"]), plan["amount_unit"]) == (6, 30, "kg")
    assert (option(plan, "NF-TOM-5")["packages_needed"], option(plan, "NF-TOM-5")["total_cost"]) == (6, "570.00")
    assert (option(plan, "FD-TOM-10")["packages_needed"], option(plan, "FD-TOM-10")["total_cost"]) == (3, "540.00")
    assert option(plan, "GS-TOM-5")["total_cost"] == "612.00" and option(plan, "GS-TOM-5")["lead_time_days"] == 0
    assert plan["recommended_option_id"] == "FD-TOM-10"  # cheapest complete verified option
    assert plan["recommendation_summary"].startswith("Covers the full shortage")
    assert option(plan, "FD-TOM-10")["compatibility"] == "repack" and option(plan, "NF-TOM-5")["compatibility"] == "exact"


def test_incompatible_unavailable_and_partial_are_handled_honestly(seeded, monkeypatch) -> None:
    plan = recover(seeded, shortage(seeded, monkeypatch)).json()
    excluded = {e["description"]: e["reason"] for e in plan["excluded"]}
    assert excluded["Potatoes, 5 kg case"] == "Different product"
    assert "no conversion" in excluded["Tomatoes, tray of 24 pieces"]
    assert "unavailable" in excluded["Tomatoes, 5 kg case"]  # SlowCo, marked unavailable
    partial = option(plan, "BW-TOM-5")
    assert (partial["fulfills_shortage"], partial["packages_orderable"]) == (False, 4)
    assert plan["options"][-1]["option_id"] == "BW-TOM-5"
    assert all(o["option_id"] not in ("BF-POT-5", "SC-TOM-5") for o in plan["options"])


def test_cheapest_versus_fastest(seeded, monkeypatch) -> None:
    rid = shortage(seeded, monkeypatch)
    assert recover(seeded, rid, "cost").json()["recommended_option_id"] == "FD-TOM-10"
    fast = recover(seeded, rid, "speed").json()
    assert fast["recommended_option_id"] == "GS-TOM-5" and fast["priority"] == "speed"
    assert "fastest" in option(fast, "GS-TOM-5")["tags"] and "cheapest" in option(fast, "FD-TOM-10")["tags"]


def test_ai_substitute_is_flagged_and_needs_confirmation(seeded, monkeypatch) -> None:
    plan = recover(seeded, shortage(seeded, monkeypatch, CHERRY_OK)).json()
    cherry = option(plan, "NF-CHT-5")
    assert (cherry["compatibility"], cherry["verified"], cherry["requires_confirmation"]) == ("ai_substitute", False, True)
    assert cherry["ai_reason"] == "Cherry tomatoes can replace regular ones"
    assert plan["recommended_option_id"] != "NF-CHT-5"  # verified options outrank it
    assert not any(w for w in plan["warnings"] if "AI compatibility" in w)


def test_model_judging_incompatible_excludes_the_candidate(seeded, monkeypatch) -> None:
    plan = recover(seeded, shortage(seeded, monkeypatch, None)).json()
    assert all(o["option_id"] != "NF-CHT-5" for o in plan["options"])
    assert any("AI judged it incompatible" in e["reason"] for e in plan["excluded"])


def test_invalid_model_candidate_id_is_rejected_not_used(seeded, monkeypatch) -> None:
    bad = '{"candidate_id": "INVENTED", "classification": "equivalent", "reason": "x", "needs_review": false}'
    plan = recover(seeded, shortage(seeded, monkeypatch, bad)).json()
    assert all(o["option_id"] != "NF-CHT-5" for o in plan["options"])
    assert any("invalid model answer" in w for w in plan["warnings"])


def test_ollama_unavailable_still_returns_deterministic_options(seeded, monkeypatch) -> None:
    rid = shortage(seeded, monkeypatch)
    model_down(monkeypatch)
    plan = recover(seeded, rid).json()
    assert {o["option_id"] for o in plan["options"]} >= {"NF-TOM-5", "GS-TOM-5", "FD-TOM-10"}
    assert all(o["option_id"] != "NF-CHT-5" for o in plan["options"])
    assert any("model unavailable" in w for w in plan["warnings"])


def test_no_feasible_recovery_gives_a_clear_explanation(seeded, monkeypatch) -> None:
    rid = shortage(seeded, monkeypatch)
    store.state.supplier_products.clear()
    plan = recover(seeded, rid).json()
    assert plan["options"] == [] and plan["recommended_option_id"] is None
    assert any("No compatible supplier product" in w for w in plan["warnings"])
    assert seeded.post(f"/api/recovery-plans/{plan['id']}/draft-order", json={"option_id": "x"}).status_code == 422


def test_partial_only_plan_has_no_recommendation(seeded, monkeypatch) -> None:
    rid = shortage(seeded, monkeypatch)
    store.state.supplier_products = {key: value for key, value in store.state.supplier_products.items() if key == "BW-TOM-5"}
    plan = recover(seeded, rid).json()
    assert plan["recommended_option_id"] is None and any("No single supplier" in w for w in plan["warnings"])
    res = seeded.post(f"/api/recovery-plans/{plan['id']}/draft-order", json={"option_id": "BW-TOM-5"})
    assert res.status_code == 422 and "full shortage" in res.json()["detail"]


def test_draft_order_persistence_approval_and_refresh(seeded, monkeypatch) -> None:
    rid = shortage(seeded, monkeypatch)
    plan = recover(seeded, rid).json()
    order = seeded.post(f"/api/recovery-plans/{plan['id']}/draft-order", json={"option_id": "FD-TOM-10"}).json()
    assert (order["status"], order["packages"], order["total_estimated_cost"], order["lead_time_days"]) == ("draft", 3, "540.00", 2)
    assert order["original_description"] == "Tomatoes, case 5 kg" and order["reconciliation_id"] == rid
    assert order["warning"] and "repackaged" in order["warning"]
    stored = seeded.get(f"/api/reconciliations/{rid}/discrepancies/{ITEM}/recovery").json()
    assert [o["status"] for o in stored["orders"]] == ["draft"]
    approved = seeded.post(f"/api/replacement-orders/{order['id']}/approve").json()
    assert approved["status"] == "approved" and approved["decided_at"]
    refreshed = seeded.get(f"/api/reconciliations/{rid}/discrepancies/{ITEM}/recovery").json()
    assert refreshed["orders"][0]["status"] == "approved"
    again = recover(seeded, rid).json()  # refreshing the plan keeps its id and its orders
    assert again["id"] == plan["id"] and again["orders"][0]["status"] == "approved"


def test_duplicate_requests_do_not_create_duplicate_orders(seeded, monkeypatch) -> None:
    plan = recover(seeded, shortage(seeded, monkeypatch)).json()
    url = f"/api/recovery-plans/{plan['id']}/draft-order"
    first = seeded.post(url, json={"option_id": "NF-TOM-5"}).json()
    assert seeded.post(url, json={"option_id": "NF-TOM-5"}).json()["id"] == first["id"]
    other = seeded.post(url, json={"option_id": "GS-TOM-5"})
    assert other.status_code == 409 and "already has a draft order" in other.json()["detail"]
    assert len(store.state.replacement_orders) == 1


def test_rejecting_frees_the_plan_for_another_order(seeded, monkeypatch) -> None:
    plan = recover(seeded, shortage(seeded, monkeypatch)).json()
    url = f"/api/recovery-plans/{plan['id']}/draft-order"
    first = seeded.post(url, json={"option_id": "NF-TOM-5"}).json()
    assert seeded.post(f"/api/replacement-orders/{first['id']}/reject").json()["status"] == "rejected"
    second = seeded.post(url, json={"option_id": "GS-TOM-5"})
    assert second.status_code == 200 and second.json()["id"] != first["id"]


def test_state_transitions_are_one_way(seeded, monkeypatch) -> None:
    plan = recover(seeded, shortage(seeded, monkeypatch)).json()
    oid = seeded.post(f"/api/recovery-plans/{plan['id']}/draft-order", json={"option_id": "NF-TOM-5"}).json()["id"]
    assert seeded.post(f"/api/replacement-orders/{oid}/approve").status_code == 200
    assert seeded.post(f"/api/replacement-orders/{oid}/approve").status_code == 409
    assert seeded.post(f"/api/replacement-orders/{oid}/reject").status_code == 409
    assert seeded.post("/api/replacement-orders/nope/approve").status_code == 404


def test_ai_substitute_cannot_be_approved_without_explicit_confirmation(seeded, monkeypatch) -> None:
    plan = recover(seeded, shortage(seeded, monkeypatch, CHERRY_OK)).json()
    order = seeded.post(f"/api/recovery-plans/{plan['id']}/draft-order", json={"option_id": "NF-CHT-5"}).json()
    assert order["requires_confirmation"] and "Substitute product" in order["warning"]
    denied = seeded.post(f"/api/replacement-orders/{order['id']}/approve")
    assert denied.status_code == 422 and "explicit confirmation" in denied.json()["detail"]
    assert seeded.post(f"/api/replacement-orders/{order['id']}/approve", json={"confirm_substitution": False}).status_code == 422
    ok = seeded.post(f"/api/replacement-orders/{order['id']}/approve", json={"confirm_substitution": True}).json()
    assert ok["status"] == "approved" and ok["substitution_confirmed"] is True


def test_recovery_is_refused_for_non_shortages_and_unknown_ids(seeded, monkeypatch) -> None:
    rid = shortage(seeded, monkeypatch)
    assert seeded.post(f"/api/reconciliations/{rid}/discrepancies/P002/recover").status_code == 404  # not a discrepancy
    assert seeded.post(f"/api/reconciliations/nope/discrepancies/{ITEM}/recover").status_code == 404
    assert seeded.post(f"/api/reconciliations/{rid}/discrepancies/{ITEM}/recover?priority=cheap").status_code == 422
    assert seeded.get(f"/api/reconciliations/{rid}/discrepancies/{ITEM}/recovery").status_code == 404  # no plan yet
    assert seeded.post("/api/recovery-plans/nope/draft-order", json={"option_id": "x"}).status_code == 404


def test_suppliers_endpoint_and_idempotent_seed(seeded) -> None:
    names = [s["name"] for s in seeded.get("/api/suppliers").json()]
    assert "Nordic Fresh" in names and "GreenSupply" in names
    product = SupplierProduct.model_validate_json(store.state.supplier_products["NF-TOM-5"])
    product.unit_price = Decimal("999")
    store.state.supplier_products["NF-TOM-5"] = product.model_dump_json()
    assert suppliers.seed_suppliers() == 0  # existing rows are never overwritten
    nordic = next(s for s in seeded.get("/api/suppliers").json() if s["id"] == "nordic-fresh")
    assert next(p for p in nordic["products"] if p["id"] == "NF-TOM-5")["unit_price"] == "999"


def test_demo_scenario_runs_the_real_pipeline(seeded, monkeypatch) -> None:
    model_router(monkeypatch)
    rec = seeded.post("/api/demo/missing-tomatoes").json()
    assert rec["status"] == "ready" and rec["discrepancies"][0]["difference"] == "-6"
    assert any(d["filename"].startswith("demo_") for d in rec["documents"])
    assert recover(seeded, rec["id"]).json()["recommended_option_id"] == "FD-TOM-10"
