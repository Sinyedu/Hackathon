"""Go/no-go check: run fixtures/match_pairs.json through the real matching pipeline + live Ollama.

Usage (backend/): python scripts/eval_matching.py
Pass = correct ID, or a safe rejection (unmatched / needs_review) for expected=null.
Fail = wrong ID accepted as 'matched', or any invented ID.
"""

import asyncio
import json
from decimal import Decimal
from pathlib import Path

from app.schemas.domain import CatalogItem, LineItem, MatchStatus
from app.services.match import match_line

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"


async def main() -> None:
    catalog = [CatalogItem(**c) for c in json.loads((FIXTURES / "catalog.json").read_text())]
    pairs = json.loads((FIXTURES / "match_pairs.json").read_text())
    known = {c.id for c in catalog}
    passed = 0
    for i, pair in enumerate(pairs):
        item = LineItem(id=f"L{i}", source_document_id="eval", source_text=pair["incoming"],
                        description=pair["incoming"], quantity=Decimal(1), unit=pair["unit"])
        m = await match_line(item, catalog)
        invented = m.catalog_item_id is not None and m.catalog_item_id not in known
        if pair["expected"] is None:
            ok = m.status != MatchStatus.MATCHED and not invented
        else:
            ok = (m.status == MatchStatus.MATCHED and m.catalog_item_id == pair["expected"]) or (
                m.status == MatchStatus.NEEDS_REVIEW and not invented
            )
        passed += ok
        print(f"{'PASS' if ok else 'FAIL'}  {pair['incoming']!r:50} -> {m.catalog_item_id} "
              f"{m.status.value}/{m.method.value} (expected {pair['expected']})")
    print(f"\n{passed}/{len(pairs)} passed")


asyncio.run(main())
