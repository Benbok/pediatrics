#!/usr/bin/env python3
"""
TASK-048: Fix pediatric dosing records for all mucolytics (R05CB) in dev.db
Based on vidal-db documents audit.

Groups fixed:
  R05CB06 — Амброксол (ids 6260–6267): vidal-db Doc 118, 31041, 59253
  R05CB02 — Бромгексин (ids 6274–6279, 6281): instruction text correction
  R05CB01 — Ацетилцистеин (ids 6268–6273): vidal-db Doc 53227, 56981
  R05CB03 — Карбоцистеин (ids 6280, 6282, 6283): vidal-db Doc 19787, 58808
"""

import sqlite3
import json
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(__file__), '..', 'prisma', 'dev.db')

# ─── Ambroxol standard dosing (R05CB06, non-retard) ──────────────────────────
# Source: vidal-db Document 118 (МНН АМБРОКСОЛ), Document 31041 (Амбробене сироп),
#         Document 59253 (Лазолван р-р 15мг/5мл)
AMBROXOL_STANDARD_PD_SYRUP_15_5 = [
    {
        "minAgeMonths": 0, "maxAgeMonths": 24,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "syrup_15_5",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 2, "intervalHours": 12.0,
        "maxSingleDose": 7.5, "maxSingleDosePerKg": None,
        "maxDailyDose": 15.0, "maxDailyDosePerKg": None,
        "instruction": "До 2 лет: 7,5 мг (2,5 мл сиропа 15 мг/5 мл) 2 раза/сут (15 мг/сут). Лечение только под контролем врача. (vidal-db Doc 31041)"
    },
    {
        "minAgeMonths": 24, "maxAgeMonths": 72,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "syrup_15_5",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 3, "intervalHours": 8.0,
        "maxSingleDose": 7.5, "maxSingleDosePerKg": None,
        "maxDailyDose": 22.5, "maxDailyDosePerKg": None,
        "instruction": "2–5 лет: 7,5 мг (2,5 мл сиропа 15 мг/5 мл) 3 раза/сут (22,5 мг/сут). (vidal-db Doc 31041)"
    },
    {
        "minAgeMonths": 60, "maxAgeMonths": 144,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "syrup_15_5",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 3, "intervalHours": 8.0,
        "maxSingleDose": 15.0, "maxSingleDosePerKg": None,
        "maxDailyDose": 45.0, "maxDailyDosePerKg": None,
        "instruction": "5–12 лет: 15 мг (5 мл сиропа 15 мг/5 мл) 2–3 раза/сут (30–45 мг/сут). (vidal-db Doc 31041)"
    }
]

AMBROXOL_STANDARD_PD_SOLUTION_15_5 = [
    {
        "minAgeMonths": 0, "maxAgeMonths": 24,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "solution_15_5",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 2, "intervalHours": 12.0,
        "maxSingleDose": 7.5, "maxSingleDosePerKg": None,
        "maxDailyDose": 15.0, "maxDailyDosePerKg": None,
        "instruction": "До 2 лет: 7,5 мг (2,5 мл раствора 15 мг/5 мл) 2 раза/сут (15 мг/сут). Лечение только под контролем врача. (vidal-db Doc 59253)"
    },
    {
        "minAgeMonths": 24, "maxAgeMonths": 72,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "solution_15_5",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 3, "intervalHours": 8.0,
        "maxSingleDose": 7.5, "maxSingleDosePerKg": None,
        "maxDailyDose": 22.5, "maxDailyDosePerKg": None,
        "instruction": "2–5 лет: 7,5 мг (2,5 мл раствора 15 мг/5 мл) 3 раза/сут (22,5 мг/сут). (vidal-db Doc 59253)"
    },
    {
        "minAgeMonths": 60, "maxAgeMonths": 144,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "solution_15_5",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 3, "intervalHours": 8.0,
        "maxSingleDose": 15.0, "maxSingleDosePerKg": None,
        "maxDailyDose": 45.0, "maxDailyDosePerKg": None,
        "instruction": "5–12 лет: 15 мг (5 мл раствора 15 мг/5 мл) 2–3 раза/сут (30–45 мг/сут). (vidal-db Doc 59253)"
    }
]

