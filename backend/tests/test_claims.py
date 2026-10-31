from decimal import Decimal

import pytest

from app.schemas.domain import ClaimStatus, Discrepancy, Reconciliation
from app.services import claims, store


def discrepancy() -> Discrepancy:
    return Discrepancy(catalog_item_id="P001", description="Tomatoes, case 5 kg", unit="case",
                       ordered_quantity=Decimal(24), delivered_quantity=Decimal(18),
                       difference=Decimal(-6), evidence=["PO: Tomatoes (qty 24)", "DN: Tomato Box (qty 18)"])


def seed(status: str = "ready", id: str = "R1") -> str:
    store.save_reconciliation(Reconciliation(id=id, status=status))
    return id


def test_draft_claim_is_persisted_with_audit(db) -> None:
    rid = seed()
    claim = claims.create_draft_claim(rid, [discrepancy()])
    assert claim.status == ClaimStatus.DRAFT and claim.approved_at is None
    stored = store.get_reconciliation(rid)
    assert stored.claim.id == claim.id and stored.discrepancies[0].difference == Decimal(-6)
    assert ("claim_drafted", claim.id) in store.get_audit_log(rid)


def test_approval_changes_status_only_when_called(db) -> None:
    rid = seed()
    claims.create_draft_claim(rid, [discrepancy()])
    assert store.get_reconciliation(rid).claim.status == ClaimStatus.DRAFT
    approved = claims.approve_claim(rid)
    assert approved.status == ClaimStatus.APPROVED and approved.approved_at is not None
    stored = store.get_reconciliation(rid)
    assert stored.status == "approved" and stored.claim.status == ClaimStatus.APPROVED
    assert ("claim_approved", approved.id) in store.get_audit_log(rid)


def test_approval_survives_reload(db) -> None:
    rid = seed()
    claims.create_draft_claim(rid, [discrepancy()])
    claims.approve_claim(rid)
    assert store.get_reconciliation(rid).claim.approved_at is not None  # fresh connection


def test_cannot_approve_twice(db) -> None:
    rid = seed()
    claims.create_draft_claim(rid, [discrepancy()])
    claims.approve_claim(rid)
    with pytest.raises(claims.ClaimError, match="already approved"):
        claims.approve_claim(rid)


def test_cannot_approve_while_review_pending(db) -> None:
    rid = seed(status="needs_review")
    claims.create_draft_claim(rid, [discrepancy()])
    with pytest.raises(claims.ClaimError, match="needs_review"):
        claims.approve_claim(rid)
    assert store.get_reconciliation(rid).claim.status == ClaimStatus.DRAFT


def test_no_claim_without_discrepancies_or_reconciliation(db) -> None:
    with pytest.raises(claims.ClaimError):
        claims.create_draft_claim(seed(), [])
    with pytest.raises(claims.ClaimError, match="not found"):
        claims.create_draft_claim("missing", [discrepancy()])
    with pytest.raises(claims.ClaimError, match="No claim"):
        claims.approve_claim("R1")


def test_duplicate_claim_refused(db) -> None:
    rid = seed()
    claims.create_draft_claim(rid, [discrepancy()])
    with pytest.raises(claims.ClaimError, match="already has a claim"):
        claims.create_draft_claim(rid, [discrepancy()])
