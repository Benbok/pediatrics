import sqlite3
import json

conn = sqlite3.connect('prisma/dev.db')
cur = conn.cursor()

# ============================================
# КАРБОЦИСТЕИН
# ============================================

# ID 6280: Карбоцистеин (основной)
carbocysteine_entries = [
    {
        "minAgeMonths": 12,
        "maxAgeMonths": 60,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": "solution_20mg_ml",
        "unit": "mg",
        "dosing": {"type": "fixed", "fixedDose": {"min": 100, "max": 100, "unit": "mg"}},
        "routeOfAdmin": "oral",
        "timesPerDay": 2,
        "intervalHours": 12.0,
        "maxSingleDose": 100.0,
        "maxSingleDosePerKg": None,
        "maxDailyDose": {"min": 200, "max": 300},
        "maxDailyDosePerKg": None,
        "instruction": "1–5 лет: 100 мг 2 раза в день (200–300 мг/сут). (vidal-db Doc 19787)"
    },
    {
        "minAgeMonths": 60,
        "maxAgeMonths": 180,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": "solution_20mg_ml",
        "unit": "mg",
        "dosing": {"type": "fixed", "fixedDose": {"min": 100, "max": 200, "unit": "mg"}},
        "routeOfAdmin": "oral",
        "timesPerDay": 3,
        "intervalHours": 8.0,
        "maxSingleDose": 300.0,
        "maxSingleDosePerKg": None,
        "maxDailyDose": 900.0,
        "maxDailyDosePerKg": None,
        "instruction": "Старше 5 лет: 100–200 мг 3 раза в день (300–600 мг/сут). (vidal-db Doc 19787)"
    }
]

cur.execute('UPDATE medications SET pediatric_dosing = ? WHERE id = 6280',
            (json.dumps(carbocysteine_entries, ensure_ascii=False),))
print("✓ Карбоцистеин (id=6280) обновлен (2 entries)")

# ID 6282: Флуифорт
fluifort_entries = [
    {
        "minAgeMonths": 12,
        "maxAgeMonths": 60,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": "syrup_90mg_15ml",
        "unit": "mg",
        "dosing": {"type": "fixed", "fixedDose": {"min": 450, "max": 450, "unit": "mg"}},
        "routeOfAdmin": "oral",
        "timesPerDay": 2,
        "intervalHours": 12.0,
        "maxSingleDose": 450.0,
        "maxSingleDosePerKg": None,
        "maxDailyDose": 900.0,
        "maxDailyDosePerKg": None,
        "instruction": "Флуифорт сироп. От 1 года до 5 лет по 5 мл 2 раза в день. (vidal-db Doc 19787)"
    },
    {
        "minAgeMonths": 180,
        "maxAgeMonths": None,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": "granules_2700mg",
        "unit": "mg",
        "dosing": {"type": "fixed", "fixedDose": {"min": 2700, "max": 2700, "unit": "mg"}},
        "routeOfAdmin": "oral",
        "timesPerDay": 1,
        "intervalHours": 24.0,
        "maxSingleDose": 2700.0,
        "maxSingleDosePerKg": None,
        "maxDailyDose": 2700.0,
        "maxDailyDosePerKg": None,
        "instruction": "Флуифорт (гранулы/пакетики). Только с 15 лет. 1 раз в сутки. (vidal-db Doc 19787)"
    }
]

cur.execute('UPDATE medications SET pediatric_dosing = ? WHERE id = 6282',
            (json.dumps(fluifort_entries, ensure_ascii=False),))
print("✓ Флуифорт (id=6282) обновлена (2 entries)")

# ID 6283: Флюдитек
fluditec_entries = [
    {
        "minAgeMonths": 24,
        "maxAgeMonths": 60,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": "syrup_20mg_ml",
        "unit": "mg",
        "dosing": {"type": "fixed", "fixedDose": {"min": 100, "max": 100, "unit": "mg"}},
        "routeOfAdmin": "oral",
        "timesPerDay": 2,
        "intervalHours": 12.0,
        "maxSingleDose": 100.0,
        "maxSingleDosePerKg": None,
        "maxDailyDose": {"min": 200, "max": 300},
        "maxDailyDosePerKg": None,
        "instruction": "Флюдитек 2% (детский). От 2 до 5 лет по 5 мл 2 раза в день. (vidal-db Doc 58808)"
    }
]

cur.execute('UPDATE medications SET pediatric_dosing = ? WHERE id = 6283',
            (json.dumps(fluditec_entries, ensure_ascii=False),))
print("✓ Флюдитек (id=6283) обновлена (1 entry)")

# ============================================
# АМБРОКСОЛ
# ============================================

