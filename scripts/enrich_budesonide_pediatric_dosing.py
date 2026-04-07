import json
import pathlib
import re
import argparse
from typing import Any, Dict, List, Optional

BASE_DIR = pathlib.Path("src/modules/medications/data/budesonide")


def parse_float(v: str) -> Optional[float]:
    try:
        return float(v.replace(",", "."))
    except Exception:
        return None


def parse_age_bounds_months(text: str) -> Dict[str, Optional[int]]:
    t = text.lower()
    # Defaults: unknown
    min_age = None
    max_age = None

    # "до 6 месяцев" / "до 18 лет"
    m = re.search(r"до\s*(\d+)\s*меся", t)
    if m:
        max_age = int(m.group(1))
    m = re.search(r"до\s*(\d+)\s*лет", t)
    if m:
        max_age = int(m.group(1)) * 12

    # "старше 6 лет"
    m = re.search(r"старше\s*(\d+)\s*лет", t)
    if m:
        min_age = int(m.group(1)) * 12

    # "с 6 лет"
    m = re.search(r"с\s*(\d+)\s*лет", t)
    if m and min_age is None:
        min_age = int(m.group(1)) * 12

    # "от 6 до 12 лет"
    m = re.search(r"от\s*(\d+)\s*до\s*(\d+)\s*лет", t)
    if m:
        min_age = int(m.group(1)) * 12
        max_age = int(m.group(2)) * 12

    return {"min": min_age, "max": max_age}


def to_months(value: int, unit: str) -> int:
    unit_l = unit.lower()
    if unit_l.startswith("лет") or unit_l.startswith("год"):
        return value * 12
    return value


def find_contraindicated_upper_months(text: str) -> Optional[int]:
    t = re.sub(r"\s+", " ", text.lower())
    m = re.search(r"противопоказ[^\.\n]{0,180}?до\s*(\d+)\s*(мес(?:яц(?:ев|а)?)?|лет|года?)", t)
    if not m:
        return None
    return to_months(int(m.group(1)), m.group(2))


def find_allowed_min_age_months(text: str) -> Optional[int]:
    t = re.sub(r"\s+", " ", text.lower())

    m = re.search(r"дет[^\.\n]{0,180}?от\s*(\d+)\s*(мес(?:яц(?:ев|а)?)?|лет|года?)[^\.\n]{0,60}?старше", t)
    if m:
        return to_months(int(m.group(1)), m.group(2))

    m = re.search(r"дет[^\.\n]{0,180}?от\s*(\d+)\s*(мес(?:яц(?:ев|а)?)?|лет|года?)", t)
    if m:
        return to_months(int(m.group(1)), m.group(2))

    m = re.search(r"дет[^\.\n]{0,180}?старше\s*(\d+)\s*(мес(?:яц(?:ев|а)?)?|лет|года?)", t)
    if m:
        return to_months(int(m.group(1)), m.group(2))

    return None


def parse_fixed_daily_dose_for_children(text: str) -> Optional[Dict[str, Any]]:
    # Search directly from child-context fragments to preserve decimal values (0.25) and avoid adult-only ranges.
    t = re.sub(r"\s+", " ", text)
    range_re = re.compile(
        r"(дет[^\n]{0,240}?)(\d+(?:[\.,]\d+)?)\s*[\-–—−‑]\s*(\d+(?:[\.,]\d+)?)\s*(мг|мкг)\s*/\s*сут",
        re.IGNORECASE,
    )
    single_re = re.compile(
        r"(дет[^\n]{0,240}?)(\d+(?:[\.,]\d+)?)\s*(мг|мкг)\s*/\s*сут",
        re.IGNORECASE,
    )
    tpd_re = re.compile(r"(\d+)\s*раз(?:а)?\s*/\s*сут", re.IGNORECASE)

    candidates: List[Dict[str, Any]] = []

    for m in range_re.finditer(t):
        context_prefix = m.group(1).lower()
        if "взросл" in context_prefix:
            continue
        lo = parse_float(m.group(2))
        hi = parse_float(m.group(3))
        if lo is None or hi is None:
            continue
        if lo > hi:
            lo, hi = hi, lo
        if m.group(4).lower() == "мкг":
            lo = lo / 1000.0
            hi = hi / 1000.0
        span_start = max(0, m.start() - 80)
        span_end = min(len(t), m.end() + 120)
        snippet = t[span_start:span_end].strip()
        tpd = None
        tm = tpd_re.search(snippet)
        if tm:
            tpd = int(tm.group(1))
        candidates.append({
            "min": lo,
            "max": hi,
            "unit": "mg",
            "timesPerDay": tpd,
            "instruction": snippet,
        })

    if candidates:
        candidates.sort(key=lambda x: (x["min"], x["max"]))
        return candidates[0]

    for m in single_re.finditer(t):
        context_prefix = m.group(1).lower()
        if "взросл" in context_prefix:
            continue
        value = parse_float(m.group(2))
        if value is None:
            continue
        if m.group(3).lower() == "мкг":
            value = value / 1000.0
        span_start = max(0, m.start() - 80)
        span_end = min(len(t), m.end() + 120)
        snippet = t[span_start:span_end].strip()
        tpd = None
        tm = tpd_re.search(snippet)
        if tm:
            tpd = int(tm.group(1))
        return {
            "min": value,
            "max": value,
            "unit": "mg",
            "timesPerDay": tpd,
            "instruction": snippet,
        }

    return None


