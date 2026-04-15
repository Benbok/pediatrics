#!/usr/bin/env python3
"""
TASK-004: Импорт препаратов из vidal.db в dev.db

Стратегия:
- Один Document = одна запись Medication (уровень МНН)
- Idempotent: проверяем по nameRu. Если существует — обновляем
    Vidal-поля, НЕ трогая pediatricDosing/forms/isFavorite/icd10Codes
    (если они уже заполнены вручную, т.е. != '[]' или null)
- HTML-контент сохраняется as-is (dangerouslySetInnerHTML используется во фронте)
- Batching: COMMIT каждые 200 записей
"""

import sqlite3
import json
import re
import sys
import os
from html import unescape
from datetime import datetime, timezone

VIDAL_DB = r"C:\Users\Arty\Desktop\ru.medsolutions\vidal.db"
DEST_DB  = os.path.join(os.path.dirname(__file__), "..", "prisma", "dev.db")
BATCH_SIZE = 200

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def to_title_case(s: str | None) -> str:
    """ПАРАЦЕТАМОЛ  →  Парацетамол"""
    if not s:
        return s or ""
    # Каждое слово: первая буква заглавная, остальные строчные
    return " ".join(w.capitalize() for w in s.strip().split())


def strip_html(html: str | None) -> str | None:
    """Убираем HTML-теги, возвращаем plain text (для indications)."""
    return clean_html_text(html)


def clean_html_text(value: str | None) -> str | None:
    """Приводит HTML/текст Vidal к читабельному plain-text формату."""
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


def parse_float(value: str | None) -> float | None:
    if not value:
        return None
    try:
        return float(value.replace(",", "."))
    except ValueError:
        return None


def normalize_unit(unit_raw: str | None) -> str | None:
    if not unit_raw:
        return None
    u = unit_raw.lower().strip()
    if u.startswith("мг"):
        return "mg"
    if u.startswith("мл"):
        return "ml"
    if u.startswith("капсул"):
        return "capsule"
    if u.startswith("доз"):
        return "dose"
    if u.startswith("капл"):
        return "drop"
    if u.startswith("таб"):
        return "tablet"
    if u.startswith("пак") or u.startswith("саш"):
        return "sachet"
    return unit_raw


def infer_route(text: str) -> str | None:
    t = text.lower()
    if "интравагин" in t or "влагалищ" in t:
        return "vaginal"
    if "ректал" in t:
        return "rectal"
    if "ингаляц" in t:
        return "inhalation"
    if "внутрь" in t or "перораль" in t or "приема внутрь" in t:
        return "oral"
    return None


def extract_times_per_day(text: str) -> int | None:
    match = re.search(r"(?i)(\d+)(?:\s*[-–]\s*(\d+))?\s*раз(?:а)?\s*(?:/|в\s*)(?:сут|день|сутки)", text)
    if not match:
        return None
    low = int(match.group(1))
    high = int(match.group(2)) if match.group(2) else low
    return max(low, high)


def extract_fixed_dose(text: str) -> dict | None:
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

    return {
        "type": "fixed",
        "fixedDose": {
            "min": dose_min,
            "max": dose_max,
            "unit": unit,
        },
        "unit": unit,
        "maxSingleDose": dose_max,
    }


def extract_weight_based(text: str) -> dict | None:
    matches = re.findall(r"(?i)(\d+(?:[.,]\d+)?)\s*[-–]?\s*(\d+(?:[.,]\d+)?)?\s*мг\s*/\s*кг", text)
    if not matches:
        return None

    low_raw, high_raw = matches[0]
    mg_per_kg = parse_float(low_raw)
    max_mg_per_kg = parse_float(high_raw) if high_raw else mg_per_kg
    if mg_per_kg is None:
        return None

    dosing = {
        "type": "weight_based",
        "mgPerKg": mg_per_kg,
    }
    if max_mg_per_kg is not None:
        dosing["maxMgPerKg"] = max_mg_per_kg

    return {
        "dosing": dosing,
        "unit": "mg",
    }