# Для амброксола (6260-6266) - стандартная схема
ambroxol_standard_entries = [
    {
        "minAgeMonths": 0,
        "maxAgeMonths": 24,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": "solution_7_5_1",
        "unit": "mg",
        "dosing": {"type": "fixed", "fixedDose": {"min": 7.5, "max": 7.5, "unit": "mg"}},
        "routeOfAdmin": "oral",
        "timesPerDay": 2,
        "intervalHours": 12.0,
        "maxSingleDose": 7.5,
        "maxSingleDosePerKg": None,
        "maxDailyDose": 15.0,
        "maxDailyDosePerKg": None,
        "instruction": "До 2 лет (по назначению врача). Раствор (7.5 мг/мл) по 1 мл 2 раза в день. (vidal-db Doc 31041)"
    },
    {
        "minAgeMonths": 24,
        "maxAgeMonths": 72,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": "syrup_15mg_5ml",
        "unit": "mg",
        "dosing": {"type": "fixed", "fixedDose": {"min": 7.5, "max": 7.5, "unit": "mg"}},
        "routeOfAdmin": "oral",
        "timesPerDay": 3,
        "intervalHours": 8.0,
        "maxSingleDose": 7.5,
        "maxSingleDosePerKg": None,
        "maxDailyDose": {"min": 22.5, "max": 22.5},
        "maxDailyDosePerKg": None,
        "instruction": "2–6 лет. Сироп (15 мг/5 мл) по 2.5 мл 3 раза в день. (vidal-db Doc 31041)"
    },
    {
        "minAgeMonths": 72,
        "maxAgeMonths": 144,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": "tablet_30mg",
        "unit": "mg",
        "dosing": {"type": "fixed", "fixedDose": {"min": 15, "max": 15, "unit": "mg"}},
        "routeOfAdmin": "oral",
        "timesPerDay": 3,
        "intervalHours": 8.0,
        "maxSingleDose": 15.0,
        "maxSingleDosePerKg": None,
        "maxDailyDose": 45.0,
        "maxDailyDosePerKg": None,
        "instruction": "6–12 лет. Таблетки (30 мг) по 1/2 шт 2–3 раза в день. (vidal-db Doc 31041)"
    },
    {
        "minAgeMonths": 144,
        "maxAgeMonths": 216,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": "tablet_30mg",
        "unit": "mg",
        "dosing": {"type": "fixed", "fixedDose": {"min": 30, "max": 30, "unit": "mg"}},
        "routeOfAdmin": "oral",
        "timesPerDay": 3,
        "intervalHours": 8.0,
        "maxSingleDose": 30.0,
        "maxSingleDosePerKg": None,
        "maxDailyDose": 90.0,
        "maxDailyDosePerKg": None,
        "instruction": "Старше 12 лет (таблетки). В первые 2–3 дня по 30 мг 3 раза в день, затем 2 раза. (vidal-db Doc 31041)"
    }
]

# IDs для стандартного амброксола
standard_ids = [6260, 6261, 6262, 6263, 6264, 6265, 6266]
for med_id in standard_ids:
    cur.execute('SELECT name_ru FROM medications WHERE id = ?', (med_id,))
    row = cur.fetchone()
    if row:
        cur.execute('UPDATE medications SET pediatric_dosing = ? WHERE id = ?',
                    (json.dumps(ambroxol_standard_entries, ensure_ascii=False), med_id))
        print(f"✓ {row[0]} (id={med_id}) обновлен (4 entries)")

# ID 6267: Амброксол Ретард - только для 12+ лет
retard_entries = [
    {
        "minAgeMonths": 144,
        "maxAgeMonths": None,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": "capsule_75mg_long",
        "unit": "mg",
        "dosing": {"type": "fixed", "fixedDose": {"min": 75, "max": 75, "unit": "mg"}},
        "routeOfAdmin": "oral",
        "timesPerDay": 1,
        "intervalHours": 24.0,
        "maxSingleDose": 75.0,
        "maxSingleDosePerKg": None,
        "maxDailyDose": 75.0,
        "maxDailyDosePerKg": None,
        "instruction": "Амброксол Ретард (капсулы пролонгированные). Только с 12 лет. 1 раз в сутки. (vidal-db Doc 31041)"
    }
]

cur.execute('UPDATE medications SET pediatric_dosing = ? WHERE id = 6267',
            (json.dumps(retard_entries, ensure_ascii=False),))
print("✓ Амброксол Ретард (id=6267) обновлен (1 entry)")

conn.commit()
conn.close()

print("\n✅ Обновление carбоцистеина и амброксола завершено")
