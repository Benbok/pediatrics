#!/usr/bin/env python3
"""
TASK-004: Импорт препаратов из vidal.db в dev.db

Стратегия:
- Один Document = одна запись Medication (уровень МНН)
- Idempotent: проверяем по nameRu. Если существует — обновляем
  Vidal-поля, НЕ трогая pediatricDosing/adultDosing/forms/isFavorite/icd10Codes
  (если они уже заполнены вручную, т.е. != '[]' или null)
- HTML-контент сохраняется as-is (dangerouslySetInnerHTML используется во фронте)
- Batching: COMMIT каждые 200 записей
"""

import sqlite3
import json
import re
import sys
import os
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
    if not html:
        return html
    text = re.sub(r"<[^>]+>", "", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


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
        "name_en":             doc["EngName"] or None,
        "active_substance":    maps["molecule"].get(doc_id) or to_title_case(doc["RusName"]),
        "atc_code":            maps["atc"].get(doc_id),
        "clinical_pharm_group": maps["clph"].get(doc_id),
        "pharm_therapy_group": maps["phth"].get(doc_id),
        "manufacturer":        maps["mfr"].get(doc_id),
        "indications":         strip_html(doc["Indication"]),
        "contraindications":   doc["ContraIndication"] or "",  # NOT NULL — fallback пустая строка
        "side_effects":        doc["SideEffects"] or None,
        "interactions":        doc["Interaction"] or None,
        "pregnancy":           doc["Lactation"] or None,
        "lactation":           None,
        "icd10_codes":         json.dumps(icd_codes, ensure_ascii=False),
        "is_otc":              1 if maps["otc"].get(doc_id, False) else 0,
        # TASK-003 Vidal fields
        "overdose":            doc["OverDosage"] or None,
        "child_dosing":        doc["ChildInsuf"] or None,
        "child_using":         normalize_using(doc["ChildInsufUsing"]),
        "renal_insuf":         doc["RenalInsuf"] or None,
        "renal_using":         normalize_using(doc["RenalInsufUsing"]),
        "hepato_insuf":        doc["HepatoInsuf"] or None,
        "hepato_using":        normalize_using(doc["HepatoInsufUsing"]),
        "special_instruction": doc["SpecialInstruction"] or None,
        "pharmacokinetics":    doc["PhKinetics"] or None,
        "pharmacodynamics":    doc["PhInfluence"] or None,
        # Empty/defaults for fields we can't populate from vidal.db
        "forms":               json.dumps([]),
        "pediatric_dosing":    json.dumps([]),
        "adult_dosing":        None,
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
    manufacturer, indications, contraindications, side_effects, interactions, pregnancy, lactation,
    icd10_codes, is_otc,
    overdose, child_dosing, child_using, renal_insuf, renal_using,
    hepato_insuf, hepato_using, special_instruction, pharmacokinetics, pharmacodynamics,
    forms, pediatric_dosing, adult_dosing, is_favorite, created_at, updated_at
) VALUES (
    :name_ru, :name_en, :active_substance, :atc_code, :clinical_pharm_group, :pharm_therapy_group,
    :manufacturer, :indications, :contraindications, :side_effects, :interactions, :pregnancy, :lactation,
    :icd10_codes, :is_otc,
    :overdose, :child_dosing, :child_using, :renal_insuf, :renal_using,
    :hepato_insuf, :hepato_using, :special_instruction, :pharmacokinetics, :pharmacodynamics,
    :forms, :pediatric_dosing, :adult_dosing, :is_favorite, :created_at, :updated_at
)
"""

# При обновлении: Vidal-поля + базовые справочные поля; НЕ трогаем pediatric_dosing/adult_dosing/forms/icd10_codes/is_favorite
# если они уже заполнены (т.е. != '[]' / NOT NULL)
UPDATE_SQL = """
UPDATE medications SET
    name_en              = :name_en,
    active_substance     = :active_substance,
    atc_code             = COALESCE(atc_code, :atc_code),
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
    pediatric_dosing     = CASE WHEN (pediatric_dosing IS NULL OR pediatric_dosing = '[]') THEN :pediatric_dosing ELSE pediatric_dosing END,
    adult_dosing         = CASE WHEN (adult_dosing IS NULL OR adult_dosing = '[]' OR adult_dosing = '') THEN :adult_dosing ELSE adult_dosing END,
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
            print(f"\n  ⚠  Ошибка для '{med.get('nameRu', '?')}': {e}")
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
               Indication, ContraIndication, SideEffects, Interaction, Lactation,
               OverDosage, ChildInsuf, ChildInsufUsing,
               RenalInsuf, RenalInsufUsing, HepatoInsuf, HepatoInsufUsing,
               SpecialInstruction, PhKinetics, PhInfluence
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
