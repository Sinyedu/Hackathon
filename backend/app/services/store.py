"""Owner: backend. Persistence for reconciliations (JSON payload in SQLite) and the audit trail."""

import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime

from app.core.db import connect, init_db
from app.schemas.domain import Reconciliation


def now() -> datetime:
    return datetime.now(UTC)


@contextmanager
def transaction() -> Iterator[sqlite3.Connection]:
    """One write transaction (BEGIN IMMEDIATE) so read-modify-write cannot interleave."""
    init_db()
    conn = connect()
    conn.isolation_level = None  # explicit transaction control
    try:
        conn.execute("BEGIN IMMEDIATE")
        yield conn
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise
    finally:
        conn.close()


def load(conn: sqlite3.Connection, reconciliation_id: str) -> Reconciliation | None:
    row = conn.execute("SELECT payload FROM reconciliations WHERE id = ?", (reconciliation_id,)).fetchone()
    return Reconciliation.model_validate_json(row["payload"]) if row else None


def save(conn: sqlite3.Connection, rec: Reconciliation) -> None:
    conn.execute(
        "INSERT INTO reconciliations (id, status, payload, created_at) VALUES (?, ?, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET status = excluded.status, payload = excluded.payload",
        (rec.id, rec.status, rec.model_dump_json(), now().isoformat()),
    )


def audit(conn: sqlite3.Connection, reconciliation_id: str, event: str, detail: str = "") -> None:
    conn.execute(
        "INSERT INTO audit_log (reconciliation_id, event, detail, created_at) VALUES (?, ?, ?, ?)",
        (reconciliation_id, event, detail, now().isoformat()),
    )


def save_reconciliation(rec: Reconciliation) -> None:
    with transaction() as conn:
        save(conn, rec)
        audit(conn, rec.id, "saved", rec.status)


def get_reconciliation(reconciliation_id: str) -> Reconciliation | None:
    with transaction() as conn:
        return load(conn, reconciliation_id)


def get_audit_log(reconciliation_id: str) -> list[tuple[str, str]]:
    with transaction() as conn:
        rows = conn.execute(
            "SELECT event, detail FROM audit_log WHERE reconciliation_id = ? ORDER BY id", (reconciliation_id,)
        ).fetchall()
    return [(r["event"], r["detail"]) for r in rows]