AMBROXOL_STANDARD_PD_SOLUTION_7_5_1 = [
    {
        "minAgeMonths": 0, "maxAgeMonths": 24,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "solution_7_5_1",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 2, "intervalHours": 12.0,
        "maxSingleDose": 7.5, "maxSingleDosePerKg": None,
        "maxDailyDose": 15.0, "maxDailyDosePerKg": None,
        "instruction": "До 2 лет: 7,5 мг (1 мл р-ра 7,5 мг/мл) 2 раза/сут (15 мг/сут). Лечение только под контролем врача. (vidal-db Doc 118)"
    },
    {
        "minAgeMonths": 24, "maxAgeMonths": 72,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "solution_7_5_1",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 3, "intervalHours": 8.0,
        "maxSingleDose": 7.5, "maxSingleDosePerKg": None,
        "maxDailyDose": 22.5, "maxDailyDosePerKg": None,
        "instruction": "2–5 лет: 7,5 мг (1 мл р-ра 7,5 мг/мл) 3 раза/сут (22,5 мг/сут). (vidal-db Doc 118)"
    },
    {
        "minAgeMonths": 60, "maxAgeMonths": 144,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "solution_7_5_1",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 3, "intervalHours": 8.0,
        "maxSingleDose": 15.0, "maxSingleDosePerKg": None,
        "maxDailyDose": 45.0, "maxDailyDosePerKg": None,
        "instruction": "5–12 лет: 15 мг (2 мл р-ра 7,5 мг/мл) 2–3 раза/сут (30–45 мг/сут). (vidal-db Doc 118)"
    }
]

# Tablets only — approved from 6 years (per instructions, tablets contraindicated <6y)
AMBROXOL_TABLET_PD = [
    {
        "minAgeMonths": 72, "maxAgeMonths": 144,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "tablet_30mg",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 3, "intervalHours": 8.0,
        "maxSingleDose": 15.0, "maxSingleDosePerKg": None,
        "maxDailyDose": 45.0, "maxDailyDosePerKg": None,
        "instruction": "6–12 лет: 15 мг (1/2 таб. 30 мг) 2–3 раза/сут (30–45 мг/сут). До 6 лет таблетки противопоказаны. (vidal-db Doc 118)"
    }
]

# Ambroxol Retard — contraindicated <12 years
AMBROXOL_RETARD_PD = [
    {
        "minAgeMonths": 144, "maxAgeMonths": None,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "capsule_75mg",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 1, "intervalHours": 24.0,
        "maxSingleDose": 75.0, "maxSingleDosePerKg": None,
        "maxDailyDose": 75.0, "maxDailyDosePerKg": None,
        "instruction": "Противопоказан до 12 лет. От 12 лет (≥144 мес): 75 мг 1 раз/сут. (vidal-db Doc 118)"
    }
]

# ─── Bromhexine FIXED dosing (R05CB02) ───────────────────────────────────────
# Source: instruction text in dev-db (already correct in text, numeric fields were wrong)
def make_bromhexin_pd(form_id):
    return [
        {
            "minAgeMonths": 0, "maxAgeMonths": 24,
            "minWeightKg": None, "maxWeightKg": None,
            "formId": form_id,
            "unit": "mg", "dosing": {"type": "fixed"},
            "routeOfAdmin": "oral",
            "timesPerDay": 3, "intervalHours": 8.0,
            "maxSingleDose": 2.0, "maxSingleDosePerKg": None,
            "maxDailyDose": 6.0, "maxDailyDosePerKg": None,
            "instruction": "До 2 лет: 2 мг 3 раза/сут (6 мг/сут)."
        },
        {
            "minAgeMonths": 24, "maxAgeMonths": 72,
            "minWeightKg": None, "maxWeightKg": None,
            "formId": form_id,
            "unit": "mg", "dosing": {"type": "fixed"},
            "routeOfAdmin": "oral",
            "timesPerDay": 3, "intervalHours": 8.0,
            "maxSingleDose": 4.0, "maxSingleDosePerKg": None,
            "maxDailyDose": 12.0, "maxDailyDosePerKg": None,
            "instruction": "2–6 лет: 4 мг 3 раза/сут (12 мг/сут)."
        },
        {
            "minAgeMonths": 72, "maxAgeMonths": 120,
            "minWeightKg": None, "maxWeightKg": None,
            "formId": form_id,
            "unit": "mg", "dosing": {"type": "fixed"},
            "routeOfAdmin": "oral",
            "timesPerDay": 3, "intervalHours": 8.0,
            "maxSingleDose": 8.0, "maxSingleDosePerKg": None,
            "maxDailyDose": 24.0, "maxDailyDosePerKg": None,
            "instruction": "6–10 лет: 6–8 мг 3 раза/сут (18–24 мг/сут)."
        },
        {
            "minAgeMonths": 120, "maxAgeMonths": 144,
            "minWeightKg": None, "maxWeightKg": None,
            "formId": form_id,
            "unit": "mg", "dosing": {"type": "fixed"},
            "routeOfAdmin": "oral",
            "timesPerDay": 4, "intervalHours": 6.0,
            "maxSingleDose": 8.0, "maxSingleDosePerKg": None,
            "maxDailyDose": 32.0, "maxDailyDosePerKg": None,
            "instruction": "10–12 лет: 8 мг 3–4 раза/сут (24–32 мг/сут) — как взрослые."
        }
    ]

