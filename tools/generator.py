"""Deterministic synthetic delivery scans. Answer keys never enter the extraction pipeline."""

import json
import hashlib
import random
from pathlib import Path

import pymupdf
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / "dock-inbox"
ANSWERS = ROOT / "dock-answers"

PRODUCTS = [
    ("P001", "Tomatoes, case 5 kg", "case", "12.50"),
    ("P011", "Cucumbers, case 5 kg", "case", "9.20"),
    ("P012", "Red Onions, case 10 kg", "case", "9.80"),
    ("P013", "Olive Oil Extra Virgin 1 L", "bottle", "8.40"),
    ("P014", "Mozzarella 125 g pack", "pack", "1.90"),
]
NAMES = {
    "FreshField": ["Tomato Box 5KG", "Cucumber 5kg", "Red Onion 10kg", "EVOO 1L", "Mozz 125g"],
    "Nordic Greens": ["Tomater, kasse 5 kg", "Agurker, kasse 5 kg", "Rødløg, kasse 10 kg", "Olivenolie 1 L", "Mozzarella 125 g"],
    "Metro Wholesale": ["TOM-5K-CS", "CUC-5K-CS", "ONI-10K-CS", "OIL-EV-1L", "MOZ-125G-PK"],
}


# A free font (DejaVu Sans, redistributable; see fonts/LICENSE-DejaVu.txt) ships with the repo so fixtures
# render the same on Windows, macOS and any Linux distribution, and the euro sign always exists.
FONT_DIR = Path(__file__).resolve().parent / "fonts"


def _font_file(bold: bool) -> str:
    path = FONT_DIR / ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf")
    if not path.exists():
        raise RuntimeError(f"Bundled font missing: {path}")
    return str(path)


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(_font_file(bold), size)


def _render(title: str, code: str, rows: list[tuple[str, int, str, str | None]],
            seed: int, ugliness: int) -> Image.Image:
    image = Image.new("RGB", (1400, 1000), "white")
    draw = ImageDraw.Draw(image)
    draw.text((85, 80), "DOCKPROOF / SYNTHETIC DOCUMENT", font=_font(20, True), fill="#555555")
    draw.text((85, 125), title, font=_font(49, True), fill="#111111")
    draw.text((85, 198), code, font=_font(24), fill="#333333")
    draw.line((85, 250, 1320, 250), fill="#777777", width=2)
    for x, word in [(85, "PRODUCT"), (850, "QTY"), (1010, "UNIT"), (1180, "PRICE")]:
        draw.text((x, 275), word, font=_font(19, True), fill="#333333")
    for n, (name, quantity, unit, price) in enumerate(rows):
        y = 345 + n * 105
        draw.text((85, y), name, font=_font(32), fill="#111111")
        draw.text((855, y), str(quantity), font=_font(32), fill="#111111")
        draw.text((1010, y), unit, font=_font(30), fill="#111111")
        if price:
            draw.text((1180, y), f"€{price}", font=_font(27), fill="#111111")
        draw.line((85, y + 62, 1320, y + 62), fill="#dddddd", width=2)
    if ugliness:
        rng = random.Random(seed + (1 if title == "DELIVERY NOTE" else 0))
        if ugliness >= 2:
            stain = Image.new("RGBA", image.size)
            sd = ImageDraw.Draw(stain)
            sd.ellipse((1100, 40, 1380, 320), fill=(135, 76, 33, min(12, ugliness * 2)))
            image = Image.alpha_composite(image.convert("RGBA"), stain).convert("RGB")
        angle = rng.uniform(-min(ugliness, 4), min(ugliness, 4))
        image = image.rotate(angle, resample=Image.Resampling.BICUBIC, expand=False, fillcolor="white")
        image = ImageEnhance.Contrast(image).enhance(max(.86, 1 - ugliness * .025))
        image = image.filter(ImageFilter.GaussianBlur(radius=min(.5, ugliness * .1)))
    return image


