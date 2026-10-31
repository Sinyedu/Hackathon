"""Compare local models on the voice assistant: PYTHONPATH=. python scripts/eval_assistant.py [model ...]

Runs against the live backend demo data. For each question it checks (a) required facts appear,
(b) no number outside the data is invented, (c) no forbidden claim. Each question is asked REPEATS
times to measure consistency, not just correctness.
"""
import asyncio
import json
import re
import sys
import time
import urllib.request

from app.schemas.domain import Reconciliation
from app.schemas.recovery import RecoveryPlan
from app.services import assistant, ollama

API = "http://localhost:8000"
REPEATS = 2
# (question, focus, [regexes that must all match], [regexes that must not match])
CASES = [
    ("What is missing from this delivery?", None, [r"\b6\b|six", r"tomato"], [r"potato.*short"]),
    ("What is in the delivery note?", None, [r"\b18\b", r"potato", r"\b10\b", r"mozzarella", r"\b8\b"], []),
    ("What does the purchase order say?", None, [r"\b24\b", r"tomato", r"olive"], []),
    ("How many sacks of potatoes arrived?", None, [r"\b10\b"], [r"\b(11|12|9)\b"]),
    ("Which supplier do you recommend and why?", None, [r"FarmDirect", r"540"], [r"GreenSupply.*recommend"]),
    ("How much will the replacement cost?", None, [r"540"], []),
    ("Is the claim approved?", None, [r"draft|not (yet )?approved|not been approved"], [r"is approved"]),
    ("Explain this one.", "claim", [r"claim", r"draft"], []),
    ("Explain this.", "disc:P001", [r"\b6\b", r"\b24\b", r"\b18\b"], []),
    ("What is the weather in Copenhagen?", None, [r"cannot|can't|not|no "], [r"\b\d+\s*(degrees|°)"]),
    # Conversational phrasing, as real speech comes out of Whisper
    ("so what's the deal with the tomatoes", None, [r"\b6\b|six", r"short|missing|fewer"], []),
    ("are we good or is there a problem with this delivery", None, [r"problem|short|discrepan|not", r"\b6\b|six"], [r"no (problem|discrepanc)"]),
    ("how much more do I need to order", None, [r"\b6\b|six"], []),
    ("what's the cheapest way to fix it", None, [r"FarmDirect", r"540"], []),
    ("how fast can I get a replacement", None, [r"same day|0 day|2 day|\b2\b|GreenSupply|FarmDirect"], []),
    ("did the olive oil arrive", None, [r"yes|arrived|delivered|\b6\b", r"olive"], [r"short|missing"]),
    ("what's the total price of the claim", None, [r"cannot|can't|not|no "], []),
    ("tell me about the delivery note please", None, [r"\b18\b", r"mozzarella"], []),
]


def get(path: str, method: str = "GET") -> dict:
    req = urllib.request.Request(API + path, method=method)
    with urllib.request.urlopen(req, timeout=120) as res:
        return json.load(res)


async def main(models: list[str]) -> None:
    rid = get("/api/demo/missing-tomatoes", "POST")["id"]
    rec = Reconciliation.model_validate(get(f"/api/reconciliations/{rid}"))
    plan = RecoveryPlan.model_validate(get(f"/api/reconciliations/{rid}/discrepancies/P001/recover", "POST"))
    cards = assistant.build_cards(rec, [plan])
    print(f"cards: {[c.id for c in cards]}")
    for model in models:
        ok = bad_numbers = total = 0
        failures: list[str] = []
        started = time.time()
        for question, focus, must, must_not in CASES:
            target = assistant.route_card(question, cards, rec, focus)
            card = next((c for c in cards if c.id == target), None)
            data = json.dumps(assistant.build_context(rec, [plan], card), ensure_ascii=False)
            user = f"DATA:\n{data}\n\nQUESTION: {json.dumps(question)}"
            for _ in range(REPEATS):
                reply = assistant.clean_answer(await ollama.chat(
                    [{"role": "system", "content": assistant.SYSTEM_PROMPT}, {"role": "user", "content": user}],
                    timeout=180, model=model))
                total += 1
                grounded = assistant.numbers_grounded(reply, data, question)
                good = grounded and all(re.search(p, reply, re.I | re.S) for p in must) \
                    and not any(re.search(p, reply, re.I | re.S) for p in must_not)
                ok += good
                bad_numbers += not grounded
                if not good:
                    failures.append(f"  [{'INVENTED NUMBER' if not grounded else 'fact'}] {question!r} -> {reply[:160]!r}")
        print(f"\n{model}: {ok}/{total} correct, {bad_numbers} replies with invented numbers, {(time.time()-started)/total:.1f}s/answer")
        print("\n".join(failures[:8]))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or ["qwen3:1.7b"]))
