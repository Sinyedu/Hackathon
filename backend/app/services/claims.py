"""Owner: backend. Draft claims and explicit approval, persisted to SQLite."""

from app.schemas.domain import Claim, Discrepancy


def create_draft_claim(reconciliation_id: str, discrepancies: list[Discrepancy]) -> Claim:
    """Persist a draft claim and write an audit entry."""
    raise NotImplementedError


def approve_claim(reconciliation_id: str) -> Claim:
    """Set status=approved + approved_at, only after persistence succeeds."""
    raise NotImplementedError
