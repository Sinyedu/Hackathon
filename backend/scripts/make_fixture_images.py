"""Generate synthetic purchase order / delivery note images (no real business data).

Usage (backend/): python scripts/make_fixture_images.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

DOCS = {
    "purchase_order.png": ("PURCHASE ORDER  PO-1042", [
        ("Tomatoes, case 5 kg", "24", "case"),
        ("Potatoes, sack 10 kg", "10", "sack"),
        ("Olive oil extra virgin, 5 L tin", "6", "tin"),
        ("Mozzarella, block 2 kg", "8", "block"),
    ]),
    "delivery_note.png": ("DELIVERY NOTE  DN-7781", [
        ("Tomato Box 5KG", "18", "box"),
        ("Pomme de terre 10kg sack", "10", "sack"),
        ("EVOO 5 litre tin", "6", "tin"),
        ("Mozzarella 2kg block", "8", "block"),
    ]),
}


def render(path: Path, title: str, rows: list[tuple[str, str, str]]) -> None:
    img = Image.new("RGB", (1000, 120 + 70 * len(rows)), "white")
    draw = ImageDraw.Draw(img)
    big, small = ImageFont.truetype(FONT, 34), ImageFont.truetype(FONT, 28)
    draw.text((40, 30), title, fill="black", font=big)
    for i, (desc, qty, unit) in enumerate(rows):
        y = 110 + 70 * i
        draw.text((40, y), desc, fill="black", font=small)
        draw.text((700, y), qty, fill="black", font=small)
        draw.text((820, y), unit, fill="black", font=small)
    img.save(path)


if __name__ == "__main__":
    for name, (title, rows) in DOCS.items():
        render(FIXTURES / name, title, rows)
        print("wrote", FIXTURES / name)
