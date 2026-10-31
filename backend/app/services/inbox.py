"""Poll generated document pairs and hand them to the same pipeline as uploads."""

import asyncio
from pathlib import Path

from app.schemas.domain import DocumentKind
from app.services import pipeline, store

ROOT = Path(__file__).resolve().parents[3]
INBOX = ROOT / "dock-inbox"


async def watch() -> None:
    from app.api.sessions import _event, process_pair

    seen: set[str] = set()
    INBOX.mkdir(exist_ok=True)
    while True:
        for note in sorted(INBOX.glob("*_dn.png")):
            stem = note.name.removesuffix("_dn.png")
            po = INBOX / f"{stem}_po.png"
            if stem in seen or not po.exists():
                continue
            seen.add(stem)
            session_id, _, delivery_id = stem.partition("_")
            session = store.state.sessions.get(session_id)
            if not session:
                continue
            session["reconciliation_id"] = None
            session["counts"] = {}
            session["verdict"] = []
            session["delivery_id"] = delivery_id
            _event(session, "delivery_received", {"delivery_id": delivery_id})
            try:
                await process_pair(session,
                    pipeline.Upload(DocumentKind.PURCHASE_ORDER, po.name, po.read_bytes()),
                    pipeline.Upload(DocumentKind.DELIVERY_NOTE, note.name, note.read_bytes()))
            except Exception as exc:
                _event(session, "failed", {"detail": str(exc)})
        await asyncio.sleep(1)
