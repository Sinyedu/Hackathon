"""Live, process-local pairing around the existing reconciliation pipeline."""

import asyncio
import hashlib
import json
import runpy
import secrets
import socket
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from app.api.reconciliations import MAX_UPLOAD_BYTES, _read
from app.schemas.domain import Corrections, Discrepancy, DocumentKind, MatchChoice, MatchStatus
from app.services import claims, corrections, files, pipeline, store
from app.services.counting import calculate
from app.services.extract import ExtractionError, detect_kind
from app.services.match import normalize_unit

router = APIRouter(prefix="/session", tags=["session"])
ROOT = Path(__file__).resolve().parents[3]


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
               "purchase_order": None, "delivery_note": None, "reconciliation_id": None,
               "verdict": [], "generated": [], "delivery_id": None}
    store.state.sessions[session_id] = session
    return public_session(session)


def public_session(session: dict) -> dict:
    public = {key: value for key, value in session.items() if key not in {"purchase_order", "delivery_note"}}
    rec = store.get_reconciliation(session["reconciliation_id"]) if session["reconciliation_id"] else None
    public["claim_fingerprint"] = hashlib.sha256(rec.claim.model_dump_json().encode()).hexdigest() if rec and rec.claim else None
    return public


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
                 delivery_note: UploadFile | None = None, documents: list[UploadFile] | None = None) -> dict:
    """Named slots, or `documents` whose type is worked out from the scan itself.

    Photos are called IMG_0001.jpg, so the filename cannot say what they are. Order of evidence: a name that
    says so, the title printed on the document, then whichever slot is still empty. If none decides, 422.
    """
    session = _session(session_id)
    if purchase_order is not None and purchase_order.filename:
        session["purchase_order"] = await _read(purchase_order, DocumentKind.PURCHASE_ORDER)
    if delivery_note is not None and delivery_note.filename:
        session["delivery_note"] = await _read(delivery_note, DocumentKind.DELIVERY_NOTE)
    for file in [f for f in (documents or []) if f.filename]:
        kind = await _kind_of(file, session)
        session[kind.value] = await _read(file, kind)
    return await _process_when_paired(session)


async def _kind_of(file: UploadFile, session: dict) -> DocumentKind:
    guessed = files.guess_kind(file.filename or "")
    if guessed:
        return guessed
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    await file.seek(0)
    try:
        read = await run_in_threadpool(detect_kind, content)
    except ExtractionError as exc:
        raise HTTPException(422, str(exc)) from exc
    if read:
        return read
    empty = [k for k in (DocumentKind.PURCHASE_ORDER, DocumentKind.DELIVERY_NOTE) if not session[k.value]]
    if len(empty) == 1:
        return empty[0]
    raise HTTPException(422, f"I could not tell whether {file.filename} is the purchase order or the delivery note")


class ImportRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    kind: DocumentKind | None = None


@router.get("/{session_id}/files")
def list_importable(session_id: str) -> dict:
    _session(session_id)
    base = files.folder()
    shown = base.relative_to(ROOT) if base.is_relative_to(ROOT) else base
    return {"folder": str(shown), "files": files.list_files()}


@router.post("/{session_id}/import")
async def import_file(session_id: str, request: ImportRequest) -> dict:
    """Import a document from the local files folder by name (used by the voice agent)."""
    session = _session(session_id)
    kind = request.kind or files.guess_kind(request.filename)
    if kind not in (DocumentKind.PURCHASE_ORDER, DocumentKind.DELIVERY_NOTE):
        raise HTTPException(422, f"Say whether {request.filename} is the purchase order or the delivery note")
    try:
        content = files.read_file(request.filename)
    except KeyError as exc:
        raise HTTPException(404, f"No file named {request.filename} in the files folder") from exc
    except ValueError as exc:
        raise HTTPException(413, str(exc)) from exc
    session[kind.value] = pipeline.Upload(kind=kind, filename=request.filename, content=content)
    return await _process_when_paired(session)


async def _process_when_paired(session: dict) -> dict:
    if not session["purchase_order"] or not session["delivery_note"]:
        _event(session, "delivery_received", {"waiting_for": "purchase_order" if not session["purchase_order"] else "delivery_note"})
        return public_session(session)
    session["delivery_id"] = None
    return await process_pair(session, session["purchase_order"], session["delivery_note"])


