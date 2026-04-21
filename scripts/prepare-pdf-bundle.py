"""
prepare-pdf-bundle.py

Pre-build script: copies clinical guideline PDFs from their absolute paths
stored in dev.db into prisma/clinical_guidelines/ so electron-builder
can pack them into the installer (asarUnpack).

Run automatically as part of electron:build / electron:release.
Safe to run multiple times — skips files already copied.
"""

import os
import sqlite3
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEV_DB = ROOT / "prisma" / "dev.db"
BUNDLE_DIR = ROOT / "prisma" / "clinical_guidelines"

# Fallback search locations: userData folders where the app stores PDFs.
# The app saves files as guideline_N_timestamp.pdf OR keeps the original filename.
# We check these dirs when the exact path from dev.db doesn't exist.
FALLBACK_DIRS = [
    Path(os.environ.get("APPDATA", "")) / "pediassist" / "clinical_guidelines",
    Path(os.environ.get("LOCALAPPDATA", "")) / "pediassist" / "clinical_guidelines",
]

if not DEV_DB.exists():
    print(f"[pdf-bundle] dev.db not found at: {DEV_DB}")
    sys.exit(1)

BUNDLE_DIR.mkdir(parents=True, exist_ok=True)

conn = sqlite3.connect(str(DEV_DB))
try:
    cursor = conn.execute(
        "SELECT id, title, pdf_path FROM clinical_guidelines WHERE pdf_path IS NOT NULL"
    )
    rows = cursor.fetchall()
finally:
    conn.close()

if not rows:
    print("[pdf-bundle] No PDF entries in clinical_guidelines — nothing to copy.")
    sys.exit(0)


def find_pdf(pdf_path: str, title: str) -> Path | None:
    """
    Try to locate the PDF file:
    1. Exact path from dev.db
    2. Same filename in each fallback dir
    3. Title-based filename in each fallback dir (app saves with original name)
    """
    exact = Path(pdf_path)
    if exact.exists():
        return exact

    candidates = [exact.name]
    # title often IS the original filename (e.g. "Бронхит.pdf")
    if title and not title == exact.name:
        candidates.append(title if title.endswith(".pdf") else title + ".pdf")

    for fallback_dir in FALLBACK_DIRS:
        if not fallback_dir.exists():
            continue
        for candidate in candidates:
            candidate_path = fallback_dir / candidate
            if candidate_path.exists():
                return candidate_path

    return None


copied = 0
missing = 0
skipped = 0

for (row_id, title, pdf_path) in rows:
    dest_name = Path(pdf_path).name
    dest = BUNDLE_DIR / dest_name

    if dest.exists():
        print(f"[pdf-bundle] Already bundled: {dest_name}")
        skipped += 1
        continue

    src = find_pdf(pdf_path, title)
    if src is None:
        print(f"[pdf-bundle] ⚠ Source PDF not found (id={row_id}, \"{title}\"): {pdf_path}")
        missing += 1
        continue

    shutil.copy2(str(src), str(dest))
    print(f"[pdf-bundle] ✓ Copied (id={row_id}, from={src.name}): {dest_name}")
    copied += 1

print(f"\n[pdf-bundle] Done. Copied: {copied}, Already bundled: {skipped}, Missing: {missing}")

if missing > 0:
    print("[pdf-bundle] Some PDFs were not found — they will be seeded without a pdf_path (CDSS chunks will still work).")
