import json
import os
import re
import sqlite3
from html import unescape
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


VIDAL_DB = r"C:\Users\Arty\Desktop\ru.medsolutions\vidal.db"
OUT_DIR = r"C:\Users\Arty\Desktop\Django\pediatrics\src\modules\medications\data\bronchodilators"

# First-wave shortlist confirmed with the user: 49 strict bronchodilator import units.
FIRST_WAVE_SQL = r'''
WITH docs AS (
    SELECT DISTINCT
        p.RusName AS name_ru,
        pa.ATCCode AS atc_code,
        lower(COALESCE(d.ChildInsuf, '')) AS child_text,
        lower(COALESCE(d.Dosage, '')) AS dosage_text,
        COALESCE(d.ChildInsufUsing, '') AS child_using
    FROM Product p
    JOIN Product_ATC pa ON pa.ProductID = p.ProductID
    JOIN Product_Document pd ON pd.ProductID = p.ProductID
    JOIN Document d ON d.DocumentID = pd.DocumentID
    WHERE pa.ATCCode GLOB 'R03AC*'
       OR pa.ATCCode GLOB 'R03AL*'
       OR pa.ATCCode GLOB 'R03BB*'
       OR pa.ATCCode GLOB 'R03CC*'
       OR pa.ATCCode GLOB 'R03DA*'
       OR pa.ATCCode GLOB 'R03DB*'
), agg AS (
    SELECT
        name_ru,
        atc_code,
        MAX(CASE WHEN child_using IN ('Can', 'Care', 'Qwes') THEN 1 ELSE 0 END) AS has_child_section,
        MAX(CASE WHEN (
            child_text LIKE '%дет%' OR child_text LIKE '%мес%' OR child_text LIKE '%лет%' OR child_text LIKE '%новорож%'
            OR dosage_text LIKE '%дет%' OR dosage_text LIKE '%мес%' OR dosage_text LIKE '%лет%' OR dosage_text LIKE '%новорож%'
        ) THEN 1 ELSE 0 END) AS has_ped_signal,
        MAX(CASE WHEN (
            child_text LIKE '%мг/кг%' OR dosage_text LIKE '%мг/кг%'
            OR child_text LIKE '%мкг/кг%' OR dosage_text LIKE '%мкг/кг%'
            OR child_text LIKE '%мл/%' OR dosage_text LIKE '%мл/%'
            OR child_text LIKE '%доз%' OR dosage_text LIKE '%доз%'
            OR child_text LIKE '%ингаляц%' OR dosage_text LIKE '%ингаляц%'
        ) THEN 1 ELSE 0 END) AS has_dose_signal
    FROM docs
    GROUP BY name_ru, atc_code
)
SELECT name_ru, atc_code
FROM agg
WHERE has_child_section = 1
  AND has_ped_signal = 1
  AND has_dose_signal = 1
ORDER BY atc_code, name_ru
'''


