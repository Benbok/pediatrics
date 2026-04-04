import json
import os
import re
import sqlite3
from html import unescape

VIDAL_DB = r"C:\Users\Arty\Desktop\ru.medsolutions\vidal.db"
OUT_DIR = r"C:\Users\Arty\Desktop\Django\pediatrics\src\modules\medications\data\cephalosporins"

CEPHALOSPORIN_ATC_PREFIXES = ("J01DB", "J01DC", "J01DD", "J01DE", "J01DI")


def strip_html(value):
    if not value:
        return None
    text = re.sub(r"<[^>]+>", " ", value)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def to_title_case(s):
    if not s:
        return s
    return " ".join(w.capitalize() for w in s.strip().split())


def normalize_using(v):
    return v if v in ("Can", "Care", "Not", "Qwes") else None


def infer_form_type(text):
    t = (text or "").lower()
    if "капс" in t:
        return "capsule"
    if "таблет" in t:
        return "tablet"
    if "сироп" in t:
        return "syrup"
    if any(k in t for k in ("сусп", "суспенз")):
        return "suspension"
    if "лиофилизат" in t or "порошок" in t:
        return "powder"
    if "аэрозоль" in t:
        return "spray"
    if any(k in t for k in ("р-р д/ингал", "р-р д/инф", "раствор", "р-р")):
        return "solution"
    if "капли" in t:
        return "drops"
    if "гел" in t:
        return "gel"
    if "крем" in t:
        return "cream"
    if "маз" in t:
        return "ointment"
    if any(k in t for k in ("спрей", "spray")):
        return "spray"
    return "other"


def infer_route(text):
    t = (text or "").lower()
    if any(k in t for k in ("глазн", "офтальм", "конъюнктив", "ушные", "капли уш", "вагинальн")):
        return "topical"
    if any(k in t for k in ("назаль", "назал", "интраназал", "спрей назал")):
        return "intranasal"
    if any(k in t for k in ("сублингв", "подъязычн", "под язык")):
        return "sublingual"
    if any(k in t for k in ("трансдерм", "пластырь", "накожн")):
        return "transdermal"
    if any(k in t for k in ("ректальн", "суппозитор рект", "супп. рект", "рект.")):
        return "rectal"
    if any(k in t for k in ("ингаля", "аэрозоль д/ингал", "порошок д/ингал", "р-р д/ингал", "р-р д/ингаляций", "небулайзер")):
        return "inhalation"

    has_iv = "в/в" in t or "внутривенно" in t or "intravenous" in t
    has_bolus = any(k in t for k in ("струйно", "болюс", "iv bolus", "болюсно"))
    has_slow = any(k in t for k in ("медленно", "медленн", "iv slow"))
    has_infusion = any(k in t for k in (
        "капельно", "инфуз", "р-р д/инф", "р-р д/инфузий",
        "лиофилизат д/пригот. р-ра д/инф",
        "конц. д/пригот. р-ра д/инф",
        "концентрат д/пригот. р-ра д/инф",
    ))

    if has_iv and has_infusion:
        return "iv_infusion"
    if has_iv and has_bolus:
        return "iv_bolus"
    if has_iv and has_slow:
        return "iv_slow"
    if has_iv or has_infusion:
        return "iv_infusion"
    if "в/м" in t or "внутримышечн" in t or "intramuscular" in t:
        return "im"
    if any(k in t for k in ("п/к", "подкожн", "subcutaneous", "s/c")):
        return "sc"
    if any(k in t for k in ("наруж", "местн", "крем", "маз", "гель", "лосьон", "линимент", "шампун")):
        return "topical"
    if any(k in t for k in ("внутрь", "перорал", "per os", "оральн", "таб", "капс", "сироп", "суспенз", "гранул", "эликсир")):
        return "oral"
    return None


def parse_float(v):
    try:
        return float(str(v).replace(",", "."))
    except Exception:
        return None


def infer_age_range_months(text):
    t = (text or "").lower()
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
    if "недоношен" in t:
        return 0, 1
    if "новорожден" in t:
        return 0, 1
    return None, None


def infer_interval_hours(text):
    t = (text or "").lower()
    m = re.search(r"каждые\s*(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)\s*ч", t)
    if m:
        return parse_float(m.group(1)), parse_float(m.group(2))
    m = re.search(r"каждые\s*(\d+[\.,]?\d*)\s*ч", t)
    if m:
        val = parse_float(m.group(1))
        return val, val
    return None, None


def infer_times_per_day(interval_min):
    if not interval_min or interval_min <= 0:
        return None
    return max(1, int(round(24 / interval_min)))


