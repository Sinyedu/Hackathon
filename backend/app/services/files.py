"""Owner: backend. The local folder the agent may import documents from by name.

Browsers cannot open files on disk by name, so the agent asks the backend instead. Only plain
files directly inside the folder are visible; names are matched against that listing, never
joined into a path, so a request cannot reach anything outside it.
"""

import os
import re
from pathlib import Path

from app.schemas.domain import DocumentKind

ROOT = Path(__file__).resolve().parents[3]
SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".pdf"}
MAX_BYTES = 10 * 1024 * 1024


def folder() -> Path:
    return Path(os.environ.get("DOCKPROOF_FILES_DIR", ROOT / "imports"))


def guess_kind(name: str) -> DocumentKind | None:
    lowered = name.lower()
    if re.search(r"purchase|order|(^|[^a-z])po([^a-z]|$)", lowered):
        return DocumentKind.PURCHASE_ORDER
    if re.search(r"delivery|dispatch|packing|(^|[^a-z])dn([^a-z]|$)", lowered):
        return DocumentKind.DELIVERY_NOTE
    return None


def list_files() -> list[dict]:
    base = folder()
    if not base.is_dir():
        return []
    entries = [p for p in base.iterdir() if p.is_file() and not p.is_symlink() and p.suffix.lower() in SUFFIXES]
    return [{"name": p.name, "size": p.stat().st_size, "kind": kind.value if (kind := guess_kind(p.name)) else None}
            for p in sorted(entries, key=lambda p: p.name.lower())]


def read_file(name: str) -> bytes:
    """Content of a listed file. Raises KeyError for anything not in the listing."""
    if name not in {entry["name"] for entry in list_files()}:
        raise KeyError(name)
    path = folder() / name
    if path.stat().st_size > MAX_BYTES:
        raise ValueError(f"{name} is larger than {MAX_BYTES // 1024 // 1024} MB")
    return path.read_bytes()
