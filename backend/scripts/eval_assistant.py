"""Compare local models on the voice assistant: PYTHONPATH=. python scripts/eval_assistant.py [model[+think] ...]

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
REPEATS = 1
# (question, focus, [regexes that must all match], [regexes that must not match])
REC = "Which supplier do you recommend and why?"
H_SUP = [{"role": "user", "content": REC}, {"role": "assistant", "content": "FarmDirect: 3 times 10 kg for 540.00 DKK, in 2 days. It is the cheapest complete option."}]
H_MISS = [{"role": "user", "content": "What is missing?"}, {"role": "assistant", "content": "Tomatoes, case 5 kg: ordered 24 case, delivered 18 case, short by 6 case."}]
H_DN = [{"role": "user", "content": "What is in the delivery note?"}, {"role": "assistant", "content": "Tomatoes 18 box, Potatoes 10 sack, Olive oil 6 tin, Mozzarella 8 block."}]
# (question, focus, history, [must match], [must not match])
CASES = [
    ("What is missing from this delivery?", None, [], [r"\b6\b|six", r"tomato"], [r"potato.*short"]),
    ("What is in the delivery note?", None, [], [r"\b18\b", r"potato", r"\b10\b", r"mozzarella", r"\b8\b"], []),
    ("How many sacks of potatoes arrived?", None, [], [r"\b10\b"], [r"\b(11|12|9)\b"]),
    (REC, None, [], [r"FarmDirect", r"540"], [r"GreenSupply.*recommend"]),
    ("Is the claim approved?", None, [], [r"draft|not (yet )?approved|not been approved"], [r"is approved"]),
    ("What is the weather in Copenhagen?", None, [], [r"cannot|can't|not|no "], [r"\b\d+\s*(degrees|°)"]),
    # Conversational / needs inference
    ("so what's the deal with the tomatoes", None, [], [r"\b6\b|six", r"short|missing|fewer"], []),
    ("Should I be worried about this delivery?", None, [], [r"\b6\b|six|short|tomato"], [r"no (need|reason)|not worried|nothing to worry"]),
    ("Why does the screen say I'm short?", None, [], [r"\b24\b", r"\b18\b"], []),
    ("I think they forgot some tomatoes, right?", None, [], [r"yes|right|correct|short|\b6\b|six"], [r"no, "]),
    ("Did the supplier ship the full order?", None, [], [r"no|not|short|\b6\b|six"], [r"\byes\b"]),
    ("Are the potatoes okay?", None, [], [r"\b10\b|match|fine|ok|no (issue|problem|discrepanc)"], [r"potatoes?[^.]*short"]),
    ("What should I do next?", None, [], [r"replac|claim|review|approve|supplier"], []),
    ("What can you do?", None, [], [r"replac|claim|explain|walk|document|scan"], []),
    ("Which is the cheapest and which is the fastest supplier?", None, [], [r"FarmDirect", r"GreenSupply"], []),
    # Follow-ups that only make sense with the conversation so far
    ("and how long does it take?", None, H_SUP, [r"\b2\b|two"], []),
    ("ok and why that one?", None, H_SUP, [r"cheap|lowest|cost|price|540"], []),
    ("and the potatoes?", None, H_MISS, [r"\b10\b"], [r"potatoes?[^.]*short"]),
    ("what about the purchase order?", None, H_DN, [r"\b24\b"], []),
    ("how much is that again?", None, H_SUP, [r"540"], []),
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
    for spec in models:
        model, _, flag = spec.partition("+")
        think = flag == "think"
        ok = bad_numbers = total = 0
        failures: list[str] = []
        started = time.time()
        history_cases = [c for c in CASES if c[2]]
        for question, focus, history, must, must_not in CASES:
            turns = [assistant.Turn(**h) for h in history]
            ctx = assistant.prepare(rec, [plan], question, focus, turns)
            for _ in range(REPEATS):
                reply = assistant.clean_answer(await ollama.chat(ctx.messages, timeout=240, model=model, think=think))
                total += 1
                grounded = assistant.numbers_grounded(reply, ctx.allowed)
                good = grounded and all(re.search(p, reply, re.I | re.S) for p in must) \
                    and not any(re.search(p, reply, re.I | re.S) for p in must_not)
                ok += good
                bad_numbers += not grounded
                if not good:
                    failures.append(f"  [{'INVENTED NUMBER' if not grounded else 'wrong/missing'}] {question!r}{' (follow-up)' if history else ''} -> {reply[:170]!r}")
        print(f"\n{spec}: {ok}/{total} correct, {bad_numbers} invented-number replies, {(time.time()-started)/total:.1f}s/answer")
        print("\n".join(failures[:10]))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1:] or ["qwen3:1.7b"]))