def parse_pediatric_dosing(child_insuf, dosage_text, forms, route):
    sources = []
    child_text = strip_html(child_insuf)
    dose_text = strip_html(dosage_text)
    if child_text:
        sources.append(child_text)
    if dose_text:
        sources.append(dose_text)
    if not sources:
        return []

    full_text = " ; ".join(sources)
    chunks = [c.strip() for c in re.split(r"[;\n]", full_text) if c and len(c.strip()) > 8]

    form_id = forms[0]["id"] if forms else None
    route_val = route or "iv"
    rules = []
    seen = set()

    for chunk in chunks:
        min_age, max_age = infer_age_range_months(chunk)
        int_min, _ = infer_interval_hours(chunk)

        mgpk_min = mgpk_max = None
        m_range = re.search(r"(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)\s*мг\s*/\s*кг", chunk, re.IGNORECASE)
        if m_range:
            mgpk_min = parse_float(m_range.group(1))
            mgpk_max = parse_float(m_range.group(2))
        else:
            m_single = re.search(r"(\d+[\.,]?\d*)\s*мг\s*/\s*кг", chunk, re.IGNORECASE)
            if m_single:
                mgpk_min = parse_float(m_single.group(1))

        if mgpk_min is not None:
            m_then = re.search(r"затем\s*по\s*(\d+[\.,]?\d*)\s*мг\s*/\s*кг", chunk, re.IGNORECASE)
            if m_then:
                mgpk_min = parse_float(m_then.group(1))

        has_ped_signal = (
            "дет" in chunk.lower() or
            "новорожден" in chunk.lower() or
            "недоношен" in chunk.lower()
        )
        if mgpk_min is None and not has_ped_signal:
            continue

        interval_hours = int_min
        times_per_day = infer_times_per_day(interval_hours)
        rule = {
            "minAgeMonths": min_age,
            "maxAgeMonths": max_age,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": form_id,
            "unit": "mg",
            "dosing": {
                "type": "weight_based",
                "mgPerKg": mgpk_min,
                "maxMgPerKg": mgpk_max,
            } if mgpk_min is not None else None,
            "routeOfAdmin": route_val,
            "timesPerDay": times_per_day,
            "intervalHours": interval_hours,
            "maxSingleDose": None,
            "maxSingleDosePerKg": mgpk_max,
            "maxDailyDose": None,
            "maxDailyDosePerKg": (mgpk_min * times_per_day) if (mgpk_min is not None and times_per_day is not None) else None,
            "instruction": chunk,
        }

        dose_ok = rule.get("dosing") is not None and rule["dosing"].get("mgPerKg") is not None
        age_ok = rule.get("minAgeMonths") is not None or rule.get("maxAgeMonths") is not None
        if not dose_ok or not age_ok:
            continue

        key = (
            rule["minAgeMonths"],
            rule["maxAgeMonths"],
            (rule["dosing"] or {}).get("mgPerKg") if rule["dosing"] else None,
            rule["intervalHours"],
            (rule["instruction"] or "")[:120],
        )
        if key in seen:
            continue
        seen.add(key)
        rules.append(rule)

    return rules


def build_full_instruction(doc):
    parts = [
        strip_html(doc["Indication"]),
        strip_html(doc["ContraIndication"]),
        strip_html(doc["Dosage"]),
        strip_html(doc["SideEffects"]),
        strip_html(doc["Interaction"]),
        strip_html(doc["OverDosage"]),
        strip_html(doc["SpecialInstruction"]),
        strip_html(doc["PhInfluence"]),
        strip_html(doc["PhKinetics"]),
        strip_html(doc["PregnancyUsing"]),
        strip_html(doc["NursingUsing"]),
        strip_html(doc["RenalInsuf"]),
        strip_html(doc["HepatoInsuf"]),
        strip_html(doc["ChildInsuf"]),
        strip_html(doc["ElderlyInsuf"]),
        strip_html(doc["StorageCondition"]),
    ]
    parts = [p for p in parts if p and str(p).strip()]
    return "\n\n".join(parts) if parts else None