# ─── Acetylcysteine dosing (R05CB01) ─────────────────────────────────────────
# Source: vidal-db Document 53227 (Флуимуцил гранулы 200мг)
# Note: contraindicated <2 years (24 months)
def make_acetylcysteine_pd(form_id_100, form_id_200):
    """Standard acetylcysteine dosing for products with 100mg and/or 200mg forms."""
    entries = []
    if form_id_100:
        entries.append({
            "minAgeMonths": 24, "maxAgeMonths": 72,
            "minWeightKg": None, "maxWeightKg": None,
            "formId": form_id_100,
            "unit": "mg", "dosing": {"type": "fixed"},
            "routeOfAdmin": "oral",
            "timesPerDay": 2, "intervalHours": 12.0,
            "maxSingleDose": 100.0, "maxSingleDosePerKg": None,
            "maxDailyDose": 200.0, "maxDailyDosePerKg": None,
            "instruction": "2–6 лет: 100 мг 2–3 раза/сут (200–300 мг/сут). Противопоказан до 2 лет. (vidal-db Doc 53227)"
        })
    if form_id_200:
        entries.append({
            "minAgeMonths": 24, "maxAgeMonths": 72,
            "minWeightKg": None, "maxWeightKg": None,
            "formId": form_id_200,
            "unit": "mg", "dosing": {"type": "fixed"},
            "routeOfAdmin": "oral",
            "timesPerDay": 2, "intervalHours": 12.0,
            "maxSingleDose": 100.0, "maxSingleDosePerKg": None,
            "maxDailyDose": 200.0, "maxDailyDosePerKg": None,
            "instruction": "2–6 лет: 100 мг 2 р/сут или 200 мг 1 р/сут (200 мг/сут). (vidal-db Doc 53227)"
        })
    # >6 years: 200mg 2-3x/day
    base_form = form_id_200 or form_id_100
    if base_form:
        entries.append({
            "minAgeMonths": 72, "maxAgeMonths": None,
            "minWeightKg": None, "maxWeightKg": None,
            "formId": base_form,
            "unit": "mg", "dosing": {"type": "fixed"},
            "routeOfAdmin": "oral",
            "timesPerDay": 3, "intervalHours": 8.0,
            "maxSingleDose": 200.0, "maxSingleDosePerKg": None,
            "maxDailyDose": 600.0, "maxDailyDosePerKg": None,
            "instruction": "Старше 6 лет: 200 мг 2–3 раза/сут (400–600 мг/сут). (vidal-db Doc 53227)"
        })
    return entries

# ─── Carbocysteine dosing (R05CB03) ──────────────────────────────────────────
# Source: vidal-db Document 19787 (Либексин Муко сироп 20мг/мл)
# Syrup 20mg/ml (children): 1 мерная ложка (5мл) = 100мг
def make_carbocysteine_pd_syrup20(form_id):
    return [
        {
            "minAgeMonths": 24, "maxAgeMonths": 60,
            "minWeightKg": None, "maxWeightKg": None,
            "formId": form_id,
            "unit": "mg", "dosing": {"type": "fixed"},
            "routeOfAdmin": "oral",
            "timesPerDay": 2, "intervalHours": 12.0,
            "maxSingleDose": 100.0, "maxSingleDosePerKg": None,
            "maxDailyDose": 200.0, "maxDailyDosePerKg": None,
            "instruction": "2–5 лет: 100 мг (5 мл сиропа 20 мг/мл) 2 раза/сут (200 мг/сут). Противопоказан до 2 лет. (vidal-db Doc 19787)"
        },
        {
            "minAgeMonths": 60, "maxAgeMonths": None,
            "minWeightKg": None, "maxWeightKg": None,
            "formId": form_id,
            "unit": "mg", "dosing": {"type": "fixed"},
            "routeOfAdmin": "oral",
            "timesPerDay": 3, "intervalHours": 8.0,
            "maxSingleDose": 100.0, "maxSingleDosePerKg": None,
            "maxDailyDose": 300.0, "maxDailyDosePerKg": None,
            "instruction": "Старше 5 лет: 100 мг (5 мл сиропа 20 мг/мл) 3 раза/сут (300 мг/сут). (vidal-db Doc 19787)"
        }
    ]

