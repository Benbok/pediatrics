"""
TASK-009: Verify and fix route_of_admin in dev.db against vidal-db.
Source of truth: vidal-db ZipInfo + Dosage fields.

Rules:
  - For each medication in dev.db, find the matching Document(s) in vidal-db
  - Match is done by DocumentID stored in JSON source filenames (exact, reliable)
  - Infer route from vidal ZipInfo + Dosage using the canonical infer_route()
  - If dev.db route != vidal-inferred route → update dev.db
  - If vidal has NO route info → set NULL (do not keep unverified values)

Usage:
  python scripts/verify_routes_vs_vidal.py              # dry-run (show diffs)
  python scripts/verify_routes_vs_vidal.py --apply      # apply fixes to dev.db
  python scripts/verify_routes_vs_vidal.py --json-dir <path>  # custom JSON folder
"""

import sqlite3
import re
import sys
import os
import glob
import json
import argparse

VIDAL_DB = "C:/Users/Arty/Desktop/ru.medsolutions/vidal.db"
APP_DB = "prisma/dev.db"

VALID_ROUTES = {
    "oral", "rectal", "iv_bolus", "iv_infusion", "iv_slow",
    "im", "sc", "sublingual", "topical", "inhalation", "intranasal", "transdermal",
}


def infer_route(text: str) -> str | None:
    """
    Infer RouteOfAdmin from free Russian text (ZipInfo + Dosage combined).
    Priority order: specific before general.
    Infusion keywords beat bolus when both are present.
    """
    t = (text or "").lower()

    # --- Ophthalmic / otic / vaginal → topical ---
    if any(k in t for k in ("глазн", "офтальм", "конъюнктив", "ушные", "капли уш", "вагинальн")):
        return "topical"

    # --- Nasal ---
    if any(k in t for k in ("назаль", "назал", "интраназал", "спрей назал")):
        return "intranasal"

    # --- Sublingual ---
    if any(k in t for k in ("сублингв", "подъязычн", "под язык")):
        return "sublingual"

    # --- Transdermal ---
    if any(k in t for k in ("трансдерм", "пластырь", "накожн")):
        return "transdermal"

    # --- Rectal ---
    if any(k in t for k in ("ректальн", "суппозитор рект", "супп. рект", "рект.")):
        return "rectal"

    # --- Inhalation (before IV — "р-р д/ингал" must not fall to iv) ---
    if any(k in t for k in ("ингаля", "аэрозоль д/ингал", "порошок д/ингал",
                             "р-р д/ингал", "р-р д/ингаляций", "небулайзер")):
        return "inhalation"

    # --- IV: infusion beats bolus when both present ---
    has_iv = "в/в" in t or "внутривенно" in t or "intravenous" in t
    has_bolus = any(k in t for k in ("струйно", "болюс", "iv bolus", "болюсно"))
    has_slow = any(k in t for k in ("медленно", "медленн", "iv slow"))
    has_infusion = any(k in t for k in (
        "капельно", "инфуз", "р-р д/инф", "р-р д/инфузий",
        "лиофилизат д/пригот. р-ра д/инф",
        "конц. д/пригот. р-ра д/инф",
        "концентрат д/пригот. р-ра д/инф",
    ))

    # Infusion-specific text wins over bolus/slow when both present
    if has_iv and has_infusion:
        return "iv_infusion"
    if has_iv and has_bolus:
        return "iv_bolus"
    if has_iv and has_slow:
        return "iv_slow"
    if has_iv or has_infusion:
        return "iv_infusion"

    # --- IM ---
    if "в/м" in t or "внутримышечн" in t or "intramuscular" in t:
        return "im"

    # --- SC ---
    if any(k in t for k in ("п/к", "подкожн", "subcutaneous", "s/c")):
        return "sc"

    # --- Topical ---
    if any(k in t for k in ("наруж", "местн", "крем", "маз", "гель", "лосьон",
                             "линимент", "шампун")):
        return "topical"

    # --- Oral ---
    if any(k in t for k in ("внутрь", "перорал", "per os", "оральн", "таб", "капс",
                             "сироп", "суспенз", "гранул", "эликсир")):
        return "oral"

    return None


def normalize_name(name: str) -> str:
    """Strip HTML tags and lowercase for comparison."""
    return re.sub(r"<[^>]+>", "", name or "").strip().lower()