async def process_pair(session: dict, po: pipeline.Upload, dn: pipeline.Upload) -> dict:
    _event(session, "reading")
    try:
        rec = await pipeline.run_reconciliation(po, dn,
                                                aliases=session["aliases"], rejected=session["rejected"],
                                                require_model_review=True)
    except ExtractionError as exc:
        _event(session, "failed", {"detail": str(exc)})
        raise HTTPException(422, str(exc)) from exc
    session["reconciliation_id"] = rec.id
    session["deliveries"].append(rec.id)
    _refresh_verdict(session)
    _event(session, "extracted", {"reconciliation_id": rec.id})
    questions = [m for m in rec.matches if m.status == MatchStatus.NEEDS_REVIEW and m.catalog_item_id]
    for match in questions:
        _event(session, "question", {"line_id": match.source_line_id, "catalog_item_id": match.catalog_item_id})
    _event(session, "verdict", {"reconciliation_id": rec.id, "status": rec.status,
                                 "delivery_id": session.get("delivery_id")})
    return public_session(session)


class Answer(BaseModel):
    line_id: str
    catalog_item_id: str
    yes: bool


class Resolve(BaseModel):
    line_id: str
    catalog_item_id: str | None  # None = "this product is not in the catalog"


class CountUpdate(BaseModel):
    line_id: str
    counted: Decimal | None = Field(default=None, ge=0)


class GenerateRequest(BaseModel):
    persona: str
    seed: int | None = None
    chaos: list[str] = Field(default_factory=list)
    ugliness: int = Field(default=0, ge=0, le=4)
    format: str = Field(default="pdf", pattern="^(pdf|png)$")


@router.post("/{session_id}/generate")
def generate_delivery(session_id: str, request: GenerateRequest) -> dict:
    session = _session(session_id)
    generate = runpy.run_path(str(ROOT / "tools" / "generator.py"))["generate"]
    try:
        generated = generate(session_id, request.persona,
                             request.seed if request.seed is not None else secrets.randbelow(1_000_000),
                             request.chaos, request.ugliness, request.format)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    session["generated"].append(generated)
    _event(session, "printed_to_dock", {"delivery_id": generated["delivery_id"]})
    return generated


@router.get("/{session_id}/generated/{delivery_id}/note")
def generated_preview(session_id: str, delivery_id: str) -> FileResponse:
    session = _session(session_id)
    generated = next((item for item in session["generated"] if item["delivery_id"] == delivery_id), None)
    if generated is None:
        raise HTTPException(404, "Generated delivery not found")
    name = generated["delivery_note"]
    return FileResponse(ROOT / "dock-inbox" / name, media_type="application/pdf" if name.endswith(".pdf") else "image/png")


@router.get("/{session_id}/reveal")
def reveal(session_id: str) -> dict:
    session = _session(session_id)
    delivery_id = session.get("delivery_id")
    if not delivery_id or not any(e["type"] == "verdict" and e["data"].get("delivery_id") == delivery_id for e in session["events"]):
        raise HTTPException(409, "Verdict is not ready")
    path = ROOT / "dock-answers" / f"{delivery_id}.json"
    if not path.exists():
        raise HTTPException(404, "Answer key not found")
    key = json.loads(path.read_text())
    rec = store.get_reconciliation(session["reconciliation_id"])
    if rec is None:
        raise HTTPException(409, "Reconciliation not found")
    comparison = []
    for problem in key["problems"]:
        item_id, kind, amount = problem["catalog_item_id"], problem["type"], problem["amount"]
        row = next((row for row in session["verdict"] if row["catalog_item_id"] == item_id), None)
        discrepancy = next((d for d in rec.discrepancies if d.catalog_item_id == item_id), None)
        if kind == "shortage":
            found = bool(discrepancy and discrepancy.difference < 0 and abs(discrepancy.difference) >= amount)
        elif kind == "overstated":
            found = bool(row and Decimal(row["note_overstated"]) >= amount)
        elif kind == "extra":
            found = bool(discrepancy and discrepancy.difference > 0)
        else:
            found = bool(discrepancy and discrepancy.difference < 0)
        comparison.append({**problem, "found": found})
    return {"delivery_id": delivery_id, "supplier": key["supplier"], "comparison": comparison}