# Fluditec children syrup 20mg/ml dosing
FLUDITEC_SYRUP20_PD = [
    {
        "minAgeMonths": 24, "maxAgeMonths": 60,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "syrup_20_1",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 2, "intervalHours": 12.0,
        "maxSingleDose": 100.0, "maxSingleDosePerKg": None,
        "maxDailyDose": 200.0, "maxDailyDosePerKg": None,
        "instruction": "2–5 лет: 100 мг (5 мл сиропа 20 мг/мл) 2 раза/сут (200 мг/сут). Противопоказан до 2 лет. (vidal-db Doc 19787)"
    },
    {
        "minAgeMonths": 60, "maxAgeMonths": 180,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "syrup_20_1",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 3, "intervalHours": 8.0,
        "maxSingleDose": 100.0, "maxSingleDosePerKg": None,
        "maxDailyDose": 300.0, "maxDailyDosePerKg": None,
        "instruction": "5–15 лет: 100 мг (5 мл сиропа 20 мг/мл) 3 раза/сут (300 мг/сут). (vidal-db Doc 19787)"
    },
    {
        "minAgeMonths": 180, "maxAgeMonths": None,
        "minWeightKg": None, "maxWeightKg": None,
        "formId": "syrup_50_1",
        "unit": "mg", "dosing": {"type": "fixed"},
        "routeOfAdmin": "oral",
        "timesPerDay": 3, "intervalHours": 8.0,
        "maxSingleDose": 750.0, "maxSingleDosePerKg": None,
        "maxDailyDose": 2250.0, "maxDailyDosePerKg": None,
        "instruction": "≥15 лет: 750 мг 3 раза/сут (Флюдитек раствор/сироп взрослый). (vidal-db Doc 58808)"
    }
]


def log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")


