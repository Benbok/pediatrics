import json
import os
import re
import sqlite3
from html import unescape
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

VIDAL_DB = r"C:\Users\Arty\Desktop\ru.medsolutions\vidal.db"
OUT_DIR = r"C:\Users\Arty\Desktop\Django\pediatrics\src\modules\medications\data\budesonide"


def strip_html(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = re.sub(r"<[^>]+>", " ", str(value))
    text = unescape(text).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def clean_display_name(value: Optional[str]) -> str:
    text = strip_html(value) or ""
    text = text.replace("®", " ").replace("™", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def safe_filename(value: str) -> str:
    text = clean_display_name(value).lower().replace("ё", "е")
    text = re.sub(r"[^0-9a-zа-я_\- ]+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", "_", text).strip("_")
    return text or "medication"


def parse_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    try:
        return float(str(value).replace(",", "."))
    except Exception:
        return None


def parse_mass_to_mg(value: str, unit: str) -> Optional[float]:
    number = parse_float(value)
    if number is None:
        return None
    unit = unit.lower()
    if unit == "мг":
        return number
    if unit == "мкг":
        return round(number / 1000.0, 6)
    if unit == "г":
        return round(number * 1000.0, 6)
    return None


def infer_form_type(text: Optional[str]) -> str:
    t = (text or "").lower()
    if any(token in t for token in ("таб.", "таблет")):
        return "tablet"
    if "капс" in t:
        return "capsule"
    if "супп" in t:
        return "suppository"
    if any(token in t for token in ("сироп",)):
        return "syrup"
    if any(token in t for token in ("сусп", "суспенз")):
        return "suspension"
    if any(token in t for token in ("порошок", "лиофилизат")):
        return "powder"
    if "аэрозоль" in t:
        return "spray"
    if any(token in t for token in ("капли", "спрей наз", "интраназал")):
        return "drops"
    if any(token in t for token in ("раствор", "р-р", "концентрат")):
        return "solution"
    return "other"


def infer_route(text: Optional[str], atc_code: Optional[str]) -> Optional[str]:
    t = (text or "").lower()
    atc = (atc_code or "").upper()
    if any(token in t for token in ("ингаля", "турбухалер", "небулай")):
        return "inhalation"
    if any(token in t for token in ("назал", "интраназал")):
        return "intranasal"
    if any(token in t for token in ("внутрь", "перорал")):
        return "oral"
    if atc.startswith("R03"):
        return "inhalation"
    if atc.startswith("R01"):
        return "intranasal"
    if atc.startswith("A07"):
        return "oral"
    return None


def make_form_id(form_type: str, descriptor: Optional[str]) -> str:
    raw = f"{form_type}_{descriptor or 'na'}".lower().replace("ё", "е")
    raw = re.sub(r"[^0-9a-zа-я_]+", "_", raw, flags=re.IGNORECASE)
    raw = re.sub(r"_+", "_", raw).strip("_")
    return raw[:64] or f"{form_type}_1"


def split_package_segments(zip_info: Optional[str]) -> List[str]:
    clean = strip_html(zip_info)
    if not clean:
        return []
    parts = [segment.strip() for segment in clean.split("|") if segment.strip()]
    return parts if parts else [clean]


def parse_single_form(segment: str) -> Dict[str, Any]:
    form_type = infer_form_type(segment)
    form: Dict[str, Any] = {
        "id": make_form_id(form_type, segment),
        "type": form_type,
        "concentration": None,
        "unit": None,
        "description": segment,
    }

    combo_match = re.search(
        r"(\d+[\.,]?\d*)\s*(мкг|мг)\s*\+\s*(\d+[\.,]?\d*)\s*(мкг|мг)\s*/\s*(1\s*)?(мл|доза)",
        segment,
        re.IGNORECASE,
    )
    if combo_match:
        form["concentration"] = combo_match.group(0)
        if combo_match.group(6).lower() == "мл":
            form["unit"] = "ml"
        return form

    concentration_match = re.search(
        r"(\d+[\.,]?\d*)\s*(мкг|мг|г)\s*/\s*(1\s*)?(мл|доза)",
        segment,
        re.IGNORECASE,
    )
    if concentration_match:
        amount = concentration_match.group(1)
        amount_unit = concentration_match.group(2)
        per_unit = concentration_match.group(4).lower()
        form["concentration"] = concentration_match.group(0)
        if per_unit == "мл":
            form["unit"] = "ml"
            mg_value = parse_mass_to_mg(amount, amount_unit)
            if mg_value is not None:
                form["mgPerMl"] = mg_value
        else:
            form["unit"] = "mg"
            mg_value = parse_mass_to_mg(amount, amount_unit)
            if mg_value is not None:
                form["strengthMg"] = mg_value
        return form

    strength_match = re.search(r"(\d+[\.,]?\d*)\s*(мкг|мг|г)\b", segment, re.IGNORECASE)
    if strength_match:
        mg_value = parse_mass_to_mg(strength_match.group(1), strength_match.group(2))
        if mg_value is not None:
            form["unit"] = "mg"
            form["strengthMg"] = mg_value

    volume_match = re.search(r"(\d+[\.,]?\d*)\s*мл", segment, re.IGNORECASE)
    if volume_match:
        volume = parse_float(volume_match.group(1))
        if volume is not None:
            form["volumeMl"] = volume
            form["unit"] = form.get("unit") or "ml"

    return form


def parse_forms(zip_infos: Sequence[str]) -> List[Dict[str, Any]]:
    forms: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for zip_info in zip_infos:
        for segment in split_package_segments(zip_info):
            form = parse_single_form(segment)
            key = json.dumps(form, ensure_ascii=False, sort_keys=True)
            if key in seen:
                continue
            seen.add(key)
            forms.append(form)
    return forms


def choose_longest(values: Iterable[Optional[str]]) -> Optional[str]:
    cleaned = [strip_html(value) for value in values]
    cleaned = [value for value in cleaned if value]
    if not cleaned:
        return None
    return max(cleaned, key=len)


def choose_using(values: Iterable[Optional[str]]) -> Optional[str]:
    priority = {"Not": 4, "Care": 3, "Qwes": 2, "Can": 1}
    best = None
    best_score = -1
    for value in values:
        if value not in priority:
            continue
        score = priority[value]
        if score > best_score:
            best = value
            best_score = score
    return best


def split_indications(text: Optional[str]) -> List[str]:
    value = strip_html(text)
    if not value:
        return []
    chunks = [chunk.strip(" .") for chunk in re.split(r";|\.(?=\s+[А-ЯA-Z])", value) if chunk.strip()]
    unique: List[str] = []
    seen: set[str] = set()
    for chunk in chunks:
        key = chunk.lower()
        if key in seen:
            continue
        seen.add(key)
        unique.append(chunk)
    return unique


def build_full_instruction(block: Dict[str, Any]) -> Optional[str]:
    parts = [
        block.get("indication"),
        block.get("contraindication"),
        block.get("dosage"),
        block.get("side_effects"),
        block.get("interaction"),
        block.get("overdose"),
        block.get("special_instruction"),
        block.get("pharm_delivery"),
        block.get("ph_influence"),
        block.get("ph_kinetics"),
        block.get("pregnancy"),
        block.get("lactation"),
        block.get("renal_insuf"),
        block.get("hepato_insuf"),
        block.get("child_insuf"),
    ]
    cleaned = [strip_html(part) for part in parts if strip_html(part)]
    return "\n\n".join(cleaned) if cleaned else None


def fetch_products(conn: sqlite3.Connection) -> List[sqlite3.Row]:
    query = """
    SELECT DISTINCT
        p.ProductID,
        p.RusName,
        p.EngName,
        p.ZipInfo,
        p.Composition,
        p.NonPrescriptionDrug,
        pa.ATCCode
    FROM Product p
    JOIN Product_MoleculeName pmnf ON pmnf.ProductID = p.ProductID
    JOIN MoleculeName mnf ON mnf.MoleculeNameID = pmnf.MoleculeNameID
    LEFT JOIN Product_ATC pa ON pa.ProductID = p.ProductID
    WHERE lower(mnf.RusName) LIKE '%будесонид%'
      AND pa.ATCCode IS NOT NULL
    ORDER BY p.RusName, pa.ATCCode
    """
    return conn.execute(query).fetchall()


def fetch_product_molecules(conn: sqlite3.Connection, product_id: int) -> List[str]:
    rows = conn.execute(
        """
        SELECT DISTINCT mn.RusName
        FROM Product_MoleculeName pmn
        JOIN MoleculeName mn ON mn.MoleculeNameID = pmn.MoleculeNameID
        WHERE pmn.ProductID = ?
        ORDER BY mn.RusName
        """,
        (product_id,),
    ).fetchall()
    return [strip_html(row[0]) for row in rows if strip_html(row[0])]


def fetch_main_company(conn: sqlite3.Connection, product_id: int) -> Optional[str]:
    row = conn.execute(
        """
        SELECT c.LocalName
        FROM Product_Company pc
        JOIN Company c ON c.CompanyID = pc.CompanyID
        WHERE pc.ProductID = ? AND pc.ItsMainCompany = 1
        LIMIT 1
        """,
        (product_id,),
    ).fetchone()
    return strip_html(row[0]) if row else None


def fetch_docs(conn: sqlite3.Connection, product_id: int) -> List[Dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT
            d.DocumentID,
            d.Indication,
            d.ContraIndication,
            d.SideEffects,
            d.Interaction,
            d.Lactation,
            d.Dosage,
            d.OverDosage,
            d.SpecialInstruction,
            d.PharmDelivery,
            d.PhInfluence,
            d.PhKinetics,
            d.PregnancyUsing,
            d.NursingUsing,
            d.RenalInsuf,
            d.RenalInsufUsing,
            d.HepatoInsuf,
            d.HepatoInsufUsing,
            d.ChildInsuf,
            d.ChildInsufUsing
        FROM Product_Document pd
        JOIN Document d ON d.DocumentID = pd.DocumentID
        WHERE pd.ProductID = ?
        """,
        (product_id,),
    ).fetchall()
    result: List[Dict[str, Any]] = []
    for row in rows:
        result.append({
            "document_id": row[0],
            "indication": row[1],
            "contraindication": row[2],
            "side_effects": row[3],
            "interaction": row[4],
            "lactation": row[5],
            "dosage": row[6],
            "overdose": row[7],
            "special_instruction": row[8],
            "pharm_delivery": row[9],
            "ph_influence": row[10],
            "ph_kinetics": row[11],
            "pregnancy_using": row[12],
            "nursing_using": row[13],
            "renal_insuf": row[14],
            "renal_using": row[15],
            "hepato_insuf": row[16],
            "hepato_using": row[17],
            "child_insuf": row[18],
            "child_using": row[19],
        })
    return result


def fetch_icd_codes(conn: sqlite3.Connection, document_ids: Sequence[int]) -> List[str]:
    if not document_ids:
        return []
    placeholders = ",".join(["?"] * len(document_ids))
    query = f"""
    SELECT DISTINCT n.Code
    FROM Document_IndicNozology din
    JOIN Nozology n ON n.NozologyCode = din.NozologyCode
    WHERE din.DocumentID IN ({placeholders})
    ORDER BY n.Code
    """
    rows = conn.execute(query, tuple(document_ids)).fetchall()
    return [str(row[0]).strip().upper() for row in rows if row[0]]


def dedupe(items: Iterable[str]) -> List[str]:
    out: List[str] = []
    seen: set[str] = set()
    for item in items:
        if not item:
            continue
        value = item.strip()
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(value)
    return out


def aggregate_products(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    products = fetch_products(conn)
    grouped: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for product in products:
        product_id = int(product[0])
        raw_name = clean_display_name(product[1])
        atc_code = (product[6] or "").strip().upper()
        if not raw_name or not atc_code:
            continue

        key = (raw_name.lower(), atc_code)
        block = grouped.setdefault(key, {
            "name_ru": raw_name,
            "name_en": strip_html(product[2]),
            "atc_code": atc_code,
            "zip_infos": [],
            "otc_flags": [],
            "molecules": [],
            "manufacturers": [],
            "docs": [],
        })

        zip_info = strip_html(product[3])
        if zip_info:
            block["zip_infos"].append(zip_info)

        block["otc_flags"].append(1 if product[5] else 0)
        block["molecules"].extend(fetch_product_molecules(conn, product_id))

        company = fetch_main_company(conn, product_id)
        if company:
            block["manufacturers"].append(company)

        block["docs"].extend(fetch_docs(conn, product_id))

    return list(grouped.values())


def build_medication_payload(block: Dict[str, Any]) -> Dict[str, Any]:
    docs = block.get("docs", [])
    document_ids = [doc["document_id"] for doc in docs]

    # icd is filled later in caller with db query
    indications = split_indications(choose_longest([doc.get("indication") for doc in docs]))
    contraindications = choose_longest([doc.get("contraindication") for doc in docs]) or ""

    forms = parse_forms(block.get("zip_infos", []))
    route = infer_route(" | ".join(block.get("zip_infos", [])), block.get("atc_code"))

    payload: Dict[str, Any] = {
        "nameRu": block.get("name_ru"),
        "nameEn": block.get("name_en"),
        "activeSubstance": " + ".join(dedupe(block.get("molecules", []))) or block.get("name_ru"),
        "atcCode": block.get("atc_code"),
        "manufacturer": dedupe(block.get("manufacturers", []))[0] if dedupe(block.get("manufacturers", [])) else None,
        "clinicalPharmGroup": None,
        "pharmTherapyGroup": None,
        "packageDescription": " | ".join(dedupe(block.get("zip_infos", []))) or None,
        "forms": forms,
        "pediatricDosing": [],
        "adultDosing": [],
        "indications": indications,
        "contraindications": contraindications,
        "sideEffects": choose_longest([doc.get("side_effects") for doc in docs]),
        "pregnancy": choose_using([doc.get("pregnancy_using") for doc in docs]),
        "lactation": choose_longest([doc.get("lactation") for doc in docs]),
        "cautionConditions": None,
        "interactions": choose_longest([doc.get("interaction") for doc in docs]),
        "minInterval": None,
        "maxDosesPerDay": None,
        "maxDurationDays": None,
        "routeOfAdmin": route,
        "vidalUrl": None,
        "isOtc": bool(max(block.get("otc_flags", [0]))),
        "overdose": choose_longest([doc.get("overdose") for doc in docs]),
        "childDosing": choose_longest([doc.get("child_insuf") for doc in docs]),
        "childUsing": choose_using([doc.get("child_using") for doc in docs]),
        "renalInsuf": choose_longest([doc.get("renal_insuf") for doc in docs]),
        "renalUsing": choose_using([doc.get("renal_using") for doc in docs]),
        "hepatoInsuf": choose_longest([doc.get("hepato_insuf") for doc in docs]),
        "hepatoUsing": choose_using([doc.get("hepato_using") for doc in docs]),
        "specialInstruction": choose_longest([doc.get("special_instruction") for doc in docs]),
        "pharmacokinetics": choose_longest([doc.get("ph_kinetics") for doc in docs]),
        "pharmacodynamics": choose_longest([doc.get("ph_influence") for doc in docs]),
        "fullInstruction": build_full_instruction({
            "indication": choose_longest([doc.get("indication") for doc in docs]),
            "contraindication": choose_longest([doc.get("contraindication") for doc in docs]),
            "dosage": choose_longest([doc.get("dosage") for doc in docs]),
            "side_effects": choose_longest([doc.get("side_effects") for doc in docs]),
            "interaction": choose_longest([doc.get("interaction") for doc in docs]),
            "overdose": choose_longest([doc.get("overdose") for doc in docs]),
            "special_instruction": choose_longest([doc.get("special_instruction") for doc in docs]),
            "pharm_delivery": choose_longest([doc.get("pharm_delivery") for doc in docs]),
            "ph_influence": choose_longest([doc.get("ph_influence") for doc in docs]),
            "ph_kinetics": choose_longest([doc.get("ph_kinetics") for doc in docs]),
            "pregnancy": choose_using([doc.get("pregnancy_using") for doc in docs]),
            "lactation": choose_longest([doc.get("lactation") for doc in docs]),
            "renal_insuf": choose_longest([doc.get("renal_insuf") for doc in docs]),
            "hepato_insuf": choose_longest([doc.get("hepato_insuf") for doc in docs]),
            "child_insuf": choose_longest([doc.get("child_insuf") for doc in docs]),
        }),
        "icd10Codes": [],
        "_document_ids": document_ids,
    }

    return payload


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)

    conn = sqlite3.connect(VIDAL_DB)
    conn.row_factory = sqlite3.Row

    grouped = aggregate_products(conn)
    print(f"[budesonide] groups(name+atc): {len(grouped)}")

    written = 0
    for block in grouped:
        payload = build_medication_payload(block)
        document_ids = payload.pop("_document_ids", [])
        payload["icd10Codes"] = fetch_icd_codes(conn, document_ids)

        file_name = f"{safe_filename(payload['nameRu'])}_{payload['atcCode'].lower()}.json"
        path = os.path.join(OUT_DIR, file_name)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)
        written += 1

    conn.close()
    print(f"[budesonide] written: {written}")
    print(f"[budesonide] out dir: {OUT_DIR}")


if __name__ == "__main__":
    main()