def _write_pdf(path: Path, title: str, code: str, rows: list[tuple[str, int, str, str | None]]) -> None:
    """Text-based PDF, one line per product ("Name 18 case €12.50"), read without OCR."""
    document = pymupdf.open()
    page = document.new_page(width=595, height=842)
    page.insert_font(fontname="body", fontfile=_font_file(False))
    page.insert_font(fontname="bold", fontfile=_font_file(True))
    page.insert_text((50, 60), "DOCKPROOF / SYNTHETIC DOCUMENT", fontsize=9, fontname="body", color=(.35, .35, .35))
    page.insert_text((50, 100), title, fontsize=26, fontname="bold")
    page.insert_text((50, 128), code, fontsize=12, fontname="body", color=(.2, .2, .2))
    for n, (name, quantity, unit, price) in enumerate(rows):
        line = f"{name} {quantity} {unit}" + (f" €{price}" if price else "")
        page.insert_text((50, 190 + n * 34), line, fontsize=14, fontname="body")
    document.save(path)
    document.close()


def generate(session_id: str, persona: str, seed: int, chaos: list[str], ugliness: int = 0, fmt: str = "png") -> dict:
    if fmt not in {"png", "pdf"}:
        raise ValueError("Format must be png or pdf")
    if persona not in NAMES:
        raise ValueError("Unknown supplier persona")
    if ugliness < 0 or ugliness > 4:
        raise ValueError("Ugliness must be 0–4")
    if set(chaos) - {"shortage", "extra", "swapped", "overstated"}:
        raise ValueError("Unknown chaos option")
    rng = random.Random(seed)
    specification = json.dumps([persona, seed, sorted(chaos), ugliness], ensure_ascii=False)
    delivery_id = hashlib.sha256(specification.encode()).hexdigest()[:10]
    quantities = [rng.randint(14, 28) for _ in PRODUCTS]
    po_rows = [(product[1], quantities[i], product[2], product[3]) for i, product in enumerate(PRODUCTS)]
    note_rows = [(NAMES[persona][i], quantities[i], product[2], None) for i, product in enumerate(PRODUCTS)]
    problems = []
    if "shortage" in chaos:
        missing = rng.randint(2, 6)
        name, _, unit, price = note_rows[0]
        note_rows[0] = (name, quantities[0] - missing, unit, price)
        problems.append({"type": "shortage", "catalog_item_id": "P001", "amount": missing})
    if "extra" in chaos:
        note_rows.append(("Fresh basil, bunch", 4, "bunch", None))
        problems.append({"type": "extra", "catalog_item_id": "P008", "amount": 4})
    if "swapped" in chaos:
        name, qty, unit, price = note_rows[1]
        note_rows[1] = ("Fresh basil, bunch", qty, "bunch", price)
        problems.append({"type": "swapped", "catalog_item_id": "P011", "amount": qty})
    true_counts = {product[0]: note_rows[i][1] for i, product in enumerate(PRODUCTS)}
    if "overstated" in chaos:
        difference = rng.randint(2, 5)
        true_counts["P001"] = max(0, note_rows[0][1] - difference)
        problems.append({"type": "overstated", "catalog_item_id": "P001", "amount": difference})
    INBOX.mkdir(exist_ok=True)
    ANSWERS.mkdir(exist_ok=True)
    stem = f"{session_id}_{delivery_id}"
    po_name, note_name = f"{stem}_po.{fmt}", f"{stem}_dn.{fmt}"
    if fmt == "pdf":
        _write_pdf(INBOX / po_name, "PURCHASE ORDER", f"PO-{delivery_id}", po_rows)
        _write_pdf(INBOX / note_name, "DELIVERY NOTE", f"DN-{delivery_id}", note_rows)
    else:
        _render("PURCHASE ORDER", f"PO-{delivery_id}", po_rows, seed, ugliness).save(INBOX / po_name)
        _render("DELIVERY NOTE", f"DN-{delivery_id}", note_rows, seed, ugliness).save(INBOX / note_name)
    key = {"delivery_id": delivery_id, "session_id": session_id, "supplier": persona,
           "seed": seed, "problems": problems, "true_counts": true_counts,
           "ordered_quantities": quantities,
           "note_quantities": [row[1] for row in note_rows]}
    (ANSWERS / f"{delivery_id}.json").write_text(json.dumps(key, indent=2))
    return {"delivery_id": delivery_id, "supplier": persona, "purchase_order": po_name,
            "delivery_note": note_name, "seed": seed}
