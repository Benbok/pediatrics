#!/usr/bin/env python3
"""
Целевое обогащение 23 пробиотиков (id 6419-6441) данными из vidal.db.
Обновляет записи по id (не по name_ru), корректно заполняя все поля.
"""

import sqlite3
import json
import re
import sys
import os
from html import unescape
from datetime import datetime, timezone

VIDAL_DB = r"C:\Users\Arty\Desktop\ru.medsolutions\vidal.db"
DEST_DB  = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "prisma", "dev.db"))

# Маппинг: dev-db id → vidal DocumentID (выбираем наиболее полный документ)
ID_MAP = {
    6419: 41310,   # АЦИЛАКТ
    6420: 40683,   # АЦИПОЛ®
    6421: 17318,   # БИОСПОРИН
    6422: 50348,   # БИФИДОБАКТЕРИИ БИФИДУМ
    6423: 56843,   # БИФИДОБАКТЕРИИ БИФИДУМ + ЛАКТОБАКТЕРИИ ПЛАНТАРУМ
    6424: 50638,   # БИФИДОБАКТЕРИИ БИФИДУМ + ЛАКТОБАКТЕРИИ ПЛАНТАРУМ + ЛАКТОБАКТЕРИИ АЦИДОФИЛУС
    6425: 46230,   # БИФИДОБАКТЕРИИ БИФИДУМ + ЛИЗОЦИМ
    6426: 59007,   # БИФИДУМБАКТЕРИН ФОРТЕ®
    6427: 17316,   # БИФИКОЛ
    6428: 43339,   # БИФИЛАКТ-БИЛС®
    6429: 35608,   # БИФИЛИЗ
    6430: 58365,   # БИФИФОРМ
    6431: 58366,   # БИФИФОРМ КИДС
    6432: 25223,   # КОЛИБАКТЕРИН
    6433: 56832,   # ЛАКТОБАКТЕРИИ РАМНОЗУС
    6434: 34952,   # ЛАКТОБАКТЕРИН
    6435: 56994,   # ЛИНЕКС®
    6436: 56997,   # ЛИНЕКС® ФОРТЕ
    6437: 34842,   # ПРО-СИМБИОФЛОР
    6438: 28146,   # СПОРОБАКТЕРИН
    6439: 29220,   # ФЛОНИВИН БС
    6440: 48014,   # ХИЛАК ФОРТЕ
    6441: 59122,   # ЭНТЕРОЛ®
}

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def clean_html_text(value):
    if not value:
        return None
    text = re.sub(r"(?i)<br\s*/?>", "\n", value)
    text = re.sub(r"(?i)</(p|div|li|tr|h[1-6])>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    text = re.sub(r"[\t\r\f\v ]+", " ", text)
    text = re.sub(r"\n\s*\n+", "\n", text)
    text = re.sub(r"\s*\n\s*", "\n", text).strip()
    return text or None


def to_title_case(s):
    if not s:
        return s or ""
    return " ".join(w.capitalize() for w in s.strip().split())


def normalize_using(val):
    if not val:
        return None
    v = val.strip()
    return v if v in ("Can", "Care", "Not", "Qwes") else None


def parse_float(value):
    if not value:
        return None
    try:
        return float(str(value).replace(",", "."))
    except ValueError:
        return None


def normalize_unit(unit_raw):
    if not unit_raw:
        return None
    u = unit_raw.lower().strip()
    if u.startswith("мг"): return "mg"
    if u.startswith("мл"): return "ml"
    if u.startswith("капсул"): return "capsule"
    if u.startswith("доз"): return "dose"
    if u.startswith("капл"): return "drop"
    if u.startswith("таб"): return "tablet"
    if u.startswith("пак") or u.startswith("саш"): return "sachet"
    return unit_raw


def infer_route(text):
    t = text.lower()
    if "интравагин" in t or "влагалищ" in t: return "vaginal"
    if "ректал" in t: return "rectal"
    if "ингаляц" in t: return "inhalation"
    if "внутрь" in t or "перораль" in t: return "oral"
    return None


def extract_times_per_day(text):
    match = re.search(r"(?i)(\d+)(?:\s*[-–]\s*(\d+))?\s*раз(?:а)?\s*(?:/|в\s*)(?:сут|день|сутки)", text)
    if not match:
        return None
    low = int(match.group(1))
    high = int(match.group(2)) if match.group(2) else low
    return max(low, high)


def extract_fixed_dose(text):
    match = re.search(
        r"(?i)по\s*(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?\s*(мг|мл|капсул\w*|доз\w*|капл\w*|таблет\w*|пак\w*|саше)",
        text,
    )
    if not match:
        return None
    dose_min = parse_float(match.group(1))
    dose_max = parse_float(match.group(2)) if match.group(2) else dose_min
    unit = normalize_unit(match.group(3))
    if dose_min is None or dose_max is None:
        return None
    return {"type": "fixed", "fixedDose": {"min": dose_min, "max": dose_max, "unit": unit},
            "unit": unit, "maxSingleDose": dose_max}


def extract_weight_based(text):
    matches = re.findall(r"(?i)(\d+(?:[.,]\d+)?)\s*[-–]?\s*(\d+(?:[.,]\d+)?)?\s*мг\s*/\s*кг", text)
    if not matches:
        return None
    low_raw, high_raw = matches[0]
    mg_per_kg = parse_float(low_raw)
    max_mg_per_kg = parse_float(high_raw) if high_raw else mg_per_kg
    if mg_per_kg is None:
        return None
    dosing = {"type": "weight_based", "mgPerKg": mg_per_kg}
    if max_mg_per_kg is not None:
        dosing["maxMgPerKg"] = max_mg_per_kg
    return {"dosing": dosing, "unit": "mg"}


def extract_age_ranges(text):
    ranges = []
    for m in re.finditer(r"(?i)до\s*(\d+)\s*мес", text):
        ranges.append((0, int(m.group(1))))
    for m in re.finditer(r"(?i)от\s*(\d+)\s*мес\s*до\s*(\d+)\s*(?:г(?:ода|од|\.)?|лет)", text):
        ranges.append((int(m.group(1)), int(m.group(2)) * 12))
    for m in re.finditer(r"(?i)от\s*(\d+)\s*до\s*(\d+)\s*лет", text):
        ranges.append((int(m.group(1)) * 12, int(m.group(2)) * 12))
    for m in re.finditer(r"(?i)с\s*(\d+)\s*лет", text):
        ranges.append((int(m.group(1)) * 12, None))
    for m in re.finditer(r"(?i)старше\s*(\d+)\s*лет", text):
        ranges.append((int(m.group(1)) * 12, None))
    for m in re.finditer(r"(?i)до\s*(\d+)\s*лет", text):
        ranges.append((0, int(m.group(1)) * 12))
    seen = set()
    uniq = []
    for r in ranges:
        if r not in seen:
            uniq.append(r)
            seen.add(r)
    return uniq


def split_text_fragments(text):
    # Vidal often keeps dosing in multiline/semicolon-separated snippets.
    chunks = re.split(r"[\n;]+", text)
    return [chunk.strip(" .:-\u2022") for chunk in chunks if chunk and chunk.strip()]


def build_rule_from_text(text, min_m=None, max_m=None):
    route = infer_route(text)
    times_per_day = extract_times_per_day(text)
    interval_hours = round(24 / times_per_day) if times_per_day else None
    fixed = extract_fixed_dose(text)
    weight = extract_weight_based(text)

    rule = {"instruction": text}
    if min_m is not None:
        rule["minAgeMonths"] = min_m
    if max_m is not None:
        rule["maxAgeMonths"] = max_m
    if route:
        rule["routeOfAdmin"] = route
    if times_per_day:
        rule["timesPerDay"] = times_per_day
    if interval_hours:
        rule["intervalHours"] = interval_hours

    if weight:
        rule["dosing"] = weight["dosing"]
        rule["unit"] = weight["unit"]
    elif fixed:
        rule["dosing"] = {"type": fixed["type"], "fixedDose": fixed["fixedDose"]}
        rule["unit"] = fixed["unit"]
        rule["maxSingleDose"] = fixed["maxSingleDose"]

    return rule


def build_intelligent_pediatric_dosing(child_insuf, dosage):
    raw = child_insuf or dosage
    clean_text = clean_html_text(raw)
    if not clean_text:
        return json.dumps([], ensure_ascii=False)

    rules = []
    fragments = split_text_fragments(clean_text)
    age_driven_fragments = [f for f in fragments if extract_age_ranges(f)]

    for fragment in age_driven_fragments:
        age_ranges = extract_age_ranges(fragment)
        for min_m, max_m in age_ranges:
            rules.append(build_rule_from_text(fragment, min_m=min_m, max_m=max_m))

    # Fallback to a single instruction rule if age-specific parsing found nothing.
    if not rules:
        age_ranges = extract_age_ranges(clean_text)
        if age_ranges:
            for min_m, max_m in age_ranges:
                rules.append(build_rule_from_text(clean_text, min_m=min_m, max_m=max_m))
        else:
            rules.append(build_rule_from_text(clean_text))

    uniq_rules = []
    seen = set()
    for rule in rules:
        key = json.dumps(rule, ensure_ascii=False, sort_keys=True)
        if key not in seen:
            uniq_rules.append(rule)
            seen.add(key)

    return json.dumps(uniq_rules, ensure_ascii=False)


def build_full_instruction(doc):
    field_map = [
        ("indications",        doc["Indication"]),
        ("contraindications",  doc["ContraIndication"]),
        ("sideEffects",        doc["SideEffects"]),
        ("interactions",       doc["Interaction"]),
        ("pregnancyLactation", doc["Lactation"]),
        ("dosage",             doc["Dosage"]),
        ("childDosing",        doc["ChildInsuf"]),
        ("overdose",           doc["OverDosage"]),
        ("renalInsuf",         doc["RenalInsuf"]),
        ("hepatoInsuf",        doc["HepatoInsuf"]),
        ("elderlyInsuf",       doc["ElderlyInsuf"]),
        ("specialInstruction", doc["SpecialInstruction"]),
        ("pharmacokinetics",   doc["PhKinetics"]),
        ("pharmacodynamics",   doc["PhInfluence"]),
        ("storageCondition",   doc["StorageCondition"]),
        ("composition",        doc["CompiledComposition"]),
    ]
    sections = []
    for key, raw in field_map:
        cleaned = clean_html_text(raw)
        if cleaned:
            sections.append(f"{key}:\n{cleaned}")
    return "\n\n".join(sections) if sections else None


# ---------------------------------------------------------------------------
# ICD-10 lookup
# ---------------------------------------------------------------------------

def load_icd_map(vidal, doc_ids):
    placeholders = ",".join("?" * len(doc_ids))
    rows = vidal.execute(f"""
        SELECT din.DocumentID, noz.Code
        FROM Document_IndicNozology din
        JOIN Nozology noz ON noz.NozologyCode = din.NozologyCode
        WHERE din.DocumentID IN ({placeholders})
        ORDER BY din.DocumentID
    """, doc_ids).fetchall()
    icd_map = {}
    for doc_id, code in rows:
        icd_map.setdefault(doc_id, []).append(code)
    return icd_map


def load_atc_map(vidal, doc_ids):
    placeholders = ",".join("?" * len(doc_ids))
    rows = vidal.execute(f"""
        SELECT pd.DocumentID, patc.ATCCode
        FROM Product_Document pd
        JOIN Product_ATC patc ON patc.ProductID = pd.ProductID
        WHERE pd.DocumentID IN ({placeholders})
        ORDER BY pd.DocumentID, pd.ProductID
    """, doc_ids).fetchall()
    atc_map = {}
    for doc_id, code in rows:
        if doc_id not in atc_map:
            atc_map[doc_id] = code
    return atc_map


def load_lookup_maps(vidal, doc_ids):
    placeholders = ",".join("?" * len(doc_ids))

    molecule_rows = vidal.execute(f"""
        SELECT pd.DocumentID, mn.RusName
        FROM Product_Document pd
        JOIN Product_MoleculeName pmn ON pmn.ProductID = pd.ProductID
        JOIN MoleculeName mn ON mn.MoleculeNameID = pmn.MoleculeNameID
        WHERE pd.DocumentID IN ({placeholders})
        ORDER BY pd.DocumentID, pd.ProductID
    """, doc_ids).fetchall()

    clph_rows = vidal.execute(f"""
        SELECT pd.DocumentID, cg.Name
        FROM Product_Document pd
        JOIN Product_ClPhGroups pcg ON pcg.ProductID = pd.ProductID
        JOIN ClPhGroups cg ON cg.ClPhGroupsID = pcg.ClPhGroupsID
        WHERE pd.DocumentID IN ({placeholders})
        ORDER BY pd.DocumentID, pd.ProductID
    """, doc_ids).fetchall()

    phth_rows = vidal.execute(f"""
        SELECT pd.DocumentID, pg.Name
        FROM Product_Document pd
        JOIN Product_PhThGrp ppg ON ppg.ProductID = pd.ProductID
        JOIN PhThGroups pg ON pg.PhThGroupsID = ppg.PhThGroupsID
        WHERE pd.DocumentID IN ({placeholders})
        ORDER BY pd.DocumentID, pd.ProductID
    """, doc_ids).fetchall()

    mfr_rows = vidal.execute(f"""
        SELECT pd.DocumentID, c.LocalName
        FROM Product_Document pd
        JOIN Product_Company pc ON pc.ProductID = pd.ProductID AND pc.ItsMainCompany = 1
        JOIN Company c ON c.CompanyID = pc.CompanyID
        WHERE pd.DocumentID IN ({placeholders})
        ORDER BY pd.DocumentID, pd.ProductID
    """, doc_ids).fetchall()

    otc_rows = vidal.execute(f"""
        SELECT pd.DocumentID, MAX(COALESCE(p.NonPrescriptionDrug, 0)) AS is_otc
        FROM Product_Document pd
        JOIN Product p ON p.ProductID = pd.ProductID
        WHERE pd.DocumentID IN ({placeholders})
        GROUP BY pd.DocumentID
    """, doc_ids).fetchall()

    def first_map(rows):
        out = {}
        for doc_id, value in rows:
            if doc_id not in out and value:
                out[doc_id] = value
        return out

    return {
        "molecule": first_map(molecule_rows),
        "clph": first_map(clph_rows),
        "phth": first_map(phth_rows),
        "mfr": first_map(mfr_rows),
        "otc": {doc_id: bool(flag) for doc_id, flag in otc_rows},
    }


def load_package_map(vidal, doc_ids):
    placeholders = ",".join("?" * len(doc_ids))
    rows = vidal.execute(f"""
        SELECT pd.DocumentID, p.ZipInfo
        FROM Product_Document pd
        JOIN Product p ON p.ProductID = pd.ProductID
        WHERE pd.DocumentID IN ({placeholders})
        ORDER BY pd.DocumentID, pd.ProductID
    """, doc_ids).fetchall()

    package_map = {}
    for doc_id, zip_info in rows:
        cleaned = clean_html_text(zip_info)
        if not cleaned:
            continue
        package_map.setdefault(doc_id, [])
        if cleaned not in package_map[doc_id]:
            package_map[doc_id].append(cleaned)

    return {doc_id: "\n".join(values) for doc_id, values in package_map.items()}


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    vidal = sqlite3.connect(f"file:{VIDAL_DB}?mode=ro", uri=True)
    vidal.row_factory = sqlite3.Row
    dest = sqlite3.connect(DEST_DB)
    dest.execute("PRAGMA journal_mode=WAL")

    doc_ids = list(ID_MAP.values())
    icd_map = load_icd_map(vidal, doc_ids)
    atc_map = load_atc_map(vidal, doc_ids)
    lookups = load_lookup_maps(vidal, doc_ids)
    package_map = load_package_map(vidal, doc_ids)

    placeholders = ",".join("?" * len(doc_ids))
    documents = vidal.execute(f"""
        SELECT DocumentID, RusName, EngName,
               Indication, ContraIndication, SideEffects, Interaction, Lactation, Dosage,
               OverDosage, ChildInsuf, ChildInsufUsing,
               RenalInsuf, RenalInsufUsing, HepatoInsuf, HepatoInsufUsing,
               ElderlyInsuf, ElderlyInsufUsing,
               SpecialInstruction, PhKinetics, PhInfluence,
               StorageCondition, CompiledComposition
        FROM Document
        WHERE DocumentID IN ({placeholders})
    """, doc_ids).fetchall()

    doc_by_id = {row["DocumentID"]: row for row in documents}

    now = datetime.now(timezone.utc).isoformat()
    updated = 0
    errors = 0

    dest.execute("BEGIN")
    for med_id, doc_id in ID_MAP.items():
        doc = doc_by_id.get(doc_id)
        if not doc:
            print(f"  ⚠  DocumentID {doc_id} не найден в vidal.db")
            errors += 1
            continue

        icd_codes = icd_map.get(doc_id, [])
        indications_text = clean_html_text(doc["Indication"])
        indications_json = json.dumps([indications_text] if indications_text else [], ensure_ascii=False)

        dest.execute("""
            UPDATE medications SET
                name_en              = ?,
                active_substance     = ?,
                atc_code             = COALESCE(?, atc_code),
                     package_description  = CASE
                                                        WHEN (package_description IS NULL OR TRIM(package_description) = '')
                                                        THEN ?
                                                        ELSE package_description
                                                    END,
                clinical_pharm_group = COALESCE(?, clinical_pharm_group),
                pharm_therapy_group  = COALESCE(?, pharm_therapy_group),
                manufacturer         = COALESCE(?, manufacturer),
                indications          = ?,
                contraindications    = ?,
                side_effects         = ?,
                interactions         = ?,
                pregnancy            = ?,
                icd10_codes          = CASE WHEN (icd10_codes IS NULL OR icd10_codes = '[]') THEN ? ELSE icd10_codes END,
                is_otc               = ?,
                overdose             = ?,
                child_dosing         = ?,
                child_using          = ?,
                renal_insuf          = ?,
                renal_using          = ?,
                hepato_insuf         = ?,
                hepato_using         = ?,
                special_instruction  = ?,
                pharmacokinetics     = ?,
                pharmacodynamics     = ?,
                pediatric_dosing     = ?,
                full_instruction     = ?,
                updated_at           = ?
            WHERE id = ?
        """, (
            clean_html_text(doc["EngName"]),
            clean_html_text(lookups["molecule"].get(doc_id)) or to_title_case(clean_html_text(doc["RusName"])),
            atc_map.get(doc_id),
            package_map.get(doc_id) or clean_html_text(doc["CompiledComposition"]),
            lookups["clph"].get(doc_id),
            lookups["phth"].get(doc_id),
            lookups["mfr"].get(doc_id),
            indications_json,
            clean_html_text(doc["ContraIndication"]) or "",
            clean_html_text(doc["SideEffects"]),
            clean_html_text(doc["Interaction"]),
            clean_html_text(doc["Lactation"]),
            json.dumps(icd_codes, ensure_ascii=False),
            1 if lookups["otc"].get(doc_id, False) else 0,
            clean_html_text(doc["OverDosage"]),
            clean_html_text(doc["ChildInsuf"]) or clean_html_text(doc["Dosage"]),
            normalize_using(doc["ChildInsufUsing"]),
            clean_html_text(doc["RenalInsuf"]),
            normalize_using(doc["RenalInsufUsing"]),
            clean_html_text(doc["HepatoInsuf"]),
            normalize_using(doc["HepatoInsufUsing"]),
            clean_html_text(doc["SpecialInstruction"]),
            clean_html_text(doc["PhKinetics"]),
            clean_html_text(doc["PhInfluence"]),
            build_intelligent_pediatric_dosing(doc["ChildInsuf"], doc["Dosage"]),
            build_full_instruction(doc),
            now,
            med_id,
        ))
        updated += 1
        print(f"  ✓  id={med_id} ({doc['RusName'][:40]})")

    dest.execute("COMMIT")
    vidal.close()
    dest.close()

    print(f"\nОбновлено: {updated}, ошибок: {errors}")
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
