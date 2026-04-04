import argparse
import json
import re
import sqlite3
from datetime import datetime, timezone

DB_PATH = r"prisma/dev.db"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def parse_json_list(text):
    if not text:
        return []
    try:
        value = json.loads(text)
        return value if isinstance(value, list) else []
    except Exception:
        return []


def parse_forms(forms_text):
    forms = parse_json_list(forms_text)
    return [f for f in forms if isinstance(f, dict)]


def pick_form_id(forms):
    if not forms:
        return None
    # Prefer oral pediatric-friendly forms first.
    preferred = ("drops", "syrup", "suspension", "solution", "tablet", "capsule")
    for p in preferred:
        for f in forms:
            if f.get("type") == p and f.get("id"):
                return f.get("id")
    return forms[0].get("id")


def parse_age_months(text):
    t = text.lower()

    m = re.search(r"от\s*(\d+)\s*меся\w*\s*до\s*(\d+)\s*лет", t)
    if m:
        return int(m.group(1)), int(m.group(2)) * 12

    m = re.search(r"от\s*(\d+)\s*до\s*(\d+)\s*меся", t)
    if m:
        return int(m.group(1)), int(m.group(2))

    m = re.search(r"от\s*(\d+)\s*лет\s*до\s*(\d+)\s*лет", t)
    if m:
        return int(m.group(1)) * 12, int(m.group(2)) * 12

    m = re.search(r"(\d+)\s*[-–]\s*(\d+)\s*лет", t)
    if m:
        return int(m.group(1)) * 12, int(m.group(2)) * 12

    m = re.search(r"до\s*(\d+)\s*меся", t)
    if m:
        return 0, int(m.group(1))

    m = re.search(r"до\s*(\d+)\s*лет", t)
    if m:
        return 0, int(m.group(1)) * 12

    m = re.search(r"старше\s*(\d+)\s*лет", t)
    if m:
        return int(m.group(1)) * 12, None

    return None, None


def parse_times_per_day(text):
    t = text.lower()
    m = re.search(r"(\d+)\s*раз[а]?\s*/\s*сут", t)
    if m:
        return int(m.group(1))
    m = re.search(r"(\d+)\s*раз[а]?\s*в\s*(?:сутки|день)", t)
    if m:
        return int(m.group(1))
    m = re.search(r"до\s*(\d+)\s*раз", t)
    if m:
        return int(m.group(1))
    return None


def parse_interval_hours(text):
    t = text.lower()
    m = re.search(r"интервал\s*(?:не\s*менее\s*)?(\d+(?:[\.,]\d+)?)\s*ч", t)
    if m:
        return float(m.group(1).replace(",", "."))
    m = re.search(r"каждые\s*(\d+(?:[\.,]\d+)?)\s*ч", t)
    if m:
        return float(m.group(1).replace(",", "."))
    return None


