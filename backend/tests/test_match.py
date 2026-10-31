import asyncio
from decimal import Decimal

import pytest

from app.schemas.domain import CatalogItem, LineItem, MatchStatus
from app.services import match, ollama

CATALOG = [
    CatalogItem(id="P001", description="Tomatoes, case 5 kg", unit="case"),
    CatalogItem(id="P002", description="Potatoes, sack 10 kg", unit="sack"),
    CatalogItem(id="P003", description="Olive oil extra virgin, 5 L tin", unit="tin"),
]


def item(description: str, unit: str = "case") -> LineItem:
    return LineItem(id="L1", source_document_id="d", source_text=description,
                    description=description, quantity=Decimal(1), unit=unit)


def fake_chat(reply: str | Exception):
    async def chat(*args, **kwargs):
        if isinstance(reply, Exception):
            raise reply
        return reply
    return chat


def run(line: LineItem):
    return asyncio.run(match.match_line(line, CATALOG))


def test_different_names_match_same_product_without_model(monkeypatch) -> None:
    monkeypatch.setattr(ollama, "chat", fake_chat(RuntimeError("model must not be called")))
    m = run(item("Tomato Box 5KG", "box"))
    assert (m.catalog_item_id, m.status, m.method.value) == ("P001", MatchStatus.MATCHED, "exact")


def test_unit_mismatch_needs_review_not_converted(monkeypatch) -> None:
    monkeypatch.setattr(ollama, "chat", fake_chat(RuntimeError("unused")))
    m = run(item("Tomatoes, case 5 kg", "kg"))
    assert m.status == MatchStatus.NEEDS_REVIEW


def test_model_pick_is_accepted_when_valid(monkeypatch) -> None:
    monkeypatch.setattr(ollama, "chat", fake_chat('{"candidate_id":"P003","reason":"oil","needs_review":false}'))
    m = run(item("EVOO 5 litre", "tin"))
    assert (m.catalog_item_id, m.status) == ("P003", MatchStatus.MATCHED)


def test_unknown_model_id_is_rejected(monkeypatch) -> None:
    monkeypatch.setattr(ollama, "chat", fake_chat('{"candidate_id":"P999","reason":"x","needs_review":false}'))
    m = run(item("EVOO 5 litre", "tin"))
    assert m.catalog_item_id is None and m.status == MatchStatus.NEEDS_REVIEW


def test_invalid_json_needs_review(monkeypatch) -> None:
    monkeypatch.setattr(ollama, "chat", fake_chat("not json"))
    assert run(item("EVOO 5 litre", "tin")).status == MatchStatus.NEEDS_REVIEW


def test_ollama_outage_needs_review(monkeypatch) -> None:
    monkeypatch.setattr(ollama, "chat", fake_chat(ollama.OllamaError("down")))
    m = run(item("EVOO 5 litre", "tin"))
    assert m.catalog_item_id is None and m.status == MatchStatus.NEEDS_REVIEW


def test_model_null_is_unmatched(monkeypatch) -> None:
    monkeypatch.setattr(ollama, "chat", fake_chat('{"candidate_id":null,"reason":"none","needs_review":false}'))
    assert run(item("Salmon fillet 3kg", "box")).status == MatchStatus.UNMATCHED


def test_model_unsure_needs_review(monkeypatch) -> None:
    monkeypatch.setattr(ollama, "chat", fake_chat('{"candidate_id":"P003","reason":"maybe","needs_review":true}'))
    assert run(item("EVOO 5 litre", "tin")).status == MatchStatus.NEEDS_REVIEW
