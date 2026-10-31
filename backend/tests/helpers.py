import json
from pathlib import Path

from app.services import ollama

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"


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


def model_router(monkeypatch, compat=None) -> None:
    """Mock Ollama for both prompts: product matching (answers correctly) and AutoRecover
    compatibility. `compat` is the raw reply (str), an Exception to raise, or None for 'incompatible'."""
    async def chat(messages, **kwargs):
        if "supplier product" in messages[0]["content"]:
            if isinstance(compat, Exception):
                raise compat
            if compat is None:
                return json.dumps({"candidate_id": None, "classification": "incompatible",
                                   "reason": "different", "needs_review": False})
            return compat
        user = messages[1]["content"]
        return json.dumps({"candidate_id": "P002" if "Pomme" in user else "P003",
                           "reason": "test", "needs_review": False})
    monkeypatch.setattr(ollama, "chat", chat)


CHERRY_OK = json.dumps({"candidate_id": "NF-CHT-5", "classification": "acceptable_substitute",
                        "reason": "Cherry tomatoes can replace regular ones", "needs_review": True})
