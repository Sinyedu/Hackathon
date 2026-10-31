"""Writes synthetic test documents to fixtures/samples/: python tools/make_samples.py

The same delivery every time (tomatoes short by 6 cases), as clean files and as the awkward
things real phones and scanners produce. Everything is synthetic.
"""

import io
import sys
from pathlib import Path

import pymupdf
from PIL import Image, ImageEnhance, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generator as g  # noqa: E402

OUT = Path(__file__).resolve().parents[1] / "fixtures" / "samples"
PO = [("Tomatoes, case 5 kg", 24, "case", "12.50"), ("Potatoes, sack 25 kg", 10, "sack", "18.00"),
      ("Olive oil, tin 5 L", 6, "tin", "42.00"), ("Mozzarella, block 2 kg", 8, "block", "21.50")]
DN = [("Tomatoes 5kg case", 18, "case", None), ("Potatoes 25kg sack", 10, "sack", None),
      ("Olive oil 5L tin", 6, "tin", None), ("Mozzarella 2kg block", 8, "block", None)]


def jpeg(image: Image.Image, path: Path, orientation: int | None = None) -> None:
    exif = Image.Exif()
    if orientation:
        exif[0x0112] = orientation
    image.convert("RGB").save(path, "JPEG", quality=82, exif=exif)


def on_desk(image: Image.Image, angle: float, blur: float, light: float) -> Image.Image:
    """A page lying on a dark desk, photographed at an angle with a bit of blur and dim light."""
    w, h = image.size
    desk = Image.new("RGB", (w * 2, int(h * 2.4)), (84, 74, 66))
    desk.paste(image.convert("RGB"), (w // 2, h // 2))
    desk = desk.rotate(angle, expand=True, fillcolor=(84, 74, 66), resample=Image.Resampling.BICUBIC)
    desk = desk.resize((3000, int(3000 * desk.height / desk.width)))
    return ImageEnhance.Brightness(desk.filter(ImageFilter.GaussianBlur(blur))).enhance(light)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    po = g._render("PURCHASE ORDER", "PO-48213", PO, 7, 0)
    dn = g._render("DELIVERY NOTE", "DN-77120", DN, 7, 0)
    po.save(OUT / "purchase_order.png")
    dn.save(OUT / "delivery_note.png")
    g._write_pdf(OUT / "purchase_order.pdf", "PURCHASE ORDER", "PO-48213", PO)
    g._write_pdf(OUT / "delivery_note.pdf", "DELIVERY NOTE", "DN-77120", DN)

    # Phone photos: camera file names, so only the printed title says what each one is.
    jpeg(po.rotate(90, expand=True), OUT / "IMG_0101.jpg", orientation=6)  # portrait shot: sideways pixels + EXIF tag
    jpeg(on_desk(dn, -6, 1.4, 0.8), OUT / "IMG_0102.jpg")                  # tilted on a desk, blurry, dim
    jpeg(po.rotate(180), OUT / "IMG_0103_upside_down.jpg")
    po.rotate(90, expand=True).save(OUT / "scan_sideways_no_tag.png")      # scanner app, rotated, no EXIF
    jpeg(g._render("DELIVERY NOTE", "DN-77120", DN, 7, 4), OUT / "IMG_0104_worn_paper.jpg")  # stained, skewed, soft

    # A PDF that is only a picture (what a flatbed scanner produces): needs OCR, has no text layer.
    for source, filename in ((po, "scanned_purchase_order.pdf"), (dn, "scanned_delivery_note.pdf")):
        buffer = io.BytesIO()
        source.convert("RGB").save(buffer, "JPEG", quality=80)
        pdf = pymupdf.open()
        page = pdf.new_page(width=595, height=int(595 * source.height / source.width))
        page.insert_image(page.rect, stream=buffer.getvalue())
        pdf.save(OUT / filename)
        pdf.close()
    print(f"Wrote {len(list(OUT.iterdir()))} files to {OUT}")


if __name__ == "__main__":
    main()