def parse_forms(zip_info, composition):
    source = " ".join([zip_info or "", strip_html(composition) or ""])
    if not source.strip():
        return []

    form_type = infer_form_type(zip_info or "")
    if form_type == "other":
        form_type = infer_form_type(source)

    concentration = None
    mg_per_ml = None
    volume_ml = None
    strength_mg = None

    m = re.search(r"(\d+[\.,]?\d*)\s*мг\s*/\s*(\d+[\.,]?\d*)\s*мл", source, flags=re.IGNORECASE)
    if m:
        mg = float(m.group(1).replace(",", "."))
        ml = float(m.group(2).replace(",", "."))
        if ml:
            mg_per_ml = round(mg / ml, 4)
            concentration = f"{m.group(1)} мг/{m.group(2)} мл"

    if concentration is None:
        m2 = re.search(r"(\d+[\.,]?\d*)\s*мг\s*/\s*мл", source, flags=re.IGNORECASE)
        if m2:
            concentration = f"{m2.group(1)} мг/мл"
            mg_per_ml = float(m2.group(1).replace(",", "."))

    m3 = re.search(r"(\d+[\.,]?\d*)\s*мл", source, flags=re.IGNORECASE)
    if m3:
        volume_ml = float(m3.group(1).replace(",", "."))

    m4 = re.search(r"(\d+[\.,]?\d*)\s*мг", source, flags=re.IGNORECASE)
    if m4 and "/" not in source[max(0, m4.start() - 3):m4.end() + 3]:
        strength_mg = float(m4.group(1).replace(",", "."))

    fid = re.sub(r"[^a-z0-9_]+", "_", f"{form_type}_{concentration or 'na'}").strip("_").lower()
    item = {
        "id": fid[:48] if fid else "form_1",
        "type": form_type,
        "concentration": concentration,
        "unit": "ml" if mg_per_ml is not None else ("mg" if strength_mg is not None else None),
        "description": strip_html(zip_info) or strip_html(composition),
    }
    if mg_per_ml is not None:
        item["mgPerMl"] = mg_per_ml
    if volume_ml is not None:
        item["volumeMl"] = volume_ml
    if strength_mg is not None and mg_per_ml is None:
        item["strengthMg"] = strength_mg

    return [item]


def split_indications(text):
    clean = strip_html(text)
    if not clean:
        return []
    parts = re.split(r";|\.\s+(?=[А-ЯA-Z])", clean)
    out = [p.strip(" .") for p in parts if p and len(p.strip()) > 3]
    return out[:20]


def slug(s):
    s = (s or "").lower()
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"[^a-z0-9]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "med"


def first_value(cur, sql, args=()):
    row = cur.execute(sql, args).fetchone()
    if not row:
        return None
    return row[0]