def load_doc_id_map(json_dirs: list[str]) -> dict[str, list[int]]:
    """
    Scan JSON source files to build name_ru_clean → [doc_id, ...] mapping.
    Files must follow naming convention: doc_{DocumentID}_{slug}.json
    """
    mapping: dict[str, list[int]] = {}
    for json_dir in json_dirs:
        if not os.path.isdir(json_dir):
            continue
        for fpath in glob.glob(os.path.join(json_dir, "doc_*.json")):
            fname = os.path.basename(fpath)
            m = re.match(r"doc_(\d+)_", fname)
            if not m:
                continue
            doc_id = int(m.group(1))
            try:
                data = json.load(open(fpath, encoding="utf-8"))
                name_clean = normalize_name(data.get("nameRu", ""))
                if name_clean:
                    mapping.setdefault(name_clean, []).append(doc_id)
            except Exception:
                pass
    return mapping


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true",
                        help="Apply fixes to dev.db (default: dry-run)")
    parser.add_argument("--json-dir", default="src/modules/medications/data/aminoglycosides",
                        help="Folder(s) containing source JSON files (comma-separated)")
    args = parser.parse_args()

    json_dirs = [d.strip() for d in args.json_dir.split(",")]

    app_conn = sqlite3.connect(APP_DB)
    vidal_conn = sqlite3.connect(VIDAL_DB)
    app_cur = app_conn.cursor()
    vidal_cur = vidal_conn.cursor()

    # Build doc_id map from JSON files (exact lookup, reliable)
    doc_id_map = load_doc_id_map(json_dirs)
    print(f"Loaded {sum(len(v) for v in doc_id_map.values())} doc_id entries from JSON files")

    # Load all medications from dev.db
    app_cur.execute(
        "SELECT id, name_ru, route_of_admin, package_description FROM medications ORDER BY name_ru"
    )
    medications = app_cur.fetchall()
    print(f"Medications in dev.db: {len(medications)}")
    print("=" * 70)

    updates = []
    issues = []

    for med_id, name_ru, current_route, package_desc in medications:
        clean_name = normalize_name(name_ru)

        # --- Strategy 1: exact DocumentID from JSON source files ---
        doc_ids = doc_id_map.get(clean_name, [])

        vidal_row = None
        matched_doc_id = None

        if doc_ids:
            # Use first matching document ID
            placeholders = ",".join("?" * len(doc_ids))
            vidal_cur.execute(
                f"""
                SELECT d.DocumentID, d.RusName, MIN(p.ZipInfo) as ZipInfo, d.Dosage
                FROM Document d
                JOIN Product_Document pd ON pd.DocumentID = d.DocumentID
                JOIN Product p ON p.ProductID = pd.ProductID
                WHERE d.DocumentID IN ({placeholders})
                GROUP BY d.DocumentID
                ORDER BY d.DocumentID
                LIMIT 1
                """,
                doc_ids,
            )
            vidal_row = vidal_cur.fetchone()
            if vidal_row:
                matched_doc_id = vidal_row[0]

        # --- Strategy 2: fallback by normalized name ---
        if not vidal_row:
            vidal_cur.execute(
                """
                SELECT d.DocumentID, d.RusName, MIN(p.ZipInfo) as ZipInfo, d.Dosage
                FROM Document d
                JOIN Product_Document pd ON pd.DocumentID = d.DocumentID
                JOIN Product p ON p.ProductID = pd.ProductID
                WHERE lower(d.RusName) LIKE ?
                GROUP BY d.DocumentID
                LIMIT 1
                """,
                (f"%{clean_name}%",),
            )
            vidal_row = vidal_cur.fetchone()
            if vidal_row:
                matched_doc_id = vidal_row[0]

        if not vidal_row:
            issues.append(
                f"  [!] {name_ru} (id={med_id}): NOT FOUND in vidal-db "
                f"(current route='{current_route}', keeping as-is)"
            )
            continue

        doc_id, vidal_name, zip_info, dosage = vidal_row

        # Use ONLY ZipInfo for primary inference (clean signal),
        # then fall back to combined text if ZipInfo gave no result
        vidal_route = infer_route(zip_info or "")
        if vidal_route is None:
            vidal_route = infer_route((zip_info or "") + " " + (dosage or ""))

        status = "✅" if current_route == vidal_route else "❌"
        print(
            f"{status}  [{med_id}] {name_ru}\n"
            f"     vidal doc={doc_id}  ZipInfo: {(zip_info or '')[:70]}\n"
            f"     current: {current_route!r}  →  vidal inferred: {vidal_route!r}"
        )

        if current_route != vidal_route:
            updates.append((vidal_route, med_id, name_ru, current_route, vidal_route))

    print()
    if issues:
        print("⚠️ Not found in vidal-db (kept unchanged):")
        for i in issues:
            print(i)
        print()

    print(f"Discrepancies found: {len(updates)}")

    if not updates:
        print("✅ All routes match vidal-db. Nothing to update.")
        app_conn.close()
        vidal_conn.close()
        return

    print("\nChanges to apply:")
    for new_route, med_id, name, old_route, _ in updates:
        arrow = "→" if new_route else "→ NULL"
        print(f"  [{med_id}] {name}: '{old_route}' {arrow} '{new_route}'")

    if args.apply:
        print("\nApplying fixes...")
        for new_route, med_id, _, _, _ in updates:
            app_cur.execute(
                "UPDATE medications SET route_of_admin = ?, updated_at = datetime('now') WHERE id = ?",
                (new_route, med_id),
            )
        app_conn.commit()
        print(f"✅ Updated {len(updates)} record(s) in dev.db")
    else:
        print("\n[DRY RUN] Pass --apply to write changes to dev.db")

    app_conn.close()
    vidal_conn.close()


if __name__ == "__main__":
    main()
