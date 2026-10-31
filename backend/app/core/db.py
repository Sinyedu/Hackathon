"""SQLite access. Plain sqlite3; no ORM."""

import sqlite3
from pathlib import Path

from app.core.config import get_settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS reconciliations (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,          -- JSON of schemas.domain.Reconciliation
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reconciliation_id TEXT NOT NULL,
    event TEXT NOT NULL,
    detail TEXT,
    created_at TEXT NOT NULL
);
"""


def _db_path() -> Path:
    url = get_settings().database_url
    return Path(url.removeprefix("sqlite:///"))


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(_db_path())
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
