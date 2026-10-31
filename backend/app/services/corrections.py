"""Owner: backend. User corrections of OCR digits / product matches, then re-reconciliation.

Only the user changes values here; the model never edits quantities. A correction is refused once
the claim is approved. Matching and reconciliation are recomputed from the corrected lines, a
draft claim is replaced (or removed if nothing is left to claim), and the change is audited.
"""

import json

from app.schemas.domain import (
    Corrections,
    DocumentKind,
    Match,
    MatchMethod,
    MatchStatus,
    Reconciliation,
)
from app.services import claims, store
from app.services.catalog import load_catalog
from app.services.match import match_line
from app.services.reconcile import compute_discrepancies


class CorrectionError(Exception):
    pass


class CorrectionNotFound(CorrectionError):
    pass


class CorrectionConflict(CorrectionError):
    pass


class CorrectionInvalid(CorrectionError):
    pass


async def apply_corrections(reconciliation_id: str, corrections: Corrections) -> Reconciliation:
    snapshot = store.get_reconciliation(reconciliation_id)
    if snapshot is None:
        raise CorrectionNotFound("Reconciliation not found")
    if snapshot.status == "approved":
        raise CorrectionConflict("Claim is already approved; it can no longer be changed")
    if not corrections.lines and not corrections.matches:
        raise CorrectionInvalid("No corrections supplied")

    catalog = load_catalog()
    catalog_ids = {c.id for c in catalog}
    lines = {line.id: line for line in snapshot.line_items}
    edited_text: set[str] = set()
    seen: set[str] = set()
    for edit in corrections.lines:
        if edit.line_id not in lines:
            raise CorrectionInvalid(f"Unknown line {edit.line_id}")
        if edit.line_id in seen:
            raise CorrectionInvalid(f"Line {edit.line_id} edited twice")
        seen.add(edit.line_id)
        update = {k: v for k, v in {
            "description": edit.description.strip() if edit.description else None,
            "quantity": edit.quantity,
            "unit": edit.unit.strip().lower() if edit.unit is not None else None,
        }.items() if v is not None}
        if not update:
            raise CorrectionInvalid(f"No changes for line {edit.line_id}")
        if update.get("description") and update["description"] != lines[edit.line_id].description:
            edited_text.add(edit.line_id)
        lines[edit.line_id] = lines[edit.line_id].model_copy(update={**update, "corrected": True})

    matches = {m.source_line_id: m for m in snapshot.matches}
    chosen: set[str] = set()
    for choice in corrections.matches:
        if choice.line_id not in lines:
            raise CorrectionInvalid(f"Unknown line {choice.line_id}")
        if choice.line_id in chosen:
            raise CorrectionInvalid(f"Line {choice.line_id} matched twice")
        if choice.catalog_item_id is not None and choice.catalog_item_id not in catalog_ids:
            raise CorrectionInvalid(f"Unknown catalog item {choice.catalog_item_id!r}")
        chosen.add(choice.line_id)
        matches[choice.line_id] = Match(
            source_line_id=choice.line_id, catalog_item_id=choice.catalog_item_id,
            method=MatchMethod.MANUAL,
            status=MatchStatus.MATCHED if choice.catalog_item_id else MatchStatus.UNMATCHED)
    for line_id in edited_text - chosen:  # description changed: the old match no longer applies
        matches[line_id] = await match_line(lines[line_id], catalog)

    kind_of = {d.id: d.kind for d in snapshot.documents}
    ordered = [l for l in lines.values() if kind_of[l.source_document_id] == DocumentKind.PURCHASE_ORDER]
    delivered = [l for l in lines.values() if kind_of[l.source_document_id] == DocumentKind.DELIVERY_NOTE]
    result = compute_discrepancies(ordered, delivered, list(matches.values()), catalog)
    warnings = list(result.warnings)
    if DocumentKind.INVOICE in kind_of.values():
        warnings.append("Invoice stored but not reconciled in this version")
    clean = not result.unresolved_line_ids and not result.warnings and all(
        matches[l.id].status == MatchStatus.MATCHED for l in lines.values())

    before = {l.id: l for l in snapshot.line_items}
    detail = json.dumps({
        "lines": [{"line_id": e.line_id, "before": {
            "description": before[e.line_id].description,
            "quantity": str(before[e.line_id].quantity),
            "unit": before[e.line_id].unit}} for e in corrections.lines],
        "matches": [{"line_id": m.line_id, "catalog_item_id": m.catalog_item_id} for m in corrections.matches],
    })
    with store.transaction() as conn:
        rec = store.load(conn, reconciliation_id)
        if rec is None or rec.model_dump_json() != snapshot.model_dump_json():
            raise CorrectionConflict("Reconciliation changed while correcting; reload and retry")
        rec.line_items = [lines[l.id] for l in snapshot.line_items]
        rec.matches = [matches[l.id] for l in rec.line_items]
        rec.discrepancies = result.discrepancies
        rec.warnings = warnings
        rec.status = "ready" if clean else "needs_review"
        if not result.discrepancies:
            rec.claim = None
        elif rec.claim is None:
            rec.claim = claims.new_claim(result.discrepancies)
        else:  # replace the draft's contents, keep its id and creation time
            rec.claim.discrepancies = result.discrepancies
        store.save(conn, rec)
        store.audit(conn, reconciliation_id, "corrected", detail)
    saved = store.get_reconciliation(reconciliation_id)
    if saved is None:
        raise RuntimeError("Reconciliation was not persisted")
    return saved
