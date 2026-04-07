import json
import os
import re
import sqlite3
from html import unescape
from typing import Dict, List, Optional, Tuple

VIDAL_DB = r"C:\Users\Arty\Desktop\ru.medsolutions\vidal.db"
OUT_BASE_DIR = r"C:\Users\Arty\Desktop\Django\pediatrics\src\modules\medications\data"

ATC_TO_DIR = {
    "R06AX13": "loratadine",
    "R06AE09": "levocetirizine",
    "R06AX27": "desloratadine",
}


def strip_html(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    text = re.sub(r"<[^>]+>", " ", value)
    text = unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def to_title_case(s: Optional[str]) -> Optional[str]:
    if not s:
        return s
    return " ".join(w.capitalize() for w in s.strip().split())


def clean_display_name(value: Optional[str]) -> str:
    text = strip_html(value) or ""
    text = text.replace("®", " ").replace("™", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


def normalize_using(v: Optional[str]) -> Optional[str]:
    return v if v in ("Can", "Care", "Not", "Qwes") else None


def infer_form_type(text: Optional[str]) -> str:
    t = (text or "").lower()
    if "супп" in t:
        return "suppository"
    if any(k in t for k in ("таблет", "таб.")):
        return "tablet"
    if "капс" in t:
        return "capsule"
    if "сироп" in t:
        return "syrup"
    if any(k in t for k in ("сусп", "суспенз")):
        return "suspension"
    if "гранул" in t:
        return "granules"
    if "лиофилизат" in t or "порошок" in t:
        return "powder"
    if "аэрозоль" in t:
        return "spray"
    if any(k in t for k in ("р-р д/ингал", "р-р д/инф", "раствор", "р-р", "концентрат")):
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


def infer_route(text: Optional[str]) -> Optional[str]:
    t = (text or "").lower()
    if any(k in t for k in ("глазн", "офтальм", "конъюнктив", "ушные", "капли уш", "вагинальн")):
        return "topical"
    if any(k in t for k in ("назаль", "назал", "интраназал", "спрей назал")):
        return "intranasal"
    if any(k in t for k in ("сублингв", "подъязычн", "под язык")):
        return "sublingual"
    if any(k in t for k in ("трансдерм", "пластырь", "накожн")):
        return "transdermal"
    if any(k in t for k in ("ректальн", "суппозитор", "супп. рект", "рект.")):
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


def parse_float(v: str) -> Optional[float]:
    try:
        return float(str(v).replace(",", "."))
    except Exception:
        return None


def to_months(value: int, unit: str) -> int:
    ul = unit.lower()
    if ul.startswith("лет") or ul.startswith("год"):
        return value * 12
    return value


def find_contraindicated_upper_months(text: str) -> Optional[int]:
    t = re.sub(r"\s+", " ", (text or "").lower())
    m = re.search(r"противопоказ[^\.\n]{0,220}?до\s*(\d+)\s*(мес(?:яц(?:ев|а)?)?|лет|года?)", t)
    if not m:
        return None
    return to_months(int(m.group(1)), m.group(2))


def find_allowed_min_age_months(text: str) -> Optional[int]:
    t = re.sub(r"\s+", " ", (text or "").lower())
    values: List[int] = []

    for m in re.finditer(r"дет[^\.\n]{0,220}?от\s*(\d+)\s*(мес(?:яц(?:ев|а)?)?|лет|года?)", t):
        values.append(to_months(int(m.group(1)), m.group(2)))

    for m in re.finditer(r"дет[^\.\n]{0,220}?старше\s*(\d+)\s*(мес(?:яц(?:ев|а)?)?|лет|года?)", t):
        values.append(to_months(int(m.group(1)), m.group(2)))

    if not values:
        return None
    return min(values)


def infer_age_range_months(text: str) -> Tuple[Optional[int], Optional[int], bool]:
    t = (text or "").lower()
    min_age = None
    max_age = None
    from_contra = False

    m = re.search(r"от\s*(\d+)\s*меся\w*\s*до\s*(\d+)\s*лет", t)
    if m:
        return int(m.group(1)), int(m.group(2)) * 12, False
    m = re.search(r"от\s*(\d+)\s*до\s*(\d+)\s*меся", t)
    if m:
        return int(m.group(1)), int(m.group(2)), False
    m = re.search(r"от\s*(\d+)\s*(?:г(?:ода|од|лет)?|лет)?\s*до\s*(\d+)\s*лет", t)
    if m:
        return int(m.group(1)) * 12, int(m.group(2)) * 12, False
    m = re.search(r"от\s*(\d+)\s*лет\s*до\s*(\d+)\s*лет", t)
    if m:
        return int(m.group(1)) * 12, int(m.group(2)) * 12, False
    m = re.search(r"с\s*(\d+)\s*до\s*(\d+)\s*лет", t)
    if m:
        return int(m.group(1)) * 12, int(m.group(2)) * 12, False

    m = re.search(r"(\d+)\s*[-–]\s*(\d+)\s*лет", t)
    if m:
        return int(m.group(1)) * 12, int(m.group(2)) * 12, False

    m = re.search(r"до\s*(\d+)\s*меся", t)
    if m:
        min_age, max_age, from_contra = 0, int(m.group(1)), True
    m = re.search(r"в возрасте до\s*(\d+)\s*меся", t)
    if m:
        min_age, max_age, from_contra = 0, int(m.group(1)), True
    m = re.search(r"до\s*(\d+)\s*лет", t)
    if m:
        min_age, max_age, from_contra = 0, int(m.group(1)) * 12, True

    m = re.search(r"старше\s*(\d+)\s*лет", t)
    if m:
        min_age = int(m.group(1)) * 12
        max_age = None
        from_contra = False

    if "недоношен" in t or "новорожден" in t:
        return 0, 1, False

    return min_age, max_age, from_contra


def infer_interval_hours(text: str) -> Tuple[Optional[float], Optional[float]]:
    t = (text or "").lower()
    m = re.search(r"каждые\s*(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)\s*ч", t)
    if m:
        return parse_float(m.group(1)), parse_float(m.group(2))
    m = re.search(r"каждые\s*(\d+[\.,]?\d*)\s*ч", t)
    if m:
        val = parse_float(m.group(1))
        return val, val
    return None, None


def infer_times_per_day(interval_min: Optional[float]) -> Optional[int]:
    if not interval_min or interval_min <= 0:
        return None
    return max(1, int(round(24 / interval_min)))


def parse_pediatric_dosing(child_insuf: Optional[str], dosage_text: Optional[str], forms: List[Dict], route: Optional[str], full_instruction: Optional[str]) -> List[Dict]:
    sources: List[str] = []
    child_text = strip_html(child_insuf)
    dose_text = strip_html(dosage_text)
    if child_text:
        sources.append(child_text)
    if dose_text:
        sources.append(dose_text)
    if not sources:
        return []

    full_text = " ; ".join([*(sources or []), strip_html(full_instruction) or ""]).strip(" ;")
    contraindicated_upper = find_contraindicated_upper_months(full_text)
    allowed_min = find_allowed_min_age_months(full_text)
    effective_min = allowed_min if allowed_min is not None else contraindicated_upper

    base_text = " ; ".join(sources)
    chunks = [c.strip() for c in re.split(r"[;\n]", base_text) if c and len(c.strip()) > 8]
    child_chunks = [m.group(0).strip() for m in re.finditer(r"дет[^;\n]{0,280}", base_text, re.IGNORECASE)]

    ordered_chunks: List[str] = []
    seen_chunks = set()
    for chunk in [*child_chunks, *chunks]:
        normalized = re.sub(r"\s+", " ", chunk).strip().lower()
        if len(normalized) < 8 or normalized in seen_chunks:
            continue
        seen_chunks.add(normalized)
        ordered_chunks.append(chunk)

    default_form = forms[0] if forms else {}
    form_id = default_form.get("id")
    route_val = route or "oral"

    rules: List[Dict] = []
    seen = set()

    for chunk in ordered_chunks:
        lower_chunk = chunk.lower()

        # Mixed pediatric instructions in one chunk should become separate rules.
        # Example: ">6 years: 5 mg once daily" and "2-6 years: 1.25 mg twice daily".
        mixed_older = re.search(r"старше\s*6\s*лет", lower_chunk)
        mixed_younger = re.search(r"2\s*[-–]\s*6\s*лет|от\s*2\s*до\s*6\s*лет", lower_chunk)
        if mixed_older and mixed_younger:
            older_match = re.search(
                r"старше\s*6\s*лет[^\.;]{0,160}?по\s*(\d+[\.,]?\d*)\s*мг[^\.;]{0,120}?(\d+)\s*раз",
                lower_chunk,
                re.IGNORECASE,
            )
            younger_match = re.search(
                r"(?:2\s*[-–]\s*6\s*лет|от\s*2\s*до\s*6\s*лет)[^\.;]{0,200}?по\s*(\d+[\.,]?\d*)\s*мг[^\.;]{0,120}?(\d+)\s*раз",
                lower_chunk,
                re.IGNORECASE,
            )

            if older_match and younger_match:
                older_dose = parse_float(older_match.group(1))
                older_tpd = int(older_match.group(2))
                younger_dose = parse_float(younger_match.group(1))
                younger_tpd = int(younger_match.group(2))

                if older_dose is not None and younger_dose is not None:
                    older_rule = {
                        "minAgeMonths": 72,
                        "maxAgeMonths": None,
                        "minWeightKg": None,
                        "maxWeightKg": None,
                        "formId": form_id,
                        "unit": "mg",
                        "dosing": {
                            "type": "fixed",
                            "fixedDose": {
                                "min": older_dose,
                                "max": older_dose,
                                "unit": "mg",
                            },
                        },
                        "routeOfAdmin": route_val,
                        "timesPerDay": older_tpd,
                        "intervalHours": round(24 / older_tpd, 2) if older_tpd > 0 else None,
                        "maxSingleDose": older_dose,
                        "maxSingleDosePerKg": None,
                        "maxDailyDose": older_dose * older_tpd if older_tpd > 0 else None,
                        "maxDailyDosePerKg": None,
                        "instruction": chunk,
                    }

                    younger_rule = {
                        "minAgeMonths": 24,
                        "maxAgeMonths": 72,
                        "minWeightKg": None,
                        "maxWeightKg": None,
                        "formId": form_id,
                        "unit": "mg",
                        "dosing": {
                            "type": "fixed",
                            "fixedDose": {
                                "min": younger_dose,
                                "max": younger_dose,
                                "unit": "mg",
                            },
                        },
                        "routeOfAdmin": route_val,
                        "timesPerDay": younger_tpd,
                        "intervalHours": round(24 / younger_tpd, 2) if younger_tpd > 0 else None,
                        "maxSingleDose": younger_dose,
                        "maxSingleDosePerKg": None,
                        "maxDailyDose": younger_dose * younger_tpd if younger_tpd > 0 else None,
                        "maxDailyDosePerKg": None,
                        "instruction": chunk,
                    }

                    for rule in (older_rule, younger_rule):
                        key = (
                            rule["minAgeMonths"],
                            rule["maxAgeMonths"],
                            None,
                            None,
                            rule["maxSingleDose"],
                            None,
                            None,
                            "mg",
                            None,
                            rule["timesPerDay"],
                        )
                        if key in seen:
                            continue
                        seen.add(key)
                        rules.append(rule)
                    continue

        min_age, max_age, from_contra = infer_age_range_months(chunk)
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

        iu_single = None
        iu_daily = None
        fixed_single = None
        fixed_unit = None
        fixed_min = None
        fixed_max = None

        me_single = re.search(r"суппозитор\w*\s*(\d+)\s*(?:[мm][еe]|[мm]?е)", chunk, re.IGNORECASE)
        if me_single:
            iu_single = int(me_single.group(1))

        me_daily_range = re.search(r"(\d+)\s*[-–]\s*(\d+)\s*(?:[мm][еe]|[мm]?е)\s*/\s*сут", chunk, re.IGNORECASE)
        if me_daily_range:
            iu_daily = int(me_daily_range.group(1))
        else:
            me_daily_single = re.search(r"(\d+)\s*(?:[мm][еe]|[мm]?е)\s*/\s*сут", chunk, re.IGNORECASE)
            if me_daily_single:
                iu_daily = int(me_daily_single.group(1))

        fixed_range_mg = re.search(r"(\d+[\.,]?\d*)\s*[-–]\s*(\d+[\.,]?\d*)\s*мг(?!\s*/\s*кг)", chunk, re.IGNORECASE)
        fixed_single_mg_all = re.findall(r"(?:по\s*)?(\d+[\.,]?\d*)\s*мг(?!\s*/\s*кг)", chunk, re.IGNORECASE)
        fixed_match = re.search(r"(?:по\s*)?(\d+[\.,]?\d*)\s*(мл|кап(?:ель|ли)?|таб(?:\.|лет\w*)?)", chunk, re.IGNORECASE)
        if fixed_range_mg:
            lo = parse_float(fixed_range_mg.group(1))
            hi = parse_float(fixed_range_mg.group(2))
            if lo is not None and hi is not None:
                fixed_min = min(lo, hi)
                fixed_max = max(lo, hi)
                fixed_unit = "mg"
        elif fixed_single_mg_all:
            mg_values = [parse_float(v) for v in fixed_single_mg_all]
            mg_values = [v for v in mg_values if v is not None]
            if mg_values:
                has_child_range = re.search(r"от\s*\d+\s*(?:г(?:ода|од|лет)?|лет)?\s*до\s*\d+\s*лет", chunk.lower()) is not None
                fixed_single = min(mg_values) if has_child_range else mg_values[0]
                fixed_unit = "mg"
        elif fixed_match:
            fixed_single = parse_float(fixed_match.group(1))
            raw_unit = fixed_match.group(2).lower()
            if raw_unit.startswith("мл"):
                fixed_unit = "ml"
            elif raw_unit.startswith("кап"):
                fixed_unit = "drops"
            else:
                fixed_unit = "tablet"

        times_per_day = None
        m_tpd = re.search(r"(\d+)\s*раза?\s*/\s*сут", chunk, re.IGNORECASE)
        if m_tpd:
            times_per_day = int(m_tpd.group(1))
        if times_per_day is None:
            m_tpd2 = re.search(r"(\d+)\s*раза?\s*в\s*(?:день|сутки|сут)", chunk, re.IGNORECASE)
            if m_tpd2:
                times_per_day = int(m_tpd2.group(1))
        if times_per_day is None:
            times_per_day = infer_times_per_day(int_min)

        interval_hours = int_min
        if interval_hours is None and times_per_day and times_per_day > 0:
            interval_hours = round(24 / times_per_day, 2)

        has_ped_signal = (
            "дет" in chunk.lower() or
            "новорожден" in chunk.lower() or
            "недоношен" in chunk.lower()
        )

        has_weight_based = mgpk_min is not None
        has_fixed_iu = iu_single is not None or iu_daily is not None
        has_fixed_dose = (fixed_single is not None and fixed_unit is not None) or (fixed_min is not None and fixed_max is not None and fixed_unit is not None)
        if not has_weight_based and not has_fixed_iu and not has_fixed_dose and not has_ped_signal:
            continue

        if has_fixed_dose and not has_weight_based:
            dosing = {
                "type": "fixed",
                "fixedDose": {
                    "min": fixed_min if fixed_min is not None else fixed_single,
                    "max": fixed_max if fixed_max is not None else fixed_single,
                    "unit": fixed_unit,
                },
            }
        elif has_fixed_iu and not has_weight_based:
            dosing = {"type": "fixed"}
        else:
            dosing = {
                "type": "weight_based",
                "mgPerKg": mgpk_min,
                "maxMgPerKg": mgpk_max,
            }

        if from_contra and effective_min is not None:
            min_age = effective_min
            max_age = None
        elif min_age is None and effective_min is not None:
            min_age = effective_min

        rule = {
            "minAgeMonths": min_age,
            "maxAgeMonths": max_age,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": form_id,
            "unit": "IU" if has_fixed_iu else (fixed_unit if has_fixed_dose and fixed_unit else "mg"),
            "dosing": dosing,
            "routeOfAdmin": route_val,
            "timesPerDay": times_per_day,
            "intervalHours": interval_hours,
            "maxSingleDose": iu_single if has_fixed_iu else fixed_single,
            "maxSingleDosePerKg": mgpk_max,
            "maxDailyDose": iu_daily if has_fixed_iu else ((fixed_single * times_per_day) if (fixed_single is not None and times_per_day is not None) else None),
            "maxDailyDosePerKg": (mgpk_min * times_per_day) if (mgpk_min is not None and times_per_day is not None) else None,
            "instruction": chunk,
        }

        dose_ok = has_weight_based or has_fixed_iu or has_fixed_dose
        age_ok = rule.get("minAgeMonths") is not None or rule.get("maxAgeMonths") is not None
        if not dose_ok or not age_ok:
            continue

        key = (
            rule["minAgeMonths"],
            rule["maxAgeMonths"],
            iu_single,
            iu_daily,
            fixed_single,
            fixed_min,
            fixed_max,
            fixed_unit,
            (rule["dosing"] or {}).get("mgPerKg") if rule["dosing"] else None,
            rule["timesPerDay"],
        )
        if key in seen:
            continue
        seen.add(key)
        rules.append(rule)

    if rules:
        return rules

    if effective_min is not None:
        return [{
            "minAgeMonths": effective_min,
            "maxAgeMonths": None,
            "minWeightKg": None,
            "maxWeightKg": None,
            "formId": form_id,
            "unit": default_form.get("unit") or "mg",
            "dosing": None,
            "routeOfAdmin": route_val,
            "timesPerDay": None,
            "intervalHours": None,
            "maxSingleDose": None,
            "maxSingleDosePerKg": None,
            "maxDailyDose": None,
            "maxDailyDosePerKg": None,
            "instruction": child_text or dose_text or "",
        }]

    return []


def build_full_instruction(doc: sqlite3.Row) -> Optional[str]:
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


def parse_forms(zip_info: Optional[str], composition: Optional[str]) -> List[Dict]:
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

    strength_part = f"{int(strength_mg)}mg" if strength_mg is not None else "na"
    fid = re.sub(r"[^a-z0-9_]+", "_", f"{form_type}_{concentration or strength_part}").strip("_").lower()
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


def split_indications(text: Optional[str]) -> List[str]:
    clean = strip_html(text)
    if not clean:
        return []
    parts = re.split(r";|\.\s+(?=[А-ЯA-Z])", clean)
    out = [p.strip(" .") for p in parts if p and len(p.strip()) > 3]
    return out[:20]


def slug(s: Optional[str]) -> str:
    s = (s or "").lower()
    s = re.sub(r"<[^>]+>", "", s)
    s = unescape(s)
    s = re.sub(r"[^a-z0-9а-яё]+", "_", s)
    s = re.sub(r"_+", "_", s).strip("_")
    return s or "med"


def first_value(cur: sqlite3.Cursor, sql: str, args=()):
    row = cur.execute(sql, args).fetchone()
    if not row:
        return None
    return row[0]


def many_values(cur: sqlite3.Cursor, sql: str, args=()) -> List[str]:
    rows = cur.execute(sql, args).fetchall()
    return [r[0] for r in rows if r and r[0] is not None]


def placeholders(values: List) -> str:
    return ", ".join(["?"] * len(values))


def load_doc(cur: sqlite3.Cursor, doc_id: int):
    return cur.execute(
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


def choose_representative_doc(docs: List[sqlite3.Row]):
    def score(doc: sqlite3.Row) -> int:
        parts = [
            strip_html(doc["Indication"]),
            strip_html(doc["Dosage"]),
            strip_html(doc["ContraIndication"]),
            strip_html(doc["SideEffects"]),
            strip_html(doc["Interaction"]),
            strip_html(doc["SpecialInstruction"]),
            strip_html(doc["ChildInsuf"]),
            strip_html(doc["RenalInsuf"]),
            strip_html(doc["HepatoInsuf"]),
        ]
        return sum(len(p) for p in parts if p)

    return max(docs, key=lambda doc: (score(doc), doc["DocumentID"]))


def choose_single_value(values: List[str]) -> Optional[str]:
    unique_values = []
    seen = set()
    for value in values:
        clean = strip_html(value) if isinstance(value, str) else value
        if not clean or clean in seen:
            continue
        seen.add(clean)
        unique_values.append(clean)
    if len(unique_values) == 1:
        return unique_values[0]
    return None


def choose_active_substance(values: List[str], fallback: str) -> str:
    cleaned = []
    seen = set()
    for value in values:
        clean = strip_html(value)
        if not clean or clean in seen:
            continue
        seen.add(clean)
        cleaned.append(clean)
    if cleaned:
        return sorted(cleaned, key=lambda value: (len(value), value))[0]
    return fallback


def dedupe_strings(values) -> List[str]:
    out = []
    seen = set()
    for value in values:
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def main() -> None:
    for folder in ATC_TO_DIR.values():
        os.makedirs(os.path.join(OUT_BASE_DIR, folder), exist_ok=True)

    db = sqlite3.connect(f"file:{VIDAL_DB}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    cur = db.cursor()

    atc_codes = tuple(ATC_TO_DIR.keys())
    atc_placeholders = placeholders(list(atc_codes))

    groups = cur.execute(
        f"""
        SELECT DISTINCT p.RusName, patc.ATCCode
        FROM Product p
        JOIN Product_ATC patc ON patc.ProductID = p.ProductID
        WHERE patc.ATCCode IN ({atc_placeholders})
        ORDER BY patc.ATCCode, p.RusName
        """,
        atc_codes,
    ).fetchall()

    created = 0
    for group in groups:
        rus_name = group["RusName"]
        atc_code = group["ATCCode"]

        product_ids = [
            row[0] for row in cur.execute(
                """
                SELECT DISTINCT p.ProductID
                FROM Product p
                JOIN Product_ATC patc ON patc.ProductID = p.ProductID
                WHERE p.RusName = ?
                  AND patc.ATCCode = ?
                ORDER BY p.ProductID
                """,
                (rus_name, atc_code),
            ).fetchall()
        ]
        if not product_ids:
            continue

        product_placeholders = placeholders(product_ids)

        doc_ids = [
            row[0] for row in cur.execute(
                f"""
                SELECT DISTINCT pd.DocumentID
                FROM Product_Document pd
                WHERE pd.ProductID IN ({product_placeholders})
                ORDER BY pd.DocumentID
                """,
                tuple(product_ids),
            ).fetchall()
        ]
        if not doc_ids:
            continue

        doc_placeholders = placeholders(doc_ids)
        docs = [load_doc(cur, doc_id) for doc_id in doc_ids]
        docs = [doc for doc in docs if doc]
        if not docs:
            continue

        representative_doc = choose_representative_doc(docs)

        all_zip_infos = many_values(cur, f"""
            SELECT DISTINCT p.ZipInfo
            FROM Product p
            WHERE p.ProductID IN ({product_placeholders})
              AND p.ZipInfo IS NOT NULL
            ORDER BY p.ProductID
        """, tuple(product_ids))

        all_product_forms = cur.execute(f"""
            SELECT DISTINCT p.ZipInfo, p.Composition
            FROM Product p
            WHERE p.ProductID IN ({product_placeholders})
              AND p.ZipInfo IS NOT NULL
            ORDER BY p.ProductID
        """, tuple(product_ids)).fetchall()

        manufacturers = many_values(cur, f"""
            SELECT DISTINCT c.LocalName
            FROM Product_Company pc
            JOIN Company c ON c.CompanyID = pc.CompanyID
            WHERE pc.ProductID IN ({product_placeholders})
              AND pc.ItsMainCompany = 1
            ORDER BY c.LocalName
        """, tuple(product_ids))

        clinical_groups = many_values(cur, f"""
            SELECT DISTINCT cg.Name
            FROM Product_ClPhGroups pcg
            JOIN ClPhGroups cg ON cg.ClPhGroupsID = pcg.ClPhGroupsID
            WHERE pcg.ProductID IN ({product_placeholders})
            ORDER BY cg.Name
        """, tuple(product_ids))

        therapy_groups = many_values(cur, f"""
            SELECT DISTINCT pg.Name
            FROM Product_PhThGrp ppg
            JOIN PhThGroups pg ON pg.PhThGroupsID = ppg.PhThGroupsID
            WHERE ppg.ProductID IN ({product_placeholders})
            ORDER BY pg.Name
        """, tuple(product_ids))

        molecule_names = many_values(cur, f"""
            SELECT DISTINCT mn.RusName
            FROM Product_MoleculeName pmn
            JOIN MoleculeName mn ON mn.MoleculeNameID = pmn.MoleculeNameID
            WHERE pmn.ProductID IN ({product_placeholders})
            ORDER BY mn.RusName
        """, tuple(product_ids))

        is_otc = first_value(cur, f"""
            SELECT MAX(p.NonPrescriptionDrug)
            FROM Product p
            WHERE p.ProductID IN ({product_placeholders})
        """, tuple(product_ids))

        icd_codes = many_values(cur, f"""
            SELECT DISTINCT noz.Code
            FROM Document_IndicNozology din
            JOIN Nozology noz ON noz.NozologyCode = din.NozologyCode
            WHERE din.DocumentID IN ({doc_placeholders})
            ORDER BY noz.Code
        """, tuple(doc_ids))

        forms = []
        seen_form_keys = set()
        for product_form in all_product_forms:
            for form in parse_forms(product_form["ZipInfo"], product_form["Composition"]):
                key = (form.get("type"), form.get("concentration"), form.get("strengthMg"))
                if key in seen_form_keys:
                    continue
                seen_form_keys.add(key)
                forms.append(form)

        routes = dedupe_strings(
            infer_route(text)
            for text in ([*all_zip_infos, representative_doc["Dosage"]])
        )
        route_of_admin = routes[0] if len(routes) == 1 else None

        indications = []
        seen_indications = set()
        for doc in docs:
            for item in split_indications(doc["Indication"]):
                if item in seen_indications:
                    continue
                seen_indications.add(item)
                indications.append(item)

        package_description = " | ".join([
            form.get("description", "")
            for form in forms
            if form.get("description")
        ])

        cleaned_name = clean_display_name(rus_name)
        full_instruction = build_full_instruction(representative_doc)
        active_substance = choose_active_substance(molecule_names, to_title_case(cleaned_name or rus_name))

        data = {
            "nameRu": to_title_case(cleaned_name or rus_name),
            "nameEn": to_title_case(representative_doc["EngName"]) if representative_doc["EngName"] else None,
            "activeSubstance": active_substance,
            "atcCode": atc_code,
            "manufacturer": choose_single_value(manufacturers),
            "clinicalPharmGroup": choose_single_value(clinical_groups) or (strip_html(clinical_groups[0]) if clinical_groups else None),
            "pharmTherapyGroup": choose_single_value(therapy_groups) or (strip_html(therapy_groups[0]) if therapy_groups else None),
            "packageDescription": package_description or None,
            "forms": forms,
            "pediatricDosing": parse_pediatric_dosing(representative_doc["ChildInsuf"], representative_doc["Dosage"], forms, route_of_admin, full_instruction),
            "adultDosing": [],
            "indications": indications,
            "contraindications": strip_html(representative_doc["ContraIndication"]),
            "sideEffects": strip_html(representative_doc["SideEffects"]),
            "pregnancy": strip_html(representative_doc["PregnancyUsing"]),
            "lactation": strip_html(representative_doc["NursingUsing"] or representative_doc["Lactation"]),
            "cautionConditions": None,
            "interactions": strip_html(representative_doc["Interaction"]),
            "minInterval": None,
            "maxDosesPerDay": None,
            "maxDurationDays": None,
            "routeOfAdmin": route_of_admin,
            "vidalUrl": None,
            "isOtc": bool(is_otc),
            "overdose": strip_html(representative_doc["OverDosage"]),
            "childDosing": strip_html(representative_doc["ChildInsuf"]),
            "childUsing": normalize_using(representative_doc["ChildInsufUsing"]),
            "renalInsuf": strip_html(representative_doc["RenalInsuf"]),
            "renalUsing": normalize_using(representative_doc["RenalInsufUsing"]),
            "hepatoInsuf": strip_html(representative_doc["HepatoInsuf"]),
            "hepatoUsing": normalize_using(representative_doc["HepatoInsufUsing"]),
            "specialInstruction": strip_html(representative_doc["SpecialInstruction"]),
            "pharmacokinetics": strip_html(representative_doc["PhKinetics"]),
            "pharmacodynamics": strip_html(representative_doc["PhInfluence"]),
            "icd10Codes": icd_codes,
            "fullInstruction": full_instruction,
        }

        clean_name = clean_display_name(rus_name) or rus_name
        file_name = f"{slug(clean_name)}_{slug(atc_code)}.json"
        out_dir = os.path.join(OUT_BASE_DIR, ATC_TO_DIR[atc_code])
        out_path = os.path.join(out_dir, file_name)

        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        print(f"  -> {ATC_TO_DIR[atc_code]}/{file_name} ({len(forms)} forms, route={route_of_admin})")
        created += 1

    db.close()
    print(f"\nGenerated {created} files across: {', '.join(sorted(set(ATC_TO_DIR.values())))}")


if __name__ == "__main__":
    main()