def _refresh_verdict(session: dict) -> None:
    rid = session["reconciliation_id"]
    rec = store.get_reconciliation(rid) if rid else None
    if rec is None:
        return
    kind = {d.id: d.kind for d in rec.documents}
    matches = {m.source_line_id: m for m in rec.matches if m.status == MatchStatus.MATCHED and m.catalog_item_id}
    groups: dict[str, dict[str, list]] = {}
    for line in rec.line_items:
        match = matches.get(line.id)
        if not match:
            continue
        group = groups.setdefault(match.catalog_item_id, {"ordered": [], "noted": []})
        side = "ordered" if kind[line.source_document_id] == DocumentKind.PURCHASE_ORDER else "noted"
        group[side].append(line)
    rows = []
    discrepancies = []
    for item_id, group in groups.items():
        order_lines, note_lines = group["ordered"], group["noted"]
        if not order_lines and not note_lines:
            continue
        units = {normalize_unit(line.unit) for line in order_lines + note_lines}
        if len(units) != 1:
            continue
        ordered = sum((line.quantity for line in order_lines), Decimal(0))
        noted = sum((line.quantity for line in note_lines), Decimal(0))
        has_count = any(line.id in session["counts"] for line in note_lines)
        counted = sum((Decimal(session["counts"].get(line.id, str(line.quantity)))
                       for line in note_lines), Decimal(0)) if has_count else None
        prices = {line.unit_price for line in order_lines if line.unit_price is not None}
        amount = next(iter(prices)) * 100 if len(prices) == 1 else None
        cents = int(amount) if amount is not None and amount == amount.to_integral_value() else None
        verdict = calculate(ordered, noted, counted, cents)
        description = order_lines[0].description if order_lines else note_lines[0].description
        evidence = [f"{line.source_document_id}: {line.source_text}" for line in order_lines + note_lines]
        rows.append({"catalog_item_id": item_id, "description": description,
                     "unit": next(iter(units)), "line_ids": [line.id for line in note_lines],
                     **verdict.model_dump(mode="json")})
        if verdict.received != ordered:
            discrepancies.append(Discrepancy(catalog_item_id=item_id, description=description,
                unit=next(iter(units)), ordered_quantity=ordered, delivered_quantity=verdict.received,
                difference=verdict.received - ordered, evidence=evidence))
    session["verdict"] = rows
    with store.transaction() as conn:
        current = store.load(conn, rid)
        if current and current.status == "ready":
            current.discrepancies = discrepancies
            if discrepancies:
                if current.claim is None:
                    current.claim = claims.new_claim(discrepancies)
                else:
                    current.claim.discrepancies = discrepancies
            else:
                current.claim = None
            store.save(conn, current)


@router.post("/{session_id}/count")
def update_count(session_id: str, update: CountUpdate) -> dict:
    session = _session(session_id)
    rid = session["reconciliation_id"]
    rec = store.get_reconciliation(rid) if rid else None
    if rec is None or rec.status == "approved":
        raise HTTPException(409, "No editable reconciliation")
    line = next((line for line in rec.line_items if line.id == update.line_id and
                 any(d.id == line.source_document_id and d.kind == DocumentKind.DELIVERY_NOTE for d in rec.documents)), None)
    if line is None:
        raise HTTPException(404, "Delivery line not found")
    if not any(m.source_line_id == line.id and m.status == MatchStatus.MATCHED for m in rec.matches):
        raise HTTPException(409, "Confirm the product match before counting")
    if update.counted is None:
        session["counts"].pop(line.id, None)
    else:
        session["counts"][line.id] = str(update.counted)
    _refresh_verdict(session)
    _event(session, "count_updated", {"line_id": line.id, "counted": str(update.counted) if update.counted is not None else "skipped"})
    _event(session, "verdict", {"reconciliation_id": rid})
    return public_session(session)


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
    _refresh_verdict(session)
    return public_session(session)


@router.post("/{session_id}/resolve")
async def resolve(session_id: str, choice: Resolve) -> dict:
    """Manual review: the user names the product for a line the matcher could not settle."""
    session = _session(session_id)
    rid = session["reconciliation_id"]
    rec = store.get_reconciliation(rid) if rid else None
    if rec is None or rec.status == "approved":
        raise HTTPException(409, "No editable reconciliation")
    line = next((l for l in rec.line_items if l.id == choice.line_id), None)
    if line is None:
        raise HTTPException(404, "Line not found")
    try:
        rec = await corrections.apply_corrections(rid, Corrections(matches=[MatchChoice(line_id=line.id, catalog_item_id=choice.catalog_item_id)]))
    except (corrections.CorrectionInvalid, corrections.CorrectionConflict) as exc:
        raise HTTPException(409, str(exc)) from exc
    if choice.catalog_item_id:
        session["aliases"][line.description] = choice.catalog_item_id
    _event(session, "answered", {"line_id": line.id, "yes": bool(choice.catalog_item_id), "status": rec.status})
    _refresh_verdict(session)
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
                    "deliveries": [], "purchase_order": None, "delivery_note": None, "reconciliation_id": None,
                    "verdict": [], "generated": [], "delivery_id": None})
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
