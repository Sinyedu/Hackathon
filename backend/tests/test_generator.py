import asyncio
import json
import runpy
import time
from decimal import Decimal
from pathlib import Path

import pytest

from app.schemas.domain import DocumentKind
from app.services.extract import extract_line_items
from app.services.catalog import load_catalog
from app.services.match import match_line
from app.services.reconcile import compute_discrepancies
from helpers import model_down

GENERATOR = Path(__file__).resolve().parents[2] / "tools" / "generator.py"


def test_generated_scan_quantities_and_detection_rate_20_seeds(tmp_path: Path, monkeypatch) -> None:
    module = runpy.run_path(str(GENERATOR))
    generate = module["generate"]
    generate.__globals__["INBOX"] = tmp_path / "inbox"
    generate.__globals__["ANSWERS"] = tmp_path / "answers"
    model_down(monkeypatch)
    expected, detected = 0, 0
    for seed in range(20):
        persona = ["FreshField", "Nordic Greens", "Metro Wholesale"][seed % 3]
        chaos = ["shortage", "overstated"] if seed % 2 else ["shortage", "extra"]
        files = generate("testsession", persona, seed, chaos, seed % 5)
        key = json.loads((tmp_path / "answers" / f"{files['delivery_id']}.json").read_text())
        po = extract_line_items((tmp_path / "inbox" / files["purchase_order"]).read_bytes(),
                                document_id="po", kind=DocumentKind.PURCHASE_ORDER)
        note = extract_line_items((tmp_path / "inbox" / files["delivery_note"]).read_bytes(),
                                  document_id="note", kind=DocumentKind.DELIVERY_NOTE)
        assert len(po) == 5
        assert len(note) == len(key["note_quantities"])
        assert [item.quantity for item in po] == [Decimal(q) for q in key["ordered_quantities"]]
        assert [item.quantity for item in note] == [Decimal(q) for q in key["note_quantities"]]
        assert all(item.bbox is not None for item in po + note)
        lines = po + note
        catalog = load_catalog()
        matches = asyncio.run(_match_all(lines, catalog))
        result = compute_discrepancies(po, note, matches, catalog)
        for problem in key["problems"]:
            if problem["type"] not in {"shortage", "extra"}:
                continue  # physical overstatement needs a person's count
            expected += 1
            if any(d.catalog_item_id == problem["catalog_item_id"] and
                   ((d.difference < 0) if problem["type"] == "shortage" else (d.difference > 0))
                   for d in result.discrepancies):
                detected += 1
    print(f"Generator OCR: 40/40 documents, all line quantities correct. Observable problems detected: {detected}/{expected} with model unavailable.")
    assert detected == expected


async def _match_all(lines, catalog):
    return [await match_line(line, catalog) for line in lines]


def test_inbox_watcher_processes_generated_pair_and_reveal_reads_key(db, monkeypatch) -> None:
    from fastapi.testclient import TestClient
    from app.main import app
    from helpers import model_says_correct

    model_says_correct(monkeypatch)
    with TestClient(app) as client:
        sid = client.post("/api/session").json()["id"]
        generated = client.post(f"/api/session/{sid}/generate", json={
            "persona": "Nordic Greens", "seed": 314159,
            "chaos": ["shortage", "overstated"], "ugliness": 1,
        })
        assert generated.status_code == 200
        delivery_id = generated.json()["delivery_id"]
        assert client.get(f"/api/session/{sid}/generated/{delivery_id}/note").status_code == 200
        for _ in range(100):
            state = client.get(f"/api/session/{sid}").json()
            if state["reconciliation_id"]:
                break
            time.sleep(.2)
        else:
            pytest.fail("Inbox watcher did not process the generated documents")
        reveal = client.get(f"/api/session/{sid}/reveal")
        assert reveal.status_code == 200
        assert reveal.json()["comparison"][0]["type"] == "shortage"
        assert reveal.json()["comparison"][0]["found"] is True


def test_generated_pdf_pair_reads_without_ocr(tmp_path: Path) -> None:
    generate = runpy.run_path(str(GENERATOR))["generate"]
    generate.__globals__["INBOX"] = tmp_path / "inbox"
    generate.__globals__["ANSWERS"] = tmp_path / "answers"
    files = generate("testsession", "Nordic Greens", 3, ["shortage"], 0, "pdf")
    assert files["purchase_order"].endswith(".pdf") and files["delivery_note"].endswith(".pdf")
    key = json.loads((tmp_path / "answers" / f"{files['delivery_id']}.json").read_text())
    po = extract_line_items((tmp_path / "inbox" / files["purchase_order"]).read_bytes(),
                            document_id="po", kind=DocumentKind.PURCHASE_ORDER)
    note = extract_line_items((tmp_path / "inbox" / files["delivery_note"]).read_bytes(),
                              document_id="note", kind=DocumentKind.DELIVERY_NOTE)
    assert [i.quantity for i in po] == [Decimal(q) for q in key["ordered_quantities"]]
    assert [i.quantity for i in note] == [Decimal(q) for q in key["note_quantities"]]
    assert [i.unit_price for i in po] == [Decimal(p) for p in ("12.50", "9.20", "9.80", "8.40", "1.90")]
    assert all(i.unit_price is None for i in note)