def apply_updates():
    db_path = os.path.abspath(DB_PATH)
    if not os.path.exists(db_path):
        raise FileNotFoundError(f"DB not found at: {db_path}")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    updated = 0

    now_iso = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.000+00:00')

    def update_med(med_id, pd_list):
        nonlocal updated
        pd_json = json.dumps(pd_list, ensure_ascii=False)
        cur.execute(
            "UPDATE medications SET pediatric_dosing = ?, updated_at = ? WHERE id = ?",
            (pd_json, now_iso, med_id)
        )
        if cur.rowcount:
            updated += 1
            log(f"  ✓ Updated id={med_id}")
        else:
            log(f"  ✗ No row found for id={med_id}")

    # === R05CB06 — Амброксол =====================================================
    log("=== R05CB06 — Амброксол ===")

    # id 6260 Амбробене: has syrup_15_5 ✓
    update_med(6260, AMBROXOL_STANDARD_PD_SYRUP_15_5)

    # id 6261 Амброксол: has syrup_15_5 ✓ (primary form)
    update_med(6261, AMBROXOL_STANDARD_PD_SYRUP_15_5)

    # id 6262 Амброксол Авексима: only tablet_30mg, tablet_60mg → from 6 years only
    update_med(6262, AMBROXOL_TABLET_PD)

    # id 6263 Амброксол Велфарм: only tablet_30mg → from 6 years only
    update_med(6263, AMBROXOL_TABLET_PD)

    # id 6264 Амброксол Врамед: has syrup_15_5 ✓
    update_med(6264, AMBROXOL_STANDARD_PD_SYRUP_15_5)

    # id 6265 Амброксол Дс: has solution_15_5, solution_30_5 — use solution_15_5
    update_med(6265, AMBROXOL_STANDARD_PD_SOLUTION_15_5)

    # id 6266 Амброксол Реневал: has solution_7_5_1 (liquid) ✓
    update_med(6266, AMBROXOL_STANDARD_PD_SOLUTION_7_5_1)

    # id 6267 Амброксол Ретард: capsule_75mg, contraindicated <12 years
    update_med(6267, AMBROXOL_RETARD_PD)

    # === R05CB02 — Бромгексин =====================================================
    log("=== R05CB02 — Бромгексин ===")

    # Each product has a different primary form
    bromhexin_forms = {
        6274: "solution_4_5",    # Бромгексин 4 Берлин-хеми
        6275: "drops_8_1",       # Бромгексин 8
        6276: "tablet_8mg",      # Бромгексин 8 Берлин-хеми
        6277: "tablet_8mg",      # Бромгексин
        6278: "tablet_4mg",      # Бромгексин Гриндекс
        6279: "tablet_8mg",      # Бромгексин Медисорб
        6281: "solution_4_5",    # Солвин
    }
    for med_id, form_id in bromhexin_forms.items():
        update_med(med_id, make_bromhexin_pd(form_id))

    # === R05CB01 — Ацетилцистеин =====================================================
    log("=== R05CB01 — Ацетилцистеин ===")

    # id 6268 Ацетилцистеин: forms powder_100mg, powder_200mg, powder_600mg
    # Use 100mg for 2-6y, 200mg for 6+ years. 600mg only for adults (excluded from pd)
    update_med(6268, make_acetylcysteine_pd("powder_100mg", "powder_200mg"))

    # id 6269 Ацц 100: only tablet_100mg form
    update_med(6269, make_acetylcysteine_pd("tablet_100mg", None))

    # id 6270 Ацц 200: only tablet_200mg form
    update_med(6270, make_acetylcysteine_pd(None, "tablet_200mg"))

    # id 6271 Ацц: has granules_100mg, granules_200mg, syrup_20 (сироп 20мг/мл)
    # syrup_20 (20mg/ml) is the ACC syringe form — dosing same as Флуимуцил (Doc 53227)
    # from 2 years (granules), syrup from 2 years too (conservative, general Doc 305 says ≥2y)
    update_med(6271, make_acetylcysteine_pd("granules_100mg", "granules_200mg"))

    # id 6272 Ацц Актив: powder 600mg → adults only, but let's check forms
    # The forms field has powder_600mg only → adult use, empty pediatric
    update_med(6272, [])  # 600mg form — adult only

    # id 6273 Ацц Лонг: tablet 600mg, contraindicated <18 years
    update_med(6273, [])

    # === R05CB03 — Карбоцистеин =====================================================
    log("=== R05CB03 — Карбоцистеин ===")

    # id 6280 Карбоцистеин: has syrup_20 and syrup_50 and syrup_20_1 and syrup_50_1
    # Children's form: syrup_20 (20mg/ml)
    update_med(6280, make_carbocysteine_pd_syrup20("syrup_20"))

    # id 6282 Флуифорт: has granules_na and syrup_90_1
    # Granules 2.7g (2700mg) — adult use → empty pd
    # Syrup 90mg/ml — equivalent dosing: 100mg = ~1.1ml (very concentrated, likely adult)
    # According to vidal-db, Флуифорт uses same document 1293 without specific child doses
    # Granules/syrup 90mg/ml are adult forms → empty pediatric
    update_med(6282, [])

    # id 6283 Флюдитек: has syrup_20_1 (детский), syrup_50_1 (взрослый), solution_750_10
    # Children's syrup 20mg/ml: 2-15 years
    # Adult forms: from 15 years
    update_med(6283, FLUDITEC_SYRUP20_PD)

    conn.commit()
    conn.close()
    log(f"\n✅ Done. {updated} medications updated.")


def verify():
    """Quick verification query."""
    db_path = os.path.abspath(DB_PATH)
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    log("\n=== VERIFICATION: pediatric_dosing entry count per ATC group ===")
    cur.execute("""
        SELECT id, name_ru, atc_code,
               json_array_length(pediatric_dosing) as pd_entries
        FROM medications
        WHERE atc_code IN ('R05CB01','R05CB02','R05CB03','R05CB06')
        ORDER BY atc_code, id
    """)
    rows = cur.fetchall()
    for row in rows:
        print(f"  [{row[2]}] id={row[0]:5d} {row[1]:<35s} → {row[3]} entries")

    log("\n=== TEST: Find medications for 36-month-old (3 years) ===")
    cur.execute("""
        SELECT DISTINCT m.id, m.name_ru, m.atc_code
        FROM medications m, json_each(m.pediatric_dosing) pd
        WHERE m.atc_code IN ('R05CB01','R05CB02','R05CB03','R05CB06')
          AND json_extract(pd.value, '$.minAgeMonths') <= 36
          AND (
               json_extract(pd.value, '$.maxAgeMonths') IS NULL
            OR json_extract(pd.value, '$.maxAgeMonths') >= 36
          )
        ORDER BY m.atc_code, m.id
    """)
    rows = cur.fetchall()
    print(f"  Medications approved for 3-year-olds: {len(rows)}")
    for row in rows:
        print(f"    [{row[2]}] id={row[0]} {row[1]}")

    conn.close()


if __name__ == "__main__":
    log("Starting TASK-048: Fix mucolytic pediatric dosing...")
    apply_updates()
    verify()
