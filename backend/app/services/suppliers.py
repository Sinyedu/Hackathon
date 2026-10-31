"""Synthetic supplier catalog in process-local memory."""

import json
from pathlib import Path

from app.core.config import get_settings
from app.schemas.recovery import Supplier, SupplierProduct
from app.services import store


def seed_suppliers(path: str | None = None) -> int:
    """Add fixture products without overwriting edits made during this run."""
    data = json.loads(Path(path or get_settings().suppliers_path).read_text())
    inserted = 0
    with store.transaction() as state:
        for supplier in data["suppliers"]:
            state.suppliers.setdefault(supplier["id"], supplier["name"])
            for product in supplier["products"]:
                if product["id"] not in state.supplier_products:
                    value = SupplierProduct.model_validate({**product, "supplier_id": supplier["id"],
                                                           "supplier_name": supplier["name"]})
                    state.supplier_products[product["id"]] = value.model_dump_json()
                    inserted += 1
    return inserted


def list_products() -> list[SupplierProduct]:
    with store.transaction() as state:
        values = [SupplierProduct.model_validate_json(value) for value in state.supplier_products.values()]
    return sorted(values, key=lambda product: (product.supplier_name, product.id))


def list_suppliers() -> list[Supplier]:
    grouped: dict[str, Supplier] = {}
    for product in list_products():
        supplier = grouped.setdefault(product.supplier_id,
            Supplier(id=product.supplier_id, name=product.supplier_name, products=[]))
        supplier.products.append(product)
    return list(grouped.values())