def extract_age_ranges(text: str) -> list[tuple[int | None, int | None]]:
    ranges: list[tuple[int | None, int | None]] = []

    for match in re.finditer(r"(?i)до\s*(\d+)\s*мес", text):
        ranges.append((0, int(match.group(1))))

    for match in re.finditer(r"(?i)от\s*(\d+)\s*мес\s*до\s*(\d+)\s*(?:г(?:ода|од|\.)?|лет)", text):
        ranges.append((int(match.group(1)), int(match.group(2)) * 12))

    for match in re.finditer(r"(?i)от\s*(\d+)\s*до\s*(\d+)\s*лет", text):
        ranges.append((int(match.group(1)) * 12, int(match.group(2)) * 12))

    for match in re.finditer(r"(?i)с\s*(\d+)\s*лет", text):
        ranges.append((int(match.group(1)) * 12, None))

    for match in re.finditer(r"(?i)старше\s*(\d+)\s*лет", text):
        ranges.append((int(match.group(1)) * 12, None))

    uniq: list[tuple[int | None, int | None]] = []
    seen = set()
    for age_range in ranges:
        if age_range not in seen:
            uniq.append(age_range)
            seen.add(age_range)
    return uniq


def build_intelligent_pediatric_dosing(child_insuf: str | None, dosage: str | None) -> str:
    """Строит структурированный pediatric_dosing из ChildInsuf/Dosage Vidal."""
    raw = child_insuf or dosage
    clean_text = clean_html_text(raw)
    if not clean_text:
        return json.dumps([], ensure_ascii=False)

    age_ranges = extract_age_ranges(clean_text)
    route = infer_route(clean_text)
    times_per_day = extract_times_per_day(clean_text)
    interval_hours = round(24 / times_per_day) if times_per_day else None

    fixed = extract_fixed_dose(clean_text)
    weight = extract_weight_based(clean_text)

    base_rule: dict = {
        "instruction": clean_text,
    }
    if route:
        base_rule["routeOfAdmin"] = route
    if times_per_day:
        base_rule["timesPerDay"] = times_per_day
    if interval_hours:
        base_rule["intervalHours"] = interval_hours

    if weight:
        base_rule["dosing"] = weight["dosing"]
        base_rule["unit"] = weight["unit"]
    elif fixed:
        base_rule["dosing"] = {
            "type": fixed["type"],
            "fixedDose": fixed["fixedDose"],
        }
        base_rule["unit"] = fixed["unit"]
        base_rule["maxSingleDose"] = fixed["maxSingleDose"]

    rules: list[dict] = []
    if age_ranges:
        for min_months, max_months in age_ranges:
            rule = dict(base_rule)
            if min_months is not None:
                rule["minAgeMonths"] = min_months
            if max_months is not None:
                rule["maxAgeMonths"] = max_months
            rules.append(rule)
    else:
        rules.append(base_rule)

    return json.dumps(rules, ensure_ascii=False)


def build_full_instruction(doc: sqlite3.Row) -> str | None:
    """Строит plain-text полную инструкцию из разделов Vidal."""
    sections: list[str] = []

    field_map = [
        ("indications",         doc["Indication"]),
        ("contraindications",   doc["ContraIndication"]),
        ("sideEffects",         doc["SideEffects"]),
        ("interactions",        doc["Interaction"]),
        ("pregnancyLactation",  doc["Lactation"]),
        ("dosage",              doc["Dosage"]),
        ("childDosing",         doc["ChildInsuf"]),
        ("overdose",            doc["OverDosage"]),
        ("renalInsuf",          doc["RenalInsuf"]),
        ("hepatoInsuf",         doc["HepatoInsuf"]),
        ("elderlyInsuf",        doc["ElderlyInsuf"]),
        ("specialInstruction",  doc["SpecialInstruction"]),
        ("pharmacokinetics",    doc["PhKinetics"]),
        ("pharmacodynamics",    doc["PhInfluence"]),
        ("storageCondition",    doc["StorageCondition"]),
        ("composition",         doc["CompiledComposition"]),
    ]

    for key, raw in field_map:
        cleaned = clean_html_text(raw)
        if cleaned:
            sections.append(f"{key}:\n{cleaned}")

    return "\n\n".join(sections) if sections else None


