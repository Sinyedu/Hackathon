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
CREATE TABLE IF NOT EXISTS suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS supplier_products (
    id TEXT PRIMARY KEY,
    supplier_id TEXT NOT NULL REFERENCES suppliers(id),
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    sale_unit TEXT NOT NULL,
    pack_size TEXT NOT NULL,        -- Decimal as text
    pack_unit TEXT NOT NULL,
    unit_price TEXT NOT NULL,       -- Decimal as text
    currency TEXT NOT NULL,
    available_qty TEXT NOT NULL,    -- Decimal as text
    lead_time_days INTEGER NOT NULL,
    available INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS recovery_plans (
    id TEXT PRIMARY KEY,
    reconciliation_id TEXT NOT NULL,
    catalog_item_id TEXT NOT NULL,
    payload TEXT NOT NULL,          -- JSON of schemas.recovery.RecoveryPlan (without orders)
    created_at TEXT NOT NULL,
    UNIQUE (reconciliation_id, catalog_item_id)
);
CREATE TABLE IF NOT EXISTS replacement_orders (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload TEXT NOT NULL,          -- JSON of schemas.recovery.ReplacementOrder
    created_at TEXT NOT NULL,
    decided_at TEXT
);
-- At most one live (draft or approved) replacement order per recovery plan.
CREATE UNIQUE INDEX IF NOT EXISTS one_live_order_per_plan
    ON replacement_orders(plan_id) WHERE status IN ('draft', 'approved');
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
