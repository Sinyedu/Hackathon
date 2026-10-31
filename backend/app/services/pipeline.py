"""Owner: backend. Orchestrates extract -> match -> reconcile -> persist -> draft claim."""

import io
import uuid
from dataclasses import dataclass

from PIL import Image
from starlette.concurrency import run_in_threadpool

from app.schemas.domain import Document, DocumentKind, LineItem, Match, MatchMethod, MatchStatus, Reconciliation
from app.services import claims, store
from app.services.catalog import load_catalog
from app.services.extract import extract_line_items
from app.services.match import match_line
from app.services.reconcile import compute_discrepancies


@dataclass(frozen=True)
class Upload:
    kind: DocumentKind
    filename: str
    content: bytes


def media_type(content: bytes) -> str:
    if content[:5] == b"%PDF-":
        return "application/pdf"
    fmt = Image.open(io.BytesIO(content)).format or "PNG"
    return Image.MIME.get(fmt, "application/octet-stream")


def _save_upload(reconciliation_id: str, document_id: str, content: bytes) -> None:
    store.state.uploads[(reconciliation_id, document_id)] = content


async def run_reconciliation(purchase_order: Upload, delivery_note: Upload,
                             invoice: Upload | None = None,
                             aliases: dict[str, str] | None = None,
                             rejected: list[list[str]] | None = None,
                             require_model_review: bool = False) -> Reconciliation:
    """Raises ExtractionError (unreadable file) before anything is persisted."""
    rid = f"R-{uuid.uuid4().hex[:10]}"
    uploads = [u for u in (purchase_order, delivery_note, invoice) if u is not None]
    docs = [Document(id=f"{rid}-{u.kind.value}", kind=u.kind, filename=u.filename[:120]) for u in uploads]
    by_kind = dict(zip((u.kind for u in uploads), zip(uploads, docs)))

    lines: dict[DocumentKind, list[LineItem]] = {}
    for kind in (DocumentKind.PURCHASE_ORDER, DocumentKind.DELIVERY_NOTE):
        upload, doc = by_kind[kind]
        lines[kind] = await run_in_threadpool(
            extract_line_items, upload.content, document_id=doc.id, kind=kind)

    catalog = load_catalog()
    ordered, delivered = lines[DocumentKind.PURCHASE_ORDER], lines[DocumentKind.DELIVERY_NOTE]
    matches: list[Match] = []
    for line in ordered + delivered:
        alias = (aliases or {}).get(line.description)
        if alias and any(c.id == alias and c.unit == line.unit for c in catalog):
            match = Match(source_line_id=line.id, catalog_item_id=alias,
                          method=MatchMethod.LEARNED, status=MatchStatus.MATCHED)
        else:
            match = await match_line(line, catalog)
            if match.catalog_item_id and [line.description, match.catalog_item_id] in (rejected or []):
                match = Match(source_line_id=line.id, catalog_item_id=None,
                              method=match.method, status=MatchStatus.UNMATCHED)
            elif require_model_review and match.method == MatchMethod.MODEL and match.catalog_item_id:
                match.status = MatchStatus.NEEDS_REVIEW
        matches.append(match)
    result = compute_discrepancies(ordered, delivered, matches, catalog)

    warnings = list(result.warnings)
    if invoice is not None:
        warnings.append("Invoice stored but not reconciled in this version")
    needs_review = bool(result.unresolved_line_ids) or any(
        m.status != MatchStatus.MATCHED for m in matches) or bool(result.warnings)

    for upload, doc in zip(uploads, docs):
        _save_upload(rid, doc.id, upload.content)
        doc.status = "extracted" if upload.kind != DocumentKind.INVOICE else "not_reconciled"

    rec = Reconciliation(
        id=rid, status="needs_review" if needs_review else "ready", documents=docs,
        line_items=ordered + delivered, matches=matches, discrepancies=result.discrepancies,
        warnings=warnings)
    store.save_reconciliation(rec)
    if result.discrepancies:
        claims.create_draft_claim(rid, result.discrepancies)
    saved = store.get_reconciliation(rid)
    if saved is None:
        raise RuntimeError("Reconciliation was not persisted")
    return saved