def normalize_using(val: str | None) -> str | None:
    """Приводим значения Can/Care/Not/Qwes к нормальному виду."""
    if not val:
        return None
    v = val.strip()
    if v in ("Can", "Care", "Not", "Qwes"):
        return v
    return None


def is_empty_json_array(val: str | None) -> bool:
    return val is None or val.strip() in ("[]", "", "null")


# ---------------------------------------------------------------------------
# Load lookup Maps from vidal.db
# ---------------------------------------------------------------------------

def load_lookups(vidal: sqlite3.Connection) -> dict:
    print("  Загружаем lookup Maps из vidal.db...")

    # 1. DocumentID → MoleculeName (первый по ProductID)
    molecule_map = {}
    rows = vidal.execute("""
        SELECT pd.DocumentID, mn.RusName
        FROM Product_Document pd
        JOIN Product_MoleculeName pmn ON pmn.ProductID = pd.ProductID
        JOIN MoleculeName mn ON mn.MoleculeNameID = pmn.MoleculeNameID
        ORDER BY pd.DocumentID, pd.ProductID
    """).fetchall()
    for doc_id, name in rows:
        if doc_id not in molecule_map:
            molecule_map[doc_id] = name

    # 2. DocumentID → ATCCode (первый)
    atc_map = {}
    rows = vidal.execute("""
        SELECT pd.DocumentID, patc.ATCCode
        FROM Product_Document pd
        JOIN Product_ATC patc ON patc.ProductID = pd.ProductID
        ORDER BY pd.DocumentID, pd.ProductID
    """).fetchall()
    for doc_id, code in rows:
        if doc_id not in atc_map:
            atc_map[doc_id] = code

    # 3. DocumentID → ClPhGroup (первый)
    clph_map = {}
    rows = vidal.execute("""
        SELECT pd.DocumentID, cg.Name
        FROM Product_Document pd
        JOIN Product_ClPhGroups pcg ON pcg.ProductID = pd.ProductID
        JOIN ClPhGroups cg ON cg.ClPhGroupsID = pcg.ClPhGroupsID
        ORDER BY pd.DocumentID, pd.ProductID
    """).fetchall()
    for doc_id, name in rows:
        if doc_id not in clph_map:
            clph_map[doc_id] = name

    # 4. DocumentID → PhThGroup (первый)
    phth_map = {}
    rows = vidal.execute("""
        SELECT pd.DocumentID, pg.Name
        FROM Product_Document pd
        JOIN Product_PhThGrp ppg ON ppg.ProductID = pd.ProductID
        JOIN PhThGroups pg ON pg.PhThGroupsID = ppg.PhThGroupsID
        ORDER BY pd.DocumentID, pd.ProductID
    """).fetchall()
    for doc_id, name in rows:
        if doc_id not in phth_map:
            phth_map[doc_id] = name

    # 5. DocumentID → Manufacturer (главный производитель)
    mfr_map = {}
    rows = vidal.execute("""
        SELECT pd.DocumentID, c.LocalName
        FROM Product_Document pd
        JOIN Product_Company pc ON pc.ProductID = pd.ProductID AND pc.ItsMainCompany = 1
        JOIN Company c ON c.CompanyID = pc.CompanyID
        ORDER BY pd.DocumentID, pd.ProductID
    """).fetchall()
    for doc_id, name in rows:
        if doc_id not in mfr_map:
            mfr_map[doc_id] = name

    # 6. DocumentID → isOtc (если хоть один Product = OTC)
    otc_map = {}
    rows = vidal.execute("""
        SELECT pd.DocumentID, MAX(p.NonPrescriptionDrug) as is_otc
        FROM Product_Document pd
        JOIN Product p ON p.ProductID = pd.ProductID
        GROUP BY pd.DocumentID
    """).fetchall()
    for doc_id, is_otc in rows:
        otc_map[doc_id] = bool(is_otc)

    # 7. DocumentID → [ICD-10 codes] (через Nozology.Code)
    icd_map = {}
    rows = vidal.execute("""
        SELECT din.DocumentID, noz.Code
        FROM Document_IndicNozology din
        JOIN Nozology noz ON noz.NozologyCode = din.NozologyCode
        ORDER BY din.DocumentID
    """).fetchall()
    for doc_id, code in rows:
        if doc_id not in icd_map:
            icd_map[doc_id] = []
        icd_map[doc_id].append(code)

    # 8. DocumentID → package_description (агрегированный ZipInfo)
    package_map: dict[int, str] = {}
    rows = vidal.execute("""
        SELECT pd.DocumentID, p.ZipInfo
        FROM Product_Document pd
        JOIN Product p ON p.ProductID = pd.ProductID
        ORDER BY pd.DocumentID, pd.ProductID
    """).fetchall()
    for doc_id, zip_info in rows:
        cleaned = clean_html_text(zip_info)
        if not cleaned:
            continue
        package_map.setdefault(doc_id, [])
        if cleaned not in package_map[doc_id]:
            package_map[doc_id].append(cleaned)

    package_map = {doc_id: "\n".join(values) for doc_id, values in package_map.items()}

    print(f"    molecules: {len(molecule_map)}, atc: {len(atc_map)}, "
          f"clph: {len(clph_map)}, phth: {len(phth_map)}, mfr: {len(mfr_map)}, "
          f"otc: {len(otc_map)}, icd_docs: {len(icd_map)}")

    return {
        "molecule": molecule_map,
        "atc":      atc_map,
        "clph":     clph_map,
        "phth":     phth_map,
        "mfr":      mfr_map,
        "otc":      otc_map,
        "icd":      icd_map,
        "package":  package_map,
    }