def parse_dose(text):
    t = text.lower()

    m = re.search(r"(\d+(?:[\.,]\d+)?)\s*[-–]\s*(\d+(?:[\.,]\d+)?)\s*мг\s*/\s*кг", t)
    if m:
        return {
            "unit": "mg",
            "dosing": {
                "type": "weight_based",
                "mgPerKg": float(m.group(1).replace(",", ".")),
                "maxMgPerKg": float(m.group(2).replace(",", ".")),
            },
        }

    m = re.search(r"(\d+(?:[\.,]\d+)?)\s*мг\s*/\s*кг", t)
    if m:
        return {
            "unit": "mg",
            "dosing": {
                "type": "weight_based",
                "mgPerKg": float(m.group(1).replace(",", ".")),
                "maxMgPerKg": None,
            },
        }

    m = re.search(r"(\d+(?:[\.,]\d+)?)\s*[-–]\s*(\d+(?:[\.,]\d+)?)\s*мг(?!\s*/\s*кг)", t)
    if m:
        return {
            "unit": "mg",
            "dosing": {
                "type": "fixed",
                "fixedDose": {
                    "min": float(m.group(1).replace(",", ".")),
                    "max": float(m.group(2).replace(",", ".")),
                    "unit": "mg",
                },
            },
        }

    m = re.search(r"(?:по\s*)?(\d+(?:[\.,]\d+)?)\s*(мл|кап(?:ель|ли)?|таб(?:\.|лет\w*)?)", t)
    if m:
        val = float(m.group(1).replace(",", "."))
        raw = m.group(2)
        if raw.startswith("мл"):
            unit = "ml"
        elif raw.startswith("кап"):
            unit = "drops"
        else:
            unit = "tablet"
        return {
            "unit": unit,
            "dosing": {
                "type": "fixed",
                "fixedDose": {
                    "min": val,
                    "max": val,
                    "unit": unit,
                },
            },
        }

    m = re.search(r"(?:по\s*)?(\d+(?:[\.,]\d+)?)\s*мг(?!\s*/\s*кг)", t)
    if m:
        val = float(m.group(1).replace(",", "."))
        return {
            "unit": "mg",
            "dosing": {
                "type": "fixed",
                "fixedDose": {
                    "min": val,
                    "max": val,
                    "unit": "mg",
                },
            },
        }

    return None


def looks_like_contraindication_only(text):
    t = text.lower()
    has_no_dose = not re.search(r"мг|мл|кап|таб|раз|кг", t)
    return ("противопоказ" in t or "не применять" in t) and has_no_dose


def build_rule(child_text, form_id, route):
    if not child_text:
        return None

    age_min, age_max = parse_age_months(child_text)
    dose = parse_dose(child_text)

    # High confidence only: must have both age and numeric dose.
    if (age_min is None and age_max is None) or not dose:
        return None

    times = parse_times_per_day(child_text)
    interval = parse_interval_hours(child_text)

    return {
        "minAgeMonths": age_min,
        "maxAgeMonths": age_max,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": form_id,
        "unit": dose["unit"],
        "dosing": dose["dosing"],
        "routeOfAdmin": route,
        "timesPerDay": times,
        "intervalHours": interval,
        "maxSingleDose": None,
        "maxSingleDosePerKg": None,
        "maxDailyDose": None,
        "maxDailyDosePerKg": None,
        "instruction": child_text.strip(),
    }


def main():
    parser = argparse.ArgumentParser(description="Safe pediatric dosing enrichment (high confidence only).")
    parser.add_argument("--db", default=DB_PATH)
    parser.add_argument("--apply", action="store_true", help="Write changes to DB. Without this flag, dry-run only.")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute(
        """
        SELECT id, name_ru, atc_code, forms, route_of_admin, pediatric_dosing, child_dosing, child_using
        FROM medications
        ORDER BY id
        """
    )
    rows = c.fetchall()

    candidates = []
    for r in rows:
        existing = parse_json_list(r["pediatric_dosing"])
        if existing:
            continue

        child_text = (r["child_dosing"] or "").strip()
        if not child_text:
            continue

        if looks_like_contraindication_only(child_text):
            continue

        forms = parse_forms(r["forms"])
        form_id = pick_form_id(forms)
        route = r["route_of_admin"] or "oral"

        rule = build_rule(child_text, form_id, route)
        if not rule:
            continue

        candidates.append((r["id"], r["name_ru"], r["atc_code"], [rule]))

    print(f"HIGH_CONFIDENCE_CANDIDATES={len(candidates)}")
    for item in candidates[:80]:
        print(f"CAND\t{item[0]}\t{item[2]}\t{item[1]}")

    if args.apply and candidates:
        ts = now_iso()
        for med_id, _name, _atc, rules in candidates:
            c.execute(
                "UPDATE medications SET pediatric_dosing = ?, updated_at = ? WHERE id = ?",
                (json.dumps(rules, ensure_ascii=False), ts, med_id),
            )
        conn.commit()
        print(f"APPLIED={len(candidates)}")
    elif args.apply:
        print("APPLIED=0")

    conn.close()


if __name__ == "__main__":
    main()
