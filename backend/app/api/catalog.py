from fastapi import APIRouter

from app.schemas.domain import CatalogItem
from app.services.catalog import load_catalog

router = APIRouter(tags=["catalog"])


@router.get("/catalog", response_model=list[CatalogItem])
def get_catalog() -> list[CatalogItem]:
    """Products a line can be matched to (used by the manual-match dropdown)."""
    return load_catalog()