# ---------------------------------------------------------------------------
# Build Medication record from Document row + lookups
# ---------------------------------------------------------------------------

def build_medication(doc: sqlite3.Row, maps: dict) -> dict:
    doc_id = doc["DocumentID"]
    now = datetime.now(timezone.utc).isoformat()

    icd_codes = maps["icd"].get(doc_id, [])

    return {
        "name_ru":             to_title_case(doc["RusName"]),
        "name_en":             clean_html_text(doc["EngName"]),
        "active_substance":    clean_html_text(maps["molecule"].get(doc_id)) or to_title_case(clean_html_text(doc["RusName"])),
        "atc_code":            maps["atc"].get(doc_id),
        "package_description": maps["package"].get(doc_id) or clean_html_text(doc["CompiledComposition"]),
        "clinical_pharm_group": clean_html_text(maps["clph"].get(doc_id)),
        "pharm_therapy_group": clean_html_text(maps["phth"].get(doc_id)),
        "manufacturer":        clean_html_text(maps["mfr"].get(doc_id)),
        "indications":         json.dumps(
            [clean_html_text(doc["Indication"])] if clean_html_text(doc["Indication"]) else [],
            ensure_ascii=False,
        ),
        "contraindications":   clean_html_text(doc["ContraIndication"]) or "",  # NOT NULL — fallback пустая строка
        "side_effects":        clean_html_text(doc["SideEffects"]),
        "interactions":        clean_html_text(doc["Interaction"]),
        "pregnancy":           clean_html_text(doc["Lactation"]),
        "lactation":           None,
        "icd10_codes":         json.dumps(icd_codes, ensure_ascii=False),
        "is_otc":              1 if maps["otc"].get(doc_id, False) else 0,
        # TASK-003 Vidal fields
        "overdose":            clean_html_text(doc["OverDosage"]),
        "child_dosing":        clean_html_text(doc["ChildInsuf"]) or clean_html_text(doc["Dosage"]),
        "child_using":         normalize_using(doc["ChildInsufUsing"]),
        "renal_insuf":         clean_html_text(doc["RenalInsuf"]),
        "renal_using":         normalize_using(doc["RenalInsufUsing"]),
        "hepato_insuf":        clean_html_text(doc["HepatoInsuf"]),
        "hepato_using":        normalize_using(doc["HepatoInsufUsing"]),
        "special_instruction": clean_html_text(doc["SpecialInstruction"]),
        "pharmacokinetics":    clean_html_text(doc["PhKinetics"]),
        "pharmacodynamics":    clean_html_text(doc["PhInfluence"]),
        # Empty/defaults for fields we can't populate from vidal.db
        "forms":               json.dumps([]),
        "pediatric_dosing":    build_intelligent_pediatric_dosing(doc["ChildInsuf"], doc["Dosage"]),
        "full_instruction":    build_full_instruction(doc),
        "is_favorite":         0,
        "created_at":          now,
        "updated_at":          now,
    }