def many_values(cur, sql, args=()):
    rows = cur.execute(sql, args).fetchall()
    return [r[0] for r in rows if r and r[0] is not None]


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    db = sqlite3.connect(f"file:{VIDAL_DB}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    cur = db.cursor()

    where_atc = " OR ".join([f"patc.ATCCode LIKE '{prefix}%'" for prefix in CEPHALOSPORIN_ATC_PREFIXES])
    docs = cur.execute(
        f"""
        SELECT DISTINCT pd.DocumentID, d.RusName, d.EngName
        FROM Product_ATC patc
        JOIN Product_Document pd ON pd.ProductID = patc.ProductID
        JOIN Document d ON d.DocumentID = pd.DocumentID
        WHERE {where_atc}
        ORDER BY d.RusName, pd.DocumentID
        """
    ).fetchall()

    created = 0
    for doc in docs:
        doc_id = doc["DocumentID"]
        d = cur.execute(
            """
            SELECT DocumentID, RusName, EngName, Indication, ContraIndication, SideEffects, Interaction,
                   Lactation, NursingUsing, OverDosage,
                   ChildInsuf, ChildInsufUsing, RenalInsuf, RenalInsufUsing,
                   HepatoInsuf, HepatoInsufUsing, ElderlyInsuf, ElderlyInsufUsing,
                   SpecialInstruction, PhKinetics, PhInfluence, Dosage,
                   PregnancyUsing, StorageCondition
            FROM Document
            WHERE DocumentID = ?
            """,
            (doc_id,),
        ).fetchone()

        product = cur.execute(
            """
            SELECT p.ProductID, p.RusName, p.EngName, p.ZipInfo, p.Composition
            FROM Product p
            JOIN Product_Document pd ON pd.ProductID = p.ProductID
            WHERE pd.DocumentID = ?
            ORDER BY p.ProductID
            LIMIT 1
            """,
            (doc_id,),
        ).fetchone()

        all_zip_infos = many_values(cur, """
            SELECT DISTINCT p.ZipInfo
            FROM Product p
            JOIN Product_Document pd ON pd.ProductID = p.ProductID
            WHERE pd.DocumentID = ? AND p.ZipInfo IS NOT NULL
        """, (doc_id,))

        atc = first_value(cur, """
            SELECT patc.ATCCode
            FROM Product_Document pd
            JOIN Product_ATC patc ON patc.ProductID = pd.ProductID
            WHERE pd.DocumentID = ?
            ORDER BY pd.ProductID
            LIMIT 1
        """, (doc_id,))

        clph = first_value(cur, """
            SELECT cg.Name
            FROM Product_Document pd
            JOIN Product_ClPhGroups pcg ON pcg.ProductID = pd.ProductID
            JOIN ClPhGroups cg ON cg.ClPhGroupsID = pcg.ClPhGroupsID
            WHERE pd.DocumentID = ?
            LIMIT 1
        """, (doc_id,))

        phth = first_value(cur, """
            SELECT pg.Name
            FROM Product_Document pd
            JOIN Product_PhThGrp ppg ON ppg.ProductID = pd.ProductID
            JOIN PhThGroups pg ON pg.PhThGroupsID = ppg.PhThGroupsID
            WHERE pd.DocumentID = ?
            LIMIT 1
        """, (doc_id,))

        mfr = first_value(cur, """
            SELECT c.LocalName
            FROM Product_Document pd
            JOIN Product_Company pc ON pc.ProductID = pd.ProductID AND pc.ItsMainCompany = 1
            JOIN Company c ON c.CompanyID = pc.CompanyID
            WHERE pd.DocumentID = ?
            LIMIT 1
        """, (doc_id,))

        active = first_value(cur, """
            SELECT mn.RusName
            FROM Product_Document pd
            JOIN Product_MoleculeName pmn ON pmn.ProductID = pd.ProductID
            JOIN MoleculeName mn ON mn.MoleculeNameID = pmn.MoleculeNameID
            WHERE pd.DocumentID = ?
            LIMIT 1
        """, (doc_id,)) or to_title_case(d["RusName"])

        is_otc = first_value(cur, """
            SELECT MAX(p.NonPrescriptionDrug)
            FROM Product_Document pd
            JOIN Product p ON p.ProductID = pd.ProductID
            WHERE pd.DocumentID = ?
        """, (doc_id,))

        icd_codes = many_values(cur, """
            SELECT DISTINCT noz.Code
            FROM Document_IndicNozology din
            JOIN Nozology noz ON noz.NozologyCode = din.NozologyCode
            WHERE din.DocumentID = ?
            ORDER BY noz.Code
        """, (doc_id,))

        zip_info = product["ZipInfo"] if product else None
        composition = product["Composition"] if product else None
        forms = parse_forms(zip_info, composition)

        all_zip_combined = " ".join(z for z in all_zip_infos if z)
        inferred_route = (
            infer_route(all_zip_combined)
            or infer_route(all_zip_combined + " " + (d["Dosage"] or ""))
        )

        data = {
            "nameRu": to_title_case(strip_html(d["RusName"]) or d["RusName"]),
            "nameEn": to_title_case(d["EngName"]) if d["EngName"] else None,
            "activeSubstance": active,
            "atcCode": atc,
            "manufacturer": mfr,
            "clinicalPharmGroup": clph,
            "pharmTherapyGroup": phth,
            "packageDescription": strip_html(zip_info),
            "forms": forms,
            "pediatricDosing": parse_pediatric_dosing(d["ChildInsuf"], d["Dosage"], forms, inferred_route),
            "adultDosing": [],
            "indications": split_indications(d["Indication"]),
            "contraindications": strip_html(d["ContraIndication"]),
            "sideEffects": strip_html(d["SideEffects"]),
            "pregnancy": strip_html(d["Lactation"]),
            "lactation": strip_html(d["Lactation"]),
            "cautionConditions": None,
            "interactions": strip_html(d["Interaction"]),
            "minInterval": None,
            "maxDosesPerDay": None,
            "maxDurationDays": None,
            "routeOfAdmin": inferred_route,
            "vidalUrl": None,
            "isOtc": bool(is_otc),
            "overdose": strip_html(d["OverDosage"]),
            "childDosing": strip_html(d["ChildInsuf"]),
            "childUsing": normalize_using(d["ChildInsufUsing"]),
            "renalInsuf": strip_html(d["RenalInsuf"]),
            "renalUsing": normalize_using(d["RenalInsufUsing"]),
            "hepatoInsuf": strip_html(d["HepatoInsuf"]),
            "hepatoUsing": normalize_using(d["HepatoInsufUsing"]),
            "specialInstruction": strip_html(d["SpecialInstruction"]),
            "pharmacokinetics": strip_html(d["PhKinetics"]),
            "pharmacodynamics": strip_html(d["PhInfluence"]),
            "icd10Codes": icd_codes,
            "fullInstruction": build_full_instruction(d),
        }

        file_name = f"doc_{doc_id}_{slug(d['EngName']) or slug(d['RusName'])}.json"
        out_path = os.path.join(OUT_DIR, file_name)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        created += 1

    db.close()
    print(f"Generated {created} files in: {OUT_DIR}")


if __name__ == "__main__":
    main()
