"""Known product catalog the matcher may select from (seeded from fixtures for the MVP)."""

import json
from pathlib import Path

from app.core.config import get_settings
from app.schemas.domain import CatalogItem


def load_catalog() -> list[CatalogItem]:
    path = Path(get_settings().catalog_path)
    return [CatalogItem(**item) for item in json.loads(path.read_text())]