def strip_html(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = re.sub(r"<[^>]+>", " ", str(value))
    text = unescape(text)
    text = text.replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def clean_display_name(value: Optional[str]) -> str:
    text = strip_html(value) or ""
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_spaces(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    text = str(value).replace("\xa0", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def normalize_using(value: Optional[str]) -> Optional[str]:
    return value if value in ("Can", "Care", "Not", "Qwes") else None


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


def safe_filename(value: str) -> str:
    text = clean_display_name(value).lower().replace("ё", "е")
    text = re.sub(r"[^0-9a-zа-я_\- ]+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s+", "_", text).strip("_")
    return text or "medication"


def build_full_instruction(doc: Dict[str, Any]) -> Optional[str]:
    parts = [
        strip_html(doc.get("indication")),
        strip_html(doc.get("contraindication")),
        strip_html(doc.get("dosage")),
        strip_html(doc.get("side_effects")),
        strip_html(doc.get("interaction")),
        strip_html(doc.get("overdose")),
        strip_html(doc.get("special_instruction")),
        strip_html(doc.get("pharmacodynamics")),
        strip_html(doc.get("pharmacokinetics")),
        strip_html(doc.get("pregnancy")),
        strip_html(doc.get("lactation")),
        strip_html(doc.get("renal_insuf")),
        strip_html(doc.get("hepato_insuf")),
        strip_html(doc.get("child_insuf")),
    ]
    clean_parts = [item for item in parts if item]
    return "\n\n".join(clean_parts) if clean_parts else None


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
        normalized = normalize_using(value)
        if not normalized:
            continue
        score = priority[normalized]
        if score > best_score:
            best = normalized
            best_score = score
    return best


def split_package_segments(zip_info: Optional[str]) -> List[str]:
    clean = normalize_spaces(strip_html(zip_info))
    if not clean:
        return []
    segments = [segment.strip() for segment in clean.split("|") if segment.strip()]
    return segments if segments else [clean]


def infer_form_type(text: Optional[str]) -> str:
    t = (text or "").lower()
    if any(token in t for token in ("р-р д/ингал", "раствор для ингал", "р-р д/в/в", "р-р д/приема внутрь", "раствор для приема внутрь")):
        return "solution"
    if any(token in t for token in ("таб.", "таблет")):
        return "tablet"
    if "капс" in t:
        return "capsule"
    if "сироп" in t:
        return "syrup"
    if any(token in t for token in ("сусп", "суспенз")):
        return "suspension"
    if any(token in t for token in ("капли", "капель")):
        return "drops"
    if any(token in t for token in ("аэрозоль", "ингалят", "турбухалер")):
        return "spray"
    if any(token in t for token in ("порошок д/ингал", "капс. с порошком д/ингал")):
        return "powder"
    if any(token in t for token in ("р-р", "раствор")):
        return "solution"
    return "other"


def infer_route(text: Optional[str]) -> Optional[str]:
    t = (text or "").lower()
    if any(token in t for token in ("ингаля", "ингал.", "небулайзер", "доза", "турбухалер")):
        return "inhalation"
    if any(token in t for token in ("внутрь", "приема внутрь", "per os", "перорал")):
        return "oral"
    if any(token in t for token in ("в/в", "внутрив")):
        return "iv_infusion"
    return None


def make_form_id(form_type: str, descriptor: Optional[str]) -> str:
    raw = f"{form_type}_{descriptor or 'na'}".lower()
    raw = raw.replace("ё", "е")
    raw = re.sub(r"[^0-9a-zа-я_]+", "_", raw, flags=re.IGNORECASE)
    raw = re.sub(r"_+", "_", raw).strip("_")
    return raw[:64] or f"{form_type}_1"


def parse_single_form(segment: str) -> Dict[str, Any]:
    form_type = infer_form_type(segment)
    form: Dict[str, Any] = {
        "id": make_form_id(form_type, segment),
        "type": form_type,
        "concentration": None,
        "unit": None,
        "description": segment,
    }

    combo_concentration = re.search(
        r"(\d+[\.,]?\d*)\s*(мкг|мг)\s*\+\s*(\d+[\.,]?\d*)\s*(мкг|мг)\s*/\s*(1\s*)?(мл|доза)",
        segment,
        re.IGNORECASE,
    )
    if combo_concentration:
        form["concentration"] = normalize_spaces(combo_concentration.group(0))
        if combo_concentration.group(6).lower() == "мл":
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
        form["concentration"] = normalize_spaces(concentration_match.group(0))
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
        volume_match = re.search(r"(\d+[\.,]?\d*)\s*мл", segment, re.IGNORECASE)
        if per_unit == "мл" and volume_match:
            form["volumeMl"] = parse_float(volume_match.group(1))
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


def extract_active_substance(compositions: Sequence[Optional[str]], fallback_name: str) -> str:
    names: List[str] = []
    for composition in compositions:
        html = composition or ""
        rows = re.findall(r"<TR>.*?<TD>(.*?)</TD>\s*<TD>(.*?)</TD>", html, flags=re.IGNORECASE | re.DOTALL)
        for left, _right in rows:
            candidate = strip_html(left)
            if not candidate:
                continue
            candidate = candidate.lstrip("•·-").strip()
            if not candidate:
                continue
            lower = candidate.lower()
            if lower.startswith("в пересчете") or lower.startswith("что соответствует"):
                continue
            if lower.startswith("[pring]"):
                continue
            if candidate not in names:
                names.append(candidate)
    if names:
        return " + ".join(names[:3])
    return fallback_name


def to_indications(value: Optional[str]) -> List[str]:
    text = strip_html(value)
    if not text:
        return []
    parts = [part.strip(" .") for part in re.split(r";|\.(?=\s+[А-ЯA-Z])", text) if part.strip()]
    unique: List[str] = []
    seen: set[str] = set()
    for part in parts:
        if len(part) < 3:
            continue
        if part in seen:
            continue
        seen.add(part)
        unique.append(part)
    return unique


def find_form(forms: Sequence[Dict[str, Any]], *, form_type: Optional[str] = None, contains: Optional[str] = None) -> Optional[Dict[str, Any]]:
    for form in forms:
        description = (form.get("description") or "").lower()
        if form_type and form.get("type") != form_type:
            continue
        if contains and contains.lower() not in description:
            continue
        return form
    return None


def build_salbutamol_rules(forms: Sequence[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    rules: List[Dict[str, Any]] = []
    top = {"minInterval": 4, "maxDosesPerDay": 8}
    aerosol_form = find_form(forms, contains="100 мкг/1 доза") or find_form(forms, contains="100 мкг/доза")
    if aerosol_form and aerosol_form.get("strengthMg"):
        strength = aerosol_form["strengthMg"]
        rules.append({
            "minAgeMonths": 24,
            "maxAgeMonths": 144,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": aerosol_form["id"],
            "unit": "mg",
            "dosing": {
                "type": "fixed",
                "fixedDose": {
                    "min": round(strength, 6),
                    "max": round(strength * 2, 6),
                    "unit": "mg",
                },
            },
            "routeOfAdmin": "inhalation",
            "timesPerDay": None,
            "intervalHours": 4,
            "maxSingleDose": round(strength * 2, 6),
            "maxSingleDosePerKg": None,
            "maxDailyDose": 0.8,
            "maxDailyDosePerKg": None,
            "instruction": "Детям от 2 до 12 лет: 100-200 мкг (1-2 ингаляции) при приступе бронхиальной астмы или для профилактики нагрузки/аллерген-индуцированного бронхоспазма. Суточная доза не должна превышать 800 мкг.",
        })
    return rules, top


def build_generic_r03ac_rules(forms: Sequence[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    rules: List[Dict[str, Any]] = []
    top = {"minInterval": 4, "maxDosesPerDay": 6}
    aerosol_form = find_form(forms, contains="45 мкг/доза")
    if aerosol_form and aerosol_form.get("strengthMg"):
        strength = aerosol_form["strengthMg"]
        rules.append({
            "minAgeMonths": 48,
            "maxAgeMonths": None,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": aerosol_form["id"],
            "unit": "mg",
            "dosing": {
                "type": "fixed",
                "fixedDose": {
                    "min": round(strength, 6),
                    "max": round(strength, 6),
                    "unit": "mg",
                },
            },
            "routeOfAdmin": "inhalation",
            "timesPerDay": None,
            "intervalHours": 4,
            "maxSingleDose": round(strength, 6),
            "maxSingleDosePerKg": None,
            "maxDailyDose": round(strength * 6, 6),
            "maxDailyDosePerKg": None,
            "instruction": "Взрослым и детям 4 лет и старше: 45 мкг каждые 4-6 часов. Некоторым пациентам может быть достаточно 45 мкг каждые 4 часа. Применение более 6 раз в сутки не рекомендуется.",
        })
    return rules, top


def build_fenoterol_rules(forms: Sequence[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    rules: List[Dict[str, Any]] = []
    top = {"maxDosesPerDay": 8}
    aerosol_form = find_form(forms, contains="100 мкг/1 доза") or find_form(forms, contains="100 мкг/доза")
    if aerosol_form and aerosol_form.get("strengthMg"):
        strength = aerosol_form["strengthMg"]
        rules.append({
            "minAgeMonths": 48,
            "maxAgeMonths": 72,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": aerosol_form["id"],
            "unit": "mg",
            "dosing": {
                "type": "fixed",
                "fixedDose": {
                    "min": round(strength, 6),
                    "max": round(strength, 6),
                    "unit": "mg",
                },
            },
            "routeOfAdmin": "inhalation",
            "timesPerDay": None,
            "intervalHours": None,
            "maxSingleDose": round(strength, 6),
            "maxSingleDosePerKg": None,
            "maxDailyDose": round(strength * 4, 6),
            "maxDailyDosePerKg": None,
            "instruction": "Детям 4-6 лет: 1 ингаляционная доза для купирования бронхоспазма или профилактики приступа физического усилия. Не более 4 ингаляций в сутки.",
        })
        rules.append({
            "minAgeMonths": 72,
            "maxAgeMonths": 144,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": aerosol_form["id"],
            "unit": "mg",
            "dosing": {
                "type": "fixed",
                "fixedDose": {
                    "min": round(strength, 6),
                    "max": round(strength * 2, 6),
                    "unit": "mg",
                },
            },
            "routeOfAdmin": "inhalation",
            "timesPerDay": None,
            "intervalHours": None,
            "maxSingleDose": round(strength * 2, 6),
            "maxSingleDosePerKg": None,
            "maxDailyDose": round(strength * 8, 6),
            "maxDailyDosePerKg": None,
            "instruction": "Детям 6-12 лет: обычно 1 ингаляционная доза; при недостаточном эффекте возможна повторная ингаляция. Для профилактики перед нагрузкой 1-2 дозы. Максимум 8 ингаляционных доз в сутки.",
        })
    return rules, top


def build_combo_berodual_rules(forms: Sequence[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    rules: List[Dict[str, Any]] = []
    top = {"maxDosesPerDay": 8}
    solution_form = find_form(forms, form_type="solution")
    aerosol_form = find_form(forms, form_type="spray")
    if solution_form:
        rules.append({
            "minAgeMonths": 72,
            "maxAgeMonths": 144,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": solution_form["id"],
            "unit": "ml",
            "dosing": {
                "type": "fixed",
                "fixedDose": {
                    "min": 0.5,
                    "max": 2.0,
                    "unit": "ml",
                },
            },
            "routeOfAdmin": "inhalation",
            "timesPerDay": 1,
            "intervalHours": None,
            "maxSingleDose": None,
            "maxSingleDosePerKg": None,
            "maxDailyDose": None,
            "maxDailyDosePerKg": None,
            "instruction": "Детям 6-12 лет при острых приступах бронхиальной астмы: 0.5-2 мл (10-40 капель) на ингаляцию через небулайзер; развести 0.9% NaCl до 3-4 мл непосредственно перед применением.",
        })
        rules.append({
            "minAgeMonths": 0,
            "maxAgeMonths": 72,
            "minWeightKg": None,
            "maxWeightKg": 22,
            "formId": solution_form["id"],
            "unit": "ml",
            "dosing": None,
            "routeOfAdmin": "inhalation",
            "timesPerDay": None,
            "intervalHours": None,
            "maxSingleDose": None,
            "maxSingleDosePerKg": None,
            "maxDailyDose": None,
            "maxDailyDosePerKg": None,
            "instruction": "Детям младше 6 лет (масса тела <22 кг): около 0.1 мл (2 капли) на кг массы тела на одну ингаляцию, но не более 0.5 мл (10 капель); применять только под медицинским наблюдением.",
        })
    if aerosol_form:
        rules.append({
            "minAgeMonths": 72,
            "maxAgeMonths": 216,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": aerosol_form["id"],
            "unit": "dose",
            "dosing": None,
            "routeOfAdmin": "inhalation",
            "timesPerDay": None,
            "intervalHours": None,
            "maxSingleDose": None,
            "maxSingleDosePerKg": None,
            "maxDailyDose": None,
            "maxDailyDosePerKg": None,
            "instruction": "Детям старше 6 лет: для купирования приступа 2 ингаляционные дозы; при отсутствии эффекта в течение 5 минут возможны еще 2 дозы. Для длительной/прерывистой терапии 1-2 ингаляции на прием, максимум 8 ингаляций в сутки.",
        })
    return rules, top


def build_ipratropium_rules(forms: Sequence[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    rules: List[Dict[str, Any]] = []
    top = {"maxDosesPerDay": 12}
    solution_form = find_form(forms, form_type="solution")
    aerosol_form = find_form(forms, form_type="spray")
    if solution_form and solution_form.get("mgPerMl"):
        rules.append({
            "minAgeMonths": 72,
            "maxAgeMonths": 144,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": solution_form["id"],
            "unit": "ml",
            "dosing": {
                "type": "fixed",
                "fixedDose": {
                    "min": 1.0,
                    "max": 1.0,
                    "unit": "ml",
                },
            },
            "routeOfAdmin": "inhalation",
            "timesPerDay": 4,
            "intervalHours": None,
            "maxSingleDose": 0.25,
            "maxSingleDosePerKg": None,
            "maxDailyDose": 1.0,
            "maxDailyDosePerKg": None,
            "instruction": "Детям 6-12 лет: по 1 мл (20 капель = 250 мкг) 3-4 раза в сутки через небулайзер. Максимальная суточная доза - 4 мл (1 мг).",
        })
        rules.append({
            "minAgeMonths": 0,
            "maxAgeMonths": 72,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": solution_form["id"],
            "unit": "ml",
            "dosing": {
                "type": "fixed",
                "fixedDose": {
                    "min": 0.4,
                    "max": 1.0,
                    "unit": "ml",
                },
            },
            "routeOfAdmin": "inhalation",
            "timesPerDay": 4,
            "intervalHours": None,
            "maxSingleDose": 0.25,
            "maxSingleDosePerKg": None,
            "maxDailyDose": 1.0,
            "maxDailyDosePerKg": None,
            "instruction": "Детям младше 6 лет: по 0.4-1 мл (8-20 капель = 100-250 мкг) 3-4 раза в сутки под медицинским наблюдением. Максимальная суточная доза - 4 мл (1 мг).",
        })
    if aerosol_form and aerosol_form.get("strengthMg"):
        strength = aerosol_form["strengthMg"]
        rules.append({
            "minAgeMonths": 72,
            "maxAgeMonths": 216,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": aerosol_form["id"],
            "unit": "mg",
            "dosing": {
                "type": "fixed",
                "fixedDose": {
                    "min": round(strength * 2, 6),
                    "max": round(strength * 2, 6),
                    "unit": "mg",
                },
            },
            "routeOfAdmin": "inhalation",
            "timesPerDay": 4,
            "intervalHours": None,
            "maxSingleDose": round(strength * 2, 6),
            "maxSingleDosePerKg": None,
            "maxDailyDose": round(strength * 12, 6),
            "maxDailyDosePerKg": None,
            "instruction": "Детям старше 6 лет: по 2 ингаляционные дозы 4 раза в сутки. Как правило, в течение суток не следует применять более 12 ингаляционных доз.",
        })
    return rules, top


def build_template_rules(name_ru: str, atc_code: str, forms: Sequence[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    if atc_code == "R03AC":
        return build_generic_r03ac_rules(forms)
    if atc_code == "R03AC02":
        return build_salbutamol_rules(forms)
    if atc_code == "R03AC04":
        return build_fenoterol_rules(forms)
    if atc_code == "R03AL01":
        return build_combo_berodual_rules(forms)
    if atc_code == "R03BB01":
        return build_ipratropium_rules(forms)
    return [], {}


def dedupe_rules(rules: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    unique: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for rule in rules:
        key = json.dumps(rule, ensure_ascii=False, sort_keys=True)
        if key in seen:
            continue
        seen.add(key)
        unique.append(rule)
    return unique


def fetch_first_wave(connection: sqlite3.Connection) -> List[Tuple[str, str]]:
    rows = connection.execute(FIRST_WAVE_SQL).fetchall()
    return [(row[0], row[1]) for row in rows]


def fetch_rows(connection: sqlite3.Connection) -> List[sqlite3.Row]:
    sql = r'''
    WITH shortlist AS (
        ''' + FIRST_WAVE_SQL + r'''
    )
    SELECT
        p.RusName AS product_name,
        p.EngName AS product_name_en,
        p.NonPrescriptionDrug AS is_otc,
        p.Composition AS composition,
        p.ZipInfo AS zip_info,
        pa.ATCCode AS atc_code,
        a.RusName AS atc_name,
        d.DocumentID AS document_id,
        d.RusName AS document_name_ru,
        d.EngName AS document_name_en,
        d.ClPhGrDescription AS clinical_group,
        d.PhInfluence AS pharmacodynamics,
        d.PhKinetics AS pharmacokinetics,
        d.Dosage AS dosage,
        d.OverDosage AS overdose,
        d.Interaction AS interaction,
        d.Lactation AS lactation,
        d.SideEffects AS side_effects,
        d.Indication AS indication,
        d.ContraIndication AS contraindication,
        d.SpecialInstruction AS special_instruction,
        d.PregnancyUsing AS pregnancy,
        d.NursingUsing AS lactation_using,
        d.RenalInsuf AS renal_insuf,
        d.RenalInsufUsing AS renal_using,
        d.HepatoInsuf AS hepato_insuf,
        d.HepatoInsufUsing AS hepato_using,
        d.ChildInsuf AS child_insuf,
        d.ChildInsufUsing AS child_using,
        (
            SELECT group_concat(DISTINCT ptg.Name)
            FROM Product_PhThGrp ppg
            JOIN PhThGroups ptg ON ptg.PhThGroupsID = ppg.PhThGroupsID
            WHERE ppg.ProductID = p.ProductID
        ) AS pharm_therapy_group
    FROM Product p
    JOIN Product_ATC pa ON pa.ProductID = p.ProductID
    JOIN shortlist s ON s.name_ru = p.RusName AND s.atc_code = pa.ATCCode
    LEFT JOIN ATC a ON a.ATCCode = pa.ATCCode
    LEFT JOIN Product_Document pd ON pd.ProductID = p.ProductID
    LEFT JOIN Document d ON d.DocumentID = pd.DocumentID
    ORDER BY pa.ATCCode, p.RusName, d.DocumentID
    '''
    return connection.execute(sql).fetchall()


def aggregate_records(rows: Sequence[sqlite3.Row]) -> List[Dict[str, Any]]:
    grouped: Dict[Tuple[str, str], Dict[str, Any]] = {}

    for row in rows:
        name_ru = clean_display_name(row["product_name"])
        atc_code = row["atc_code"]
        key = (name_ru, atc_code)
        bucket = grouped.setdefault(key, {
            "nameRu": name_ru,
            "nameEn": None,
            "atcCode": atc_code,
            "atcName": clean_display_name(row["atc_name"]),
            "productNames": [],
            "zipInfos": [],
            "compositions": [],
            "docs": [],
            "isOtcValues": [],
            "pharmTherapyValues": [],
        })

        if row["product_name"] and row["product_name"] not in bucket["productNames"]:
            bucket["productNames"].append(row["product_name"])
        if row["zip_info"]:
            bucket["zipInfos"].append(row["zip_info"])
        if row["composition"]:
            bucket["compositions"].append(row["composition"])
        if row["pharm_therapy_group"]:
            bucket["pharmTherapyValues"].append(row["pharm_therapy_group"])
        bucket["isOtcValues"].append(row["is_otc"])
        bucket["docs"].append({
            "document_id": row["document_id"],
            "name_ru": row["document_name_ru"],
            "name_en": row["document_name_en"],
            "clinical_group": row["clinical_group"],
            "pharmacodynamics": row["pharmacodynamics"],
            "pharmacokinetics": row["pharmacokinetics"],
            "dosage": row["dosage"],
            "overdose": row["overdose"],
            "interaction": row["interaction"],
            "lactation": row["lactation"],
            "side_effects": row["side_effects"],
            "indication": row["indication"],
            "contraindication": row["contraindication"],
            "special_instruction": row["special_instruction"],
            "pregnancy": row["pregnancy"],
            "lactation_using": row["lactation_using"],
            "renal_insuf": row["renal_insuf"],
            "renal_using": row["renal_using"],
            "hepato_insuf": row["hepato_insuf"],
            "hepato_using": row["hepato_using"],
            "child_insuf": row["child_insuf"],
            "child_using": row["child_using"],
        })

    records: List[Dict[str, Any]] = []
    for bucket in grouped.values():
        docs = bucket["docs"]
        forms = parse_forms(bucket["zipInfos"])
        route_candidates = {infer_route(form.get("description")) for form in forms}
        route_candidates.discard(None)
        route_of_admin = next(iter(route_candidates)) if len(route_candidates) == 1 else None
        template_rules, top_level_defaults = build_template_rules(bucket["nameRu"], bucket["atcCode"], forms)
        pediatric_rules = dedupe_rules(template_rules)
        active_substance = extract_active_substance(bucket["compositions"], bucket["nameRu"])

        record = {
            "nameRu": bucket["nameRu"],
            "nameEn": choose_longest([doc.get("name_en") for doc in docs]),
            "activeSubstance": active_substance,
            "atcCode": bucket["atcCode"],
            "manufacturer": None,
            "clinicalPharmGroup": choose_longest([doc.get("clinical_group") for doc in docs]),
            "pharmTherapyGroup": choose_longest(bucket["pharmTherapyValues"]) or bucket["atcName"],
            "packageDescription": " | ".join(split_package_segments(" | ".join(strip_html(item) or "" for item in bucket["zipInfos"]))) if bucket["zipInfos"] else None,
            "forms": forms,
            "pediatricDosing": pediatric_rules,
            "adultDosing": [],
            "indications": to_indications(choose_longest([doc.get("indication") for doc in docs])),
            "contraindications": choose_longest([doc.get("contraindication") for doc in docs]) or "См. инструкцию Vidal.",
            "sideEffects": choose_longest([doc.get("side_effects") for doc in docs]),
            "pregnancy": choose_longest([doc.get("pregnancy") for doc in docs]),
            "lactation": choose_longest([doc.get("lactation") for doc in docs]),
            "cautionConditions": None,
            "interactions": choose_longest([doc.get("interaction") for doc in docs]),
            "minInterval": top_level_defaults.get("minInterval"),
            "maxDosesPerDay": top_level_defaults.get("maxDosesPerDay"),
            "maxDurationDays": None,
            "routeOfAdmin": route_of_admin,
            "vidalUrl": None,
            "isOtc": any(value == 1 for value in bucket["isOtcValues"]),
            "overdose": choose_longest([doc.get("overdose") for doc in docs]),
            "childDosing": choose_longest([doc.get("child_insuf") for doc in docs]),
            "childUsing": choose_using([doc.get("child_using") for doc in docs]),
            "renalInsuf": choose_longest([doc.get("renal_insuf") for doc in docs]),
            "renalUsing": choose_using([doc.get("renal_using") for doc in docs]),
            "hepatoInsuf": choose_longest([doc.get("hepato_insuf") for doc in docs]),
            "hepatoUsing": choose_using([doc.get("hepato_using") for doc in docs]),
            "specialInstruction": choose_longest([doc.get("special_instruction") for doc in docs]),
            "pharmacokinetics": choose_longest([doc.get("pharmacokinetics") for doc in docs]),
            "pharmacodynamics": choose_longest([doc.get("pharmacodynamics") for doc in docs]),
            "fullInstruction": build_full_instruction(max(docs, key=lambda item: len(strip_html(item.get("dosage")) or ""), default={})),
            "icd10Codes": [],
        }
        records.append(record)

    records.sort(key=lambda item: (item["atcCode"] or "", item["nameRu"].lower()))
    return records


def write_records(records: Sequence[Dict[str, Any]]) -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for entry in os.listdir(OUT_DIR):
        if entry.endswith(".json"):
            os.remove(os.path.join(OUT_DIR, entry))

    used_names: Dict[str, int] = {}
    for record in records:
        base_name = f"{safe_filename(record['nameRu'])}_{(record.get('atcCode') or 'noatc').lower()}"
        counter = used_names.get(base_name, 0)
        used_names[base_name] = counter + 1
        file_stem = base_name if counter == 0 else f"{base_name}_{counter + 1}"
        file_name = f"{file_stem}.json"
        file_path = os.path.join(OUT_DIR, file_name)
        with open(file_path, "w", encoding="utf-8") as file:
            json.dump(record, file, ensure_ascii=False, indent=2)


def main() -> None:
    connection = sqlite3.connect(VIDAL_DB)
    connection.row_factory = sqlite3.Row
    try:
        shortlist = fetch_first_wave(connection)
        if len(shortlist) != 49:
            raise RuntimeError(f"Expected 49 first-wave bronchodilator units, got {len(shortlist)}")

        rows = fetch_rows(connection)
        records = aggregate_records(rows)
        if len(records) != 49:
            raise RuntimeError(f"Expected 49 generated records, got {len(records)}")

        write_records(records)

        with_pediatric = sum(1 for record in records if record.get("pediatricDosing"))
        print(f"Generated {len(records)} bronchodilator JSON files in {OUT_DIR}")
        print(f"Records with structured pediatricDosing: {with_pediatric}")
    finally:
        connection.close()


if __name__ == "__main__":
    main()