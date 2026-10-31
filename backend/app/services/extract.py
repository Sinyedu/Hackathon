"""Owner: backend. Read PDFs/text into LineItems with provenance."""

from app.schemas.domain import DocumentKind, LineItem


def extract_line_items(content: bytes, *, document_id: str, kind: DocumentKind) -> list[LineItem]:
    """Parse a text-based PDF into LineItems; keep source_text and page for evidence."""
    raise NotImplementedError
