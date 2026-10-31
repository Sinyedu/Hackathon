import asyncio
import json

import pytest

from app.schemas.domain import CatalogItem
from app.services import compat, ollama
from test_recovery_engine import ORIGINAL, product

CHERRY = product(id="NF-CHT-5", description="Cherry tomatoes, 5 kg case")


def run(monkeypatch, reply):
    async def chat(*args, **kwargs):
        if isinstance(reply, Exception):
            raise reply
        return reply
    monkeypatch.setattr(ollama, "chat", chat)
    return asyncio.run(compat.assess_with_model(ORIGINAL, CHERRY))


def test_valid_answer_is_parsed(monkeypatch) -> None:
    r = run(monkeypatch, json.dumps({"candidate_id": "NF-CHT-5", "classification": "acceptable_substitute",
                                     "reason": "ok", "needs_review": True}))
    assert r.classification == "acceptable_substitute" and r.candidate_id == "NF-CHT-5"


def test_invented_candidate_id_is_rejected(monkeypatch) -> None:
    with pytest.raises(ValueError, match="unknown candidate id"):
        run(monkeypatch, json.dumps({"candidate_id": "HACK-1", "classification": "equivalent", "needs_review": False}))


def test_compatible_without_id_is_rejected(monkeypatch) -> None:
    with pytest.raises(ValueError):
        run(monkeypatch, json.dumps({"candidate_id": None, "classification": "equivalent"}))


@pytest.mark.parametrize("reply", ["not json", '{"candidate_id": "NF-CHT-5", "classification": "maybe"}', "{}"])
def test_invalid_json_or_enum_is_rejected(monkeypatch, reply) -> None:
    with pytest.raises(ValueError, match="invalid JSON"):
        run(monkeypatch, reply)


def test_outage_propagates_as_ollama_error(monkeypatch) -> None:
    with pytest.raises(ollama.OllamaError):
        run(monkeypatch, ollama.OllamaError("down"))


def test_prompt_contains_only_descriptions_and_the_candidate_id(monkeypatch) -> None:
    captured = {}

    async def chat(messages, **kwargs):
        captured["user"] = messages[1]["content"]
        return json.dumps({"candidate_id": None, "classification": "incompatible"})

    monkeypatch.setattr(ollama, "chat", chat)
    asyncio.run(compat.assess_with_model(CatalogItem(id="P", description="Tomatoes", unit="case"), CHERRY))
    assert "NF-CHT-5" in captured["user"] and "Cherry tomatoes" in captured["user"]
    assert "95" not in captured["user"] and "DKK" not in captured["user"]  # no prices sent to the model
