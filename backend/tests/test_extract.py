import io
from decimal import Decimal
from pathlib import Path

import pymupdf
import pytest
from PIL import Image, ImageFilter

from app.schemas.domain import DocumentKind
from app.services.extract import (
    Cell,
    ExtractionError,
    extract_line_items,
    group_rows,
    parse_cells,
    parse_text_line,
)

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"
DN = DocumentKind.DELIVERY_NOTE


def cell(text: str, x: float, y: float) -> Cell:
    return Cell(text, x, y, 30)


def test_group_rows_and_parse_cells() -> None:
    cells = [cell("18", 700, 112), cell("Tomato Box 5KG", 40, 108), cell("box", 820, 110),
             cell("DELIVERY NOTE", 40, 30), cell("10", 700, 180), cell("Potatoes", 40, 178)]
    rows = [parse_cells(r) for r in group_rows(cells)]
    assert rows[0] is None  # title row has no quantity
    assert (rows[1].description, rows[1].quantity, rows[1].unit) == ("Tomato Box 5KG", Decimal(18), "box")
    assert (rows[2].description, rows[2].quantity) == ("Potatoes", Decimal(10))


def test_description_digits_are_not_quantity() -> None:
    row = parse_cells([cell("Tomatoes 5 kg", 40, 1), cell("24", 700, 1), cell("case", 800, 1)])
    assert (row.description, row.quantity, row.unit) == ("Tomatoes 5 kg", Decimal(24), "case")


def test_parse_text_line() -> None:
    row = parse_text_line("Pomme de terre 10kg sack 10 sack")
    assert (row.description, row.quantity, row.unit) == ("Pomme de terre 10kg sack", Decimal(10), "sack")
    assert parse_text_line("DELIVERY NOTE DN-7781") is None


def test_decimal_comma_quantity() -> None:
    assert parse_text_line("Flour 2,5 kg").quantity == Decimal("2.5")


def test_ocr_reads_clean_delivery_note() -> None:
    items = extract_line_items((FIXTURES / "delivery_note.png").read_bytes(), document_id="dn", kind=DN)
    got = [(i.description, i.quantity, i.unit) for i in items]
    assert got == [("Tomato Box 5KG", Decimal(18), "box"), ("Pomme de terre 10kg sack", Decimal(10), "sack"),
                   ("EVOO 5 litre tin", Decimal(6), "tin"), ("Mozzarella 2kg block", Decimal(8), "block")]
    assert items[0].source_text.startswith("Tomato Box 5KG") and items[0].id == "dn-L1"


def test_ocr_survives_tilted_blurry_photo() -> None:
    img = Image.open(FIXTURES / "purchase_order.png").convert("RGB")
    img = img.rotate(3, expand=True, fillcolor=(200, 195, 185)).filter(ImageFilter.GaussianBlur(1.2))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=40)
    items = extract_line_items(buf.getvalue(), document_id="po", kind=DocumentKind.PURCHASE_ORDER)
    assert [i.quantity for i in items] == [Decimal(24), Decimal(10), Decimal(6), Decimal(8)]


def test_text_pdf_with_page_numbers() -> None:
    pdf = pymupdf.open()
    pdf.new_page().insert_text((50, 72), "DELIVERY NOTE\nTomato Box 5KG 18 box\nMozzarella 2kg block 8 block")
    items = extract_line_items(pdf.tobytes(), document_id="p", kind=DN)
    assert [(i.quantity, i.page) for i in items] == [(Decimal(18), 1), (Decimal(8), 1)]


def test_garbage_file_is_rejected() -> None:
    with pytest.raises(ExtractionError):
        extract_line_items(b"not an image", document_id="x", kind=DN)


def test_blank_image_has_no_items() -> None:
    buf = io.BytesIO()
    Image.new("RGB", (300, 200), "white").save(buf, "PNG")
    with pytest.raises(ExtractionError):
        extract_line_items(buf.getvalue(), document_id="x", kind=DN)