def find_primary_form(med: Dict[str, Any]) -> Dict[str, Optional[str]]:
    forms = med.get("forms") or []
    if forms and isinstance(forms[0], dict):
        form = forms[0]
        return {
            "id": form.get("id"),
            "unit": form.get("unit") or "mg",
        }
    return {"id": None, "unit": "mg"}


def base_rule(med: Dict[str, Any], instruction: str) -> Dict[str, Any]:
    route = med.get("routeOfAdmin")
    form = find_primary_form(med)
    return {
        "minAgeMonths": None,
        "maxAgeMonths": None,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": form["id"],
        "unit": form["unit"],
        "dosing": None,
        "routeOfAdmin": route,
        "timesPerDay": None,
        "intervalHours": None,
        "maxSingleDose": None,
        "maxSingleDosePerKg": None,
        "maxDailyDose": None,
        "maxDailyDosePerKg": None,
        "instruction": instruction,
    }


def try_build_budoster_specific_rules(med: Dict[str, Any], child_text: str) -> List[Dict[str, Any]]:
    # Budoster has explicit pediatric intranasal dosing in source text.
    if "будостер" not in (med.get("nameRu") or "").lower():
        return []

    rules: List[Dict[str, Any]] = []
    age = parse_age_bounds_months(child_text)

    init_rule = base_rule(med, "Детям старше 6 лет: в начале терапии по 100 мкг в каждый носовой ход 2 раза в сутки.")
    init_rule["minAgeMonths"] = age["min"] if age["min"] is not None else 72
    init_rule["dosing"] = {
        "type": "fixed",
        "fixedDose": {
            "min": 0.1,
            "max": 0.1,
            "unit": "mg",
        },
    }
    init_rule["timesPerDay"] = 2
    rules.append(init_rule)

    maint_rule = base_rule(med, "Поддерживающая доза: 50 мкг в каждую ноздрю 2 раза в сутки или 100 мкг в каждую ноздрю 1 раз в сутки.")
    maint_rule["minAgeMonths"] = init_rule["minAgeMonths"]
    maint_rule["dosing"] = {
        "type": "fixed",
        "fixedDose": {
            "min": 0.05,
            "max": 0.1,
            "unit": "mg",
        },
    }
    maint_rule["timesPerDay"] = None
    rules.append(maint_rule)

    return rules


def build_generic_rules(med: Dict[str, Any], child_text: str, child_using: Optional[str]) -> List[Dict[str, Any]]:
    clean = re.sub(r"\s+", " ", child_text).strip()
    full_text = re.sub(r"\s+", " ", f"{child_text} {med.get('fullInstruction') or ''}").strip()
    age = parse_age_bounds_months(clean)
    contraindicated_upper = find_contraindicated_upper_months(full_text)
    allowed_min = find_allowed_min_age_months(full_text)
    pediatric_daily_dose = parse_fixed_daily_dose_for_children(full_text)

    rules: List[Dict[str, Any]] = []

    # Contraindication "up to X" should not create an allowed criteria bucket for 0..X.
    effective_min = allowed_min
    if effective_min is None and contraindicated_upper is not None:
        effective_min = contraindicated_upper

    if pediatric_daily_dose is not None:
        instruction = pediatric_daily_dose["instruction"]
        rule = base_rule(med, instruction)
        rule["minAgeMonths"] = effective_min
        rule["dosing"] = {
            "type": "fixed",
            "fixedDose": {
                "min": pediatric_daily_dose["min"],
                "max": pediatric_daily_dose["max"],
                "unit": "mg",
            },
        }
        if pediatric_daily_dose.get("timesPerDay"):
            rule["timesPerDay"] = pediatric_daily_dose["timesPerDay"]
        rules.append(rule)
        return rules

    # If lower boundary is present, encode permitted age bucket.
    if effective_min is not None or age.get("min") is not None:
        rule = base_rule(med, clean)
        rule["minAgeMonths"] = effective_min if effective_min is not None else age["min"]
        if age.get("max") is not None:
            rule["maxAgeMonths"] = age["max"]
        rules.append(rule)
        return rules

    # If only contraindicated upper boundary is known, encode a permitted bucket from that age and up.
    if contraindicated_upper is not None:
        rule = base_rule(med, clean)
        rule["minAgeMonths"] = contraindicated_upper
        rules.append(rule)
        return rules

    # Fallback: keep structured pediatric note even when source has no exact ages.
    rules.append(base_rule(med, clean))
    return rules


def enrich_file(path: pathlib.Path, rewrite_existing: bool) -> bool:
    data = json.loads(path.read_text(encoding="utf-8"))
    existing_rules = data.get("pediatricDosing") or []
    if existing_rules and not rewrite_existing:
        return False

    child_text = (data.get("childDosing") or "").strip()
    if not child_text:
        return False

    child_using = data.get("childUsing")

    rules = try_build_budoster_specific_rules(data, child_text)
    if not rules:
        rules = build_generic_rules(data, child_text, child_using)

    if not rules:
        return False

    data["pediatricDosing"] = rules
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--rewrite-existing",
        action="store_true",
        help="Rebuild pediatricDosing even if rules already exist",
    )
    args = parser.parse_args()

    files = sorted(BASE_DIR.glob("*.json"))
    updated = 0
    for path in files:
        if enrich_file(path, rewrite_existing=args.rewrite_existing):
            updated += 1

    print(f"files={len(files)}")
    print(f"updated={updated}")


if __name__ == "__main__":
    main()
