# Fixtures

Synthetic, reproducible demo data only. No real business data.

Planned files (add when generated):

- `purchase_order.png` (or .pdf) — ordered quantities (e.g. "Tomatoes, case 5 kg" x 24)
- `delivery_note.png` (or .pdf) — delivered quantities, differently named (e.g. "Tomato Box 5KG" x 18)
- `invoice.png` (or .pdf) — optional
- `catalog.json` — known product IDs/descriptions/units the matcher may select from
- `match_pairs.json` — 10-20 labelled name pairs for the model go/no-go check

## Test scans (`fixtures/samples/`)

Regenerate with `python tools/make_samples.py` (synthetic, deterministic). Every pair below should end in the same result: **Tomatoes ordered 24, delivered 18, short by 6 cases**.

| Files | What it exercises |
|---|---|
| `purchase_order.png` + `delivery_note.png` | Clean images, named so the type is obvious |
| `purchase_order.pdf` + `delivery_note.pdf` | Text PDFs (no OCR needed) |
| `IMG_0101.jpg` + `IMG_0102.jpg` | Phone photos with camera names: portrait shot stored sideways with an EXIF tag, and a page on a desk, tilted, blurry and dim |
| `IMG_0103_upside_down.jpg` + `IMG_0104_worn_paper.jpg` | Upside-down photo; stained, skewed, soft print |
| `scan_sideways_no_tag.png` | Scanner-app page rotated 90 degrees with no orientation tag |
| `scanned_purchase_order.pdf` + `scanned_delivery_note.pdf` | PDFs that are only a picture (flatbed scanner) |

Pick any two in the agent (either order): it reads each page's title to tell the purchase order from the delivery note.
