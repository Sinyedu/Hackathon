"""Owner: backend. Draft claims and explicit approval, persisted to SQLite.

A claim is only reported as created or approved after its transaction has committed; the returned
object is re-read from the database, never built from in-memory state.
"""

import uuid

from app.schemas.domain import Claim, ClaimStatus, Discrepancy, Reconciliation
from app.services import store

APPROVABLE_STATUS = "ready"  # no unresolved review items left


class ClaimError(Exception):
    """Raised when a claim action is not allowed in the current state."""


def _require(rec: Reconciliation | None, reconciliation_id: str) -> Reconciliation:
    if rec is None:
        raise ClaimError(f"Reconciliation {reconciliation_id} not found")
    return rec


def create_draft_claim(reconciliation_id: str, discrepancies: list[Discrepancy]) -> Claim:
    """Persist a draft claim on the reconciliation and write an audit entry."""
    if not discrepancies:
        raise ClaimError("No discrepancies to claim")
    with store.transaction() as conn:
        rec = _require(store.load(conn, reconciliation_id), reconciliation_id)
        if rec.claim is not None:
            raise ClaimError("This reconciliation already has a claim")
        rec.discrepancies = discrepancies
        rec.claim = Claim(id=f"CLM-{uuid.uuid4().hex[:10]}", discrepancies=discrepancies,
                          created_at=store.now())
        store.save(conn, rec)
        store.audit(conn, reconciliation_id, "claim_drafted", rec.claim.id)
    return _persisted_claim(reconciliation_id)


def approve_claim(reconciliation_id: str) -> Claim:
    """Set status=approved + approved_at. Refused while review items are outstanding."""
    with store.transaction() as conn:
        rec = _require(store.load(conn, reconciliation_id), reconciliation_id)
        if rec.claim is None:
            raise ClaimError("No claim to approve")
        if rec.claim.status == ClaimStatus.APPROVED:
            raise ClaimError("Claim is already approved")
        if rec.status != APPROVABLE_STATUS:
            raise ClaimError(f"Cannot approve while reconciliation status is {rec.status!r}")
        rec.claim.status = ClaimStatus.APPROVED
        rec.claim.approved_at = store.now()
        rec.status = "approved"
        store.save(conn, rec)
        store.audit(conn, reconciliation_id, "claim_approved", rec.claim.id)
    return _persisted_claim(reconciliation_id)


def _persisted_claim(reconciliation_id: str) -> Claim:
    rec = store.get_reconciliation(reconciliation_id)
    if rec is None or rec.claim is None:
        raise ClaimError("Claim was not persisted")
    return rec.claim
