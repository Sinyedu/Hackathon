"""Live, process-local pairing around the existing reconciliation pipeline."""

import asyncio
import json
import socket
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.reconciliations import _read
from app.schemas.domain import Corrections, DocumentKind, MatchChoice, MatchStatus
from app.services import claims, corrections, pipeline, store
from app.services.extract import ExtractionError

router = APIRouter(prefix="/session", tags=["session"])


def _session(session_id: str) -> dict:
    session = store.state.sessions.get(session_id)
    if session is None:
        raise HTTPException(404, "Session not found")
    return session


def _event(session: dict, name: str, data: dict | None = None) -> None:
    session["events"].append({"id": len(session["events"]), "type": name,
                              "at": datetime.now(UTC).isoformat(), "data": data or {}})


@router.post("")
def create_session() -> dict:
    session_id = uuid.uuid4().hex[:12]
    session = {"id": session_id, "events": [], "aliases": {}, "rejected": [],
               "counts": {}, "signatures": {}, "claims": [], "deliveries": [],
               "purchase_order": None, "delivery_note": None, "reconciliation_id": None}
    store.state.sessions[session_id] = session
    return public_session(session)


def public_session(session: dict) -> dict:
    return {key: value for key, value in session.items() if key not in {"purchase_order", "delivery_note"}}


@router.get("/{session_id}")
def get_session(session_id: str) -> dict:
    return public_session(_session(session_id))


@router.get("/{session_id}/events")
async def events(session_id: str, after: int = -1) -> StreamingResponse:
    session = _session(session_id)

    async def stream():
        cursor = after + 1
        while True:
            records = session["events"]
            while cursor < len(records):
                event = records[cursor]
                yield f"id: {event['id']}\nevent: {event['type']}\ndata: {json.dumps(event)}\n\n"
                cursor += 1
            yield ": keepalive\n\n"
            await asyncio.sleep(1)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.post("/{session_id}/join")
def join(session_id: str) -> dict:
    session = _session(session_id)
    _event(session, "phone_connected")
    return public_session(session)


@router.post("/{session_id}/upload")
async def upload(session_id: str, purchase_order: UploadFile | None = None,
                 delivery_note: UploadFile | None = None) -> dict:
    session = _session(session_id)
    if purchase_order is not None and purchase_order.filename:
        session["purchase_order"] = await _read(purchase_order, DocumentKind.PURCHASE_ORDER)
    if delivery_note is not None and delivery_note.filename:
        session["delivery_note"] = await _read(delivery_note, DocumentKind.DELIVERY_NOTE)
    if not session["purchase_order"] or not session["delivery_note"]:
        _event(session, "delivery_received", {"waiting_for": "purchase_order" if not session["purchase_order"] else "delivery_note"})
        return public_session(session)
    _event(session, "reading")
    try:
        rec = await pipeline.run_reconciliation(session["purchase_order"], session["delivery_note"],
                                                aliases=session["aliases"], rejected=session["rejected"],
                                                require_model_review=True)
    except ExtractionError as exc:
        _event(session, "failed", {"detail": str(exc)})
        raise HTTPException(422, str(exc)) from exc
    session["reconciliation_id"] = rec.id
    session["deliveries"].append(rec.id)
    _event(session, "extracted", {"reconciliation_id": rec.id})
    questions = [m for m in rec.matches if m.status == MatchStatus.NEEDS_REVIEW and m.catalog_item_id]
    for match in questions:
        _event(session, "question", {"line_id": match.source_line_id, "catalog_item_id": match.catalog_item_id})
    _event(session, "verdict", {"reconciliation_id": rec.id, "status": rec.status})
    return public_session(session)


class Answer(BaseModel):
    line_id: str
    catalog_item_id: str
    yes: bool


@router.post("/{session_id}/answer")
async def answer(session_id: str, answer: Answer) -> dict:
    session = _session(session_id)
    rid = session["reconciliation_id"]
    rec = store.get_reconciliation(rid) if rid else None
    if rec is None:
        raise HTTPException(409, "No reconciliation to answer")
    match = next((m for m in rec.matches if m.source_line_id == answer.line_id), None)
    line = next((l for l in rec.line_items if l.id == answer.line_id), None)
    if match is None or line is None or match.catalog_item_id != answer.catalog_item_id or match.status != MatchStatus.NEEDS_REVIEW:
        raise HTTPException(409, "Question is no longer open")
    pair = [line.description, answer.catalog_item_id]
    if answer.yes:
        try:
            rec = await corrections.apply_corrections(rid, Corrections(matches=[MatchChoice(line_id=line.id, catalog_item_id=answer.catalog_item_id)]))
        except (corrections.CorrectionInvalid, corrections.CorrectionConflict) as exc:
            raise HTTPException(409, str(exc)) from exc
        session["aliases"][line.description] = answer.catalog_item_id
    else:
        session["rejected"].append(pair)
        rec = await corrections.apply_corrections(rid, Corrections(matches=[MatchChoice(line_id=line.id, catalog_item_id=None)]))
    _event(session, "answered", {"line_id": line.id, "yes": answer.yes, "status": rec.status})
    return public_session(session)


@router.post("/{session_id}/approve")
def approve(session_id: str) -> dict:
    session = _session(session_id)
    rid = session["reconciliation_id"]
    if not rid:
        raise HTTPException(409, "No reconciliation")
    try:
        claim = claims.approve_claim(rid)
    except claims.ClaimError as exc:
        raise HTTPException(409, str(exc)) from exc
    _event(session, "claim_approved", {"claim_id": claim.id})
    return public_session(session)


@router.post("/{session_id}/reset")
def reset(session_id: str) -> dict:
    session = _session(session_id)
    session.update({"aliases": {}, "rejected": [], "counts": {}, "signatures": {}, "claims": [],
                    "deliveries": [], "purchase_order": None, "delivery_note": None, "reconciliation_id": None})
    _event(session, "reset")
    return public_session(session)


@router.get("/{session_id}/lan-ip")
def lan_ip(session_id: str) -> dict:
    _session(session_id)
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as connection:
            connection.connect(("8.8.8.8", 80))
            ip = connection.getsockname()[0]
    except OSError:
        ip = "127.0.0.1"
    return {"ip": ip}
