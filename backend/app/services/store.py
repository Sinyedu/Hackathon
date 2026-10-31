"""Process-local state. Restarting clears all sessions and reconciliations."""

import threading
from collections import defaultdict
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime

from app.schemas.domain import Reconciliation


class SessionStore:
    def __init__(self) -> None:
        self.lock = threading.RLock()
        self.reconciliations: dict[str, str] = {}
        self.audit_log: dict[str, list[tuple[str, str]]] = defaultdict(list)
        self.sessions: dict[str, dict] = {}
        self.uploads: dict[tuple[str, str], bytes] = {}


state = SessionStore()


def now() -> datetime:
    return datetime.now(UTC)


@contextmanager
def transaction() -> Iterator[SessionStore]:
    with state.lock:
        yield state


def load(conn: SessionStore, reconciliation_id: str) -> Reconciliation | None:
    payload = conn.reconciliations.get(reconciliation_id)
    return Reconciliation.model_validate_json(payload) if payload else None


def save(conn: SessionStore, rec: Reconciliation) -> None:
    conn.reconciliations[rec.id] = rec.model_dump_json()


def audit(conn: SessionStore, reconciliation_id: str, event: str, detail: str = "") -> None:
    conn.audit_log[reconciliation_id].append((event, detail))


def save_reconciliation(rec: Reconciliation) -> None:
    with transaction() as conn:
        save(conn, rec)
        audit(conn, rec.id, "saved", rec.status)


def get_reconciliation(reconciliation_id: str) -> Reconciliation | None:
    with transaction() as conn:
        return load(conn, reconciliation_id)


def get_audit_log(reconciliation_id: str) -> list[tuple[str, str]]:
    with transaction() as conn:
        return list(conn.audit_log.get(reconciliation_id, []))
