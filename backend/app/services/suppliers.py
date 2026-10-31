"""Owner: backend. Synthetic supplier catalog persisted in SQLite."""

import json
from decimal import Decimal
from pathlib import Path

from app.core.config import get_settings
from app.schemas.recovery import Supplier, SupplierProduct
from app.services import store

_COLUMNS = ("id, supplier_id, description, category, sale_unit, pack_size, pack_unit, unit_price, "
            "currency, available_qty, lead_time_days, available")


def seed_suppliers(path: str | None = None) -> int:
    """Load fixtures/suppliers.json. Idempotent: existing rows (even edited ones) are kept.

    Returns the number of newly inserted products.
    """
    data = json.loads(Path(path or get_settings().suppliers_path).read_text())
    inserted = 0
    with store.transaction() as conn:
        for supplier in data["suppliers"]:
            conn.execute("INSERT OR IGNORE INTO suppliers (id, name) VALUES (?, ?)",
                         (supplier["id"], supplier["name"]))
            for p in supplier["products"]:
                cursor = conn.execute(
                    f"INSERT OR IGNORE INTO supplier_products ({_COLUMNS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                    (p["id"], supplier["id"], p["description"], p["category"], p["sale_unit"],
                     str(Decimal(p["pack_size"])), p["pack_unit"], str(Decimal(p["unit_price"])),
                     p.get("currency", "DKK"), str(Decimal(p["available_qty"])),
                     int(p["lead_time_days"]), int(bool(p["available"]))))
                inserted += cursor.rowcount
    return inserted


def list_products() -> list[SupplierProduct]:
    with store.transaction() as conn:
        rows = conn.execute(
            "SELECT p.*, s.name AS supplier_name FROM supplier_products p "
            "JOIN suppliers s ON s.id = p.supplier_id ORDER BY s.name, p.id").fetchall()
    return [SupplierProduct(**{**dict(r), "available": bool(r["available"])}) for r in rows]


def list_suppliers() -> list[Supplier]:
    grouped: dict[str, Supplier] = {}
    for product in list_products():
        supplier = grouped.setdefault(
            product.supplier_id, Supplier(id=product.supplier_id, name=product.supplier_name, products=[]))
        supplier.products.append(product)
    return list(grouped.values())
