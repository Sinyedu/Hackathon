"""Owner: backend. Read scanned images / PDFs into LineItems with provenance.

OCR output is untrusted: digits can be misread, so the UI must show these lines beside the source
image for user confirmation. Quantities and prices come straight from document text via regex;
the language model never produces numbers.
"""

import io
import math
import re
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from functools import lru_cache
from statistics import median
from typing import Any

import pymupdf
import numpy as np
from PIL import Image, UnidentifiedImageError

from app.schemas.domain import DocumentKind, LineItem

NUMBER = re.compile(r"^\d+(?:[.,]\d+)?$")
PRICE = re.compile(r"^[€$£]?\s*\d+(?:[.,]\d{1,2})?\s*[€$£]?$")
LINE = re.compile(r"^(?P<desc>.+)\s+(?P<qty>\d+(?:[.,]\d+)?)(?:\s+(?P<unit>[A-Za-z]+))?$")
MIN_OCR_SCORE = 0.5
ROW_TOLERANCE = 0.6  # fraction of median text height


class ExtractionError(ValueError):
    """Raised when a file cannot be read as an image or PDF, or yields no readable text."""


@dataclass(frozen=True)
class Cell:
    text: str
    x: float  # deskewed centre
    y: float
    height: float
    box: tuple[float, float, float, float] | None = None


@dataclass(frozen=True)
class Row:
    text: str
    description: str
    quantity: Decimal
    unit: str
    unit_price: Decimal | None
    box: tuple[float, float, float, float] | None = None


def to_decimal(text: str) -> Decimal | None:
    try:
        return Decimal(re.sub(r"[^\d.,]", "", text).replace(",", "."))
    except InvalidOperation:
        return None


@lru_cache(maxsize=1)
def _engine() -> Any:
    from rapidocr import RapidOCR  # heavy import; only when a scan is actually read

    return RapidOCR()


def ocr_cells(image: Image.Image) -> list[Cell]:
    """Run OCR and return text boxes with centres rotated to undo the photo's tilt."""
    result = _engine()(np.array(image.convert("RGB")))
    if result.boxes is None or result.txts is None:
        return []
    boxes = [(np.asarray(b, dtype=float), t, s) for b, t, s in
             zip(result.boxes, result.txts, result.scores) if s >= MIN_OCR_SCORE and t.strip()]
    angles = []
    for b, _, _ in boxes:
        dx, dy = b[1] - b[0]
        if dx > 2 * np.linalg.norm(b[3] - b[0]):  # wide boxes give a reliable baseline angle
            angles.append(math.atan2(dy, dx))
    angle = median(angles) if angles else 0.0
    cos, sin = math.cos(angle), math.sin(angle)
    cells = []
    for b, text, _ in boxes:
        cx, cy = b.mean(axis=0)
        cells.append(Cell(text.strip(), cx * cos + cy * sin, -cx * sin + cy * cos,
                          float(np.linalg.norm(b[3] - b[0])),
                          (float(b[:, 0].min()), float(b[:, 1].min()),
                           float(b[:, 0].max()), float(b[:, 1].max()))))
    return cells


def group_rows(cells: list[Cell]) -> list[list[Cell]]:
    """Cluster cells into visual rows by deskewed y position; cells ordered left to right."""
    if not cells:
        return []
    tolerance = ROW_TOLERANCE * median(c.height for c in cells)
    rows: list[list[Cell]] = []
    for cell in sorted(cells, key=lambda c: c.y):
        if rows and abs(cell.y - sum(c.y for c in rows[-1]) / len(rows[-1])) <= tolerance:
            rows[-1].append(cell)
        else:
            rows.append([cell])
    return [sorted(r, key=lambda c: c.x) for r in rows]


def parse_cells(cells: list[Cell]) -> Row | None:
    """Table-style row: description cell(s), a numeric-only quantity cell, then unit / price."""
    numeric = [i for i, c in enumerate(cells) if NUMBER.match(c.text)]
    if not numeric:
        return None  # title, header or free text
    q = numeric[0]
    description = " ".join(c.text for c in cells[:q]).strip()
    quantity = to_decimal(cells[q].text)
    if not description or quantity is None:
        return None
    after = cells[q + 1:]
    unit = next((c.text for c in after if c.text.isalpha()), "")
    price = next((to_decimal(c.text) for c in after if PRICE.match(c.text) and not c.text.isalpha()), None)
    boxes = [c.box for c in cells if c.box is not None]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes),
           max(b[2] for b in boxes), max(b[3] for b in boxes)) if boxes else None
    return Row(" ".join(c.text for c in cells), description, quantity, unit.lower(), price, box)


def parse_text_line(line: str) -> Row | None:
    """Single-line form 'Description 18 box' (text PDFs)."""
    m = LINE.match(line.strip())
    if not m:
        return None
    quantity = to_decimal(m["qty"])
    if quantity is None:
        return None
    return Row(line.strip(), m["desc"].strip(), quantity, (m["unit"] or "").lower(), None)


def _items(rows: list[tuple[Row, int | None]], document_id: str) -> list[LineItem]:
    return [
        LineItem(id=f"{document_id}-L{n}", source_document_id=document_id, source_text=r.text,
                 description=r.description, quantity=r.quantity, unit=r.unit,
                 unit_price=r.unit_price, page=page, bbox=r.box)
        for n, (r, page) in enumerate(rows, start=1)
    ]


def _read_image(content: bytes) -> Image.Image:
    try:
        return Image.open(io.BytesIO(content))
    except (UnidentifiedImageError, OSError) as exc:
        raise ExtractionError("File is neither a readable image nor a PDF") from exc


def _from_image(image: Image.Image, page: int | None) -> list[tuple[Row, int | None]]:
    parsed = (parse_cells(r) for r in group_rows(ocr_cells(image)))
    return [(row, page) for row in parsed if row]


def _from_pdf(content: bytes) -> list[tuple[Row, int | None]]:
    try:
        pdf = pymupdf.open(stream=content, filetype="pdf")
    except Exception as exc:  # PyMuPDF raises several unrelated types for corrupt files
        raise ExtractionError("PDF could not be opened") from exc
    rows: list[tuple[Row, int | None]] = []
    for number, page in enumerate(pdf, start=1):
        lines = [ln for ln in page.get_text().splitlines() if ln.strip()]
        if lines:
            rows += [(r, number) for r in map(parse_text_line, lines) if r]
        else:  # scanned PDF page: render and OCR it
            pix = page.get_pixmap(dpi=200)
            rows += _from_image(Image.open(io.BytesIO(pix.tobytes("png"))), number)
    return rows


def extract_line_items(content: bytes, *, document_id: str, kind: DocumentKind) -> list[LineItem]:
    """Parse an image or PDF into LineItems; source_text and page are kept as evidence.

    Synchronous and CPU-bound (~1s per image): call from a threadpool in async handlers.
    """
    rows = _from_pdf(content) if content[:5] == b"%PDF-" else _from_image(_read_image(content), None)
    if not rows:
        raise ExtractionError(f"No line items found in {kind.value}")
    return _items(rows, document_id)