# ---------------------------------------------------------------------------
# Upsert into dev.db
# ---------------------------------------------------------------------------

INSERT_SQL = """
INSERT INTO medications (
    name_ru, name_en, active_substance, atc_code, clinical_pharm_group, pharm_therapy_group,
    package_description, manufacturer, indications, contraindications, side_effects, interactions, pregnancy, lactation,
    icd10_codes, is_otc,
    overdose, child_dosing, child_using, renal_insuf, renal_using,
    hepato_insuf, hepato_using, special_instruction, pharmacokinetics, pharmacodynamics,
    forms, pediatric_dosing, full_instruction, is_favorite, created_at, updated_at
) VALUES (
    :name_ru, :name_en, :active_substance, :atc_code, :clinical_pharm_group, :pharm_therapy_group,
    :package_description, :manufacturer, :indications, :contraindications, :side_effects, :interactions, :pregnancy, :lactation,
    :icd10_codes, :is_otc,
    :overdose, :child_dosing, :child_using, :renal_insuf, :renal_using,
    :hepato_insuf, :hepato_using, :special_instruction, :pharmacokinetics, :pharmacodynamics,
    :forms, :pediatric_dosing, :full_instruction, :is_favorite, :created_at, :updated_at
)
"""

# При обновлении: Vidal-поля + базовые справочные поля; НЕ трогаем pediatric_dosing/forms/icd10_codes/is_favorite
# если они уже заполнены (т.е. != '[]' / NOT NULL)
UPDATE_SQL = """
UPDATE medications SET
    name_en              = :name_en,
    active_substance     = :active_substance,
    atc_code             = COALESCE(atc_code, :atc_code),
    package_description  = CASE
                              WHEN (package_description IS NULL OR TRIM(package_description) = '')
                              THEN :package_description
                              ELSE package_description
                           END,
    clinical_pharm_group = COALESCE(clinical_pharm_group, :clinical_pharm_group),
    pharm_therapy_group  = COALESCE(pharm_therapy_group, :pharm_therapy_group),
    manufacturer         = COALESCE(manufacturer, :manufacturer),
    indications          = :indications,
    contraindications    = :contraindications,
    side_effects         = :side_effects,
    interactions         = :interactions,
    pregnancy            = :pregnancy,
    icd10_codes          = CASE WHEN (icd10_codes IS NULL OR icd10_codes = '[]') THEN :icd10_codes ELSE icd10_codes END,
    is_otc               = :is_otc,
    overdose             = :overdose,
    child_dosing         = :child_dosing,
    child_using          = :child_using,
    renal_insuf          = :renal_insuf,
    renal_using          = :renal_using,
    hepato_insuf         = :hepato_insuf,
    hepato_using         = :hepato_using,
    special_instruction  = :special_instruction,
    pharmacokinetics     = :pharmacokinetics,
    pharmacodynamics     = :pharmacodynamics,
    forms                = CASE WHEN (forms IS NULL OR forms = '[]') THEN :forms ELSE forms END,
    pediatric_dosing     = CASE WHEN (pediatric_dosing IS NULL OR pediatric_dosing = '[]' OR pediatric_dosing LIKE '%</%') THEN :pediatric_dosing ELSE pediatric_dosing END,
    full_instruction     = COALESCE(:full_instruction, full_instruction),
    updated_at           = :updated_at
WHERE name_ru = :name_ru
"""


