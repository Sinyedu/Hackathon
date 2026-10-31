"""Deterministic synthetic delivery scans. Answer keys never enter the extraction pipeline."""

import json
import hashlib
import random
from pathlib import Path

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


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    names = (["/usr/share/fonts/google-noto/NotoSans-Bold.ttf", "LiberationSans-Bold.ttf", "DejaVuSans-Bold.ttf"]
             if bold else ["/usr/share/fonts/google-noto/NotoSans-Regular.ttf", "LiberationSans-Regular.ttf", "DejaVuSans.ttf"])
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    raise RuntimeError("A readable TrueType font is required to generate OCR fixtures")


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


def generate(session_id: str, persona: str, seed: int, chaos: list[str], ugliness: int = 0) -> dict:
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
    po_name, note_name = f"{stem}_po.png", f"{stem}_dn.png"
    _render("PURCHASE ORDER", f"PO-{delivery_id}", po_rows, seed, ugliness).save(INBOX / po_name)
    _render("DELIVERY NOTE", f"DN-{delivery_id}", note_rows, seed, ugliness).save(INBOX / note_name)
    key = {"delivery_id": delivery_id, "session_id": session_id, "supplier": persona,
           "seed": seed, "problems": problems, "true_counts": true_counts,
           "ordered_quantities": quantities,
           "note_quantities": [row[1] for row in note_rows]}
    (ANSWERS / f"{delivery_id}.json").write_text(json.dumps(key, indent=2))
    return {"delivery_id": delivery_id, "supplier": persona, "purchase_order": po_name,
            "delivery_note": note_name, "seed": seed}
