"""Shared data contract (see AGENTS.md "Data contract").

Mirrored by frontend/src/types/reconciliation.ts. Change both together.
Decimal values are serialised as JSON strings to avoid float rounding.
"""

from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, Field


class DocumentKind(StrEnum):
    PURCHASE_ORDER = "purchase_order"
    DELIVERY_NOTE = "delivery_note"
    INVOICE = "invoice"


class MatchStatus(StrEnum):
    MATCHED = "matched"
    NEEDS_REVIEW = "needs_review"
    UNMATCHED = "unmatched"


class MatchMethod(StrEnum):
    EXACT = "exact"
    FUZZY = "fuzzy"
    MODEL = "model"
    MANUAL = "manual"
    LEARNED = "learned"


class ClaimStatus(StrEnum):
    DRAFT = "draft"
    APPROVED = "approved"


class Document(BaseModel):
    id: str
    kind: DocumentKind
    filename: str
    status: str = "uploaded"


class LineItem(BaseModel):
    id: str
    source_document_id: str
    source_text: str  # evidence: the raw snippet this item was read from
    description: str
    quantity: Decimal
    unit: str
    unit_price: Decimal | None = None
    page: int | None = None
    bbox: tuple[float, float, float, float] | None = None
    corrected: bool = False  # edited by the user after OCR


class CatalogItem(BaseModel):
    id: str
    description: str
    unit: str


class ModelMatchResult(BaseModel):
    """Validated shape of the model's JSON answer. candidate_id must be a supplied ID or null."""

    candidate_id: str | None
    reason: str = ""
    needs_review: bool = True


class Match(BaseModel):
    source_line_id: str
    target_line_id: str | None = None
    catalog_item_id: str | None = None
    method: MatchMethod
    score: float | None = None
    status: MatchStatus


class Discrepancy(BaseModel):
    catalog_item_id: str
    description: str
    unit: str
    ordered_quantity: Decimal
    delivered_quantity: Decimal
    difference: Decimal  # delivered - ordered; negative means shortage
    evidence: list[str] = Field(default_factory=list)  # source snippets


class Claim(BaseModel):
    id: str
    status: ClaimStatus = ClaimStatus.DRAFT
    discrepancies: list[Discrepancy]
    created_at: datetime
    approved_at: datetime | None = None


class LineEdit(BaseModel):
    """User correction of an OCR-read line. Only the supplied fields change."""

    line_id: str
    description: str | None = Field(default=None, min_length=1)
    quantity: Decimal | None = Field(default=None, ge=0)
    unit: str | None = None


class MatchChoice(BaseModel):
    """Manual product choice for a line; catalog_item_id=None means 'not in the catalog'."""

    line_id: str
    catalog_item_id: str | None = None


class Corrections(BaseModel):
    lines: list[LineEdit] = Field(default_factory=list)
    matches: list[MatchChoice] = Field(default_factory=list)


class Reconciliation(BaseModel):
    id: str
    status: str  # processing | needs_review | ready | approved | failed
    documents: list[Document] = Field(default_factory=list)
    line_items: list[LineItem] = Field(default_factory=list)
    matches: list[Match] = Field(default_factory=list)
    discrepancies: list[Discrepancy] = Field(default_factory=list)
    claim: Claim | None = None
    warnings: list[str] = Field(default_factory=list)  # e.g. "Ollama unavailable"