def upsert_batch(dest: sqlite3.Connection, batch: list[dict]) -> tuple[int, int, int]:
    """Returns (created, updated, errors)."""
    created = updated = errors = 0
    for med in batch:
        try:
            existing = dest.execute(
                "SELECT id FROM medications WHERE name_ru = ?",
                (med["name_ru"],)
            ).fetchone()
            if existing:
                dest.execute(UPDATE_SQL, med)
                updated += 1
            else:
                dest.execute(INSERT_SQL, med)
                created += 1
        except Exception as e:
            errors += 1
            print(f"\n  ⚠  Ошибка для '{med.get('name_ru', '?')}': {e}")
    return created, updated, errors


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    # Проверяем пути
    if not os.path.exists(VIDAL_DB):
        print(f"❌ vidal.db не найден: {VIDAL_DB}")
        sys.exit(1)

    dest_path = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "prisma", "dev.db"))
    if not os.path.exists(dest_path):
        print(f"❌ dev.db не найден: {dest_path}")
        sys.exit(1)

    print("=" * 60)
    print("TASK-004: Импорт препаратов из vidal.db")
    print(f"  Источник : {VIDAL_DB}")
    print(f"  Назначение: {dest_path}")
    print("=" * 60)

    vidal = sqlite3.connect(f"file:{VIDAL_DB}?mode=ro", uri=True)
    vidal.row_factory = sqlite3.Row
    dest  = sqlite3.connect(dest_path)
    dest.execute("PRAGMA journal_mode=WAL")
    dest.execute("PRAGMA synchronous=NORMAL")

    maps = load_lookups(vidal)

    # Загружаем все Documents
    documents = vidal.execute("""
        SELECT DocumentID, RusName, EngName,
               Indication, ContraIndication, SideEffects, Interaction, Lactation, Dosage,
               OverDosage, ChildInsuf, ChildInsufUsing,
               RenalInsuf, RenalInsufUsing, HepatoInsuf, HepatoInsufUsing,
               ElderlyInsuf, ElderlyInsufUsing,
               SpecialInstruction, PhKinetics, PhInfluence,
               StorageCondition, CompiledComposition
        FROM Document
        ORDER BY DocumentID
    """).fetchall()

    total = len(documents)
    print(f"\nДокументов к обработке: {total}")
    print("-" * 60)

    total_created = total_updated = total_errors = 0
    batch = []

    for idx, doc in enumerate(documents, 1):
        med = build_medication(doc, maps)
        batch.append(med)

        if len(batch) >= BATCH_SIZE or idx == total:
            dest.execute("BEGIN")
            try:
                c, u, e = upsert_batch(dest, batch)
                dest.execute("COMMIT")
                total_created += c
                total_updated += u
                total_errors  += e
            except Exception as ex:
                dest.execute("ROLLBACK")
                print(f"\n  ❌ Batch rollback: {ex}")
                total_errors += len(batch)

            # Прогресс
            pct = idx / total * 100
            print(f"\r  [{idx:5d}/{total}] {pct:5.1f}%  +created:{total_created}  ~updated:{total_updated}  err:{total_errors}", end="", flush=True)
            batch = []

    vidal.close()
    dest.close()

    print("\n" + "=" * 60)
    print("ГОТОВО")
    print(f"  Создано  : {total_created}")
    print(f"  Обновлено: {total_updated}")
    print(f"  Ошибок   : {total_errors}")
    print(f"  Итого    : {total_created + total_updated + total_errors} / {total}")
    print("=" * 60)

    if total_errors > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
