import sqlite3
import json

conn = sqlite3.connect('prisma/dev.db')
cur = conn.cursor()

# Получаем текущие данные для всех ацетилцистеина препаратов
medications_to_update = [6268, 6269, 6270, 6271, 6273]

for med_id in medications_to_update:
    cur.execute('SELECT name_ru, pediatric_dosing FROM medications WHERE id = ?', (med_id,))
    row = cur.fetchone()
    if not row:
        continue
    
    name_ru, pd_json = row
    pd = json.loads(pd_json)
    
    # Обновляем существующие entries
    for entry in pd:
        if entry.get('minAgeMonths') == 24 and entry.get('maxAgeMonths') == 72:
            # Период 2-6 лет: maxDailyDose 200-300
            entry['maxDailyDose'] = {"min": 200, "max": 300}
        elif entry.get('minAgeMonths') == 72 and entry.get('maxAgeMonths') is None:
            # Период 6+ лет: dosing 100mg, maxDailyDose 400-600
            entry['dosing'] = {"type": "fixed", "fixedDose": {"min": 100, "max": 100, "unit": "mg"}}
            entry['maxDailyDose'] = {"min": 400, "max": 600}
    
    pd_json_updated = json.dumps(pd, ensure_ascii=False)
    cur.execute('UPDATE medications SET pediatric_dosing = ? WHERE id = ?', (pd_json_updated, med_id))
    print(f"✓ {name_ru} (id={med_id}) обновлена")

# Добавляем данные для Ацц Лонг (id=6273)
cur.execute('SELECT pediatric_dosing FROM medications WHERE id = 6273')
row = cur.fetchone()
if row:
    pd = json.loads(row[0])
    
    # Добавляем entry для 600mg 1р/сут (14+ лет = 168+ месяцев)
    new_entry = {
        "minAgeMonths": 168,
        "maxAgeMonths": None,
        "minWeightKg": None,
        "maxWeightKg": None,
        "formId": "tablet_600mg_long",
        "unit": "mg",
        "dosing": {"type": "fixed", "fixedDose": {"min": 600, "max": 600, "unit": "mg"}},
        "routeOfAdmin": "oral",
        "timesPerDay": 1,
        "intervalHours": 24.0,
        "maxSingleDose": 600.0,
        "maxSingleDosePerKg": None,
        "maxDailyDose": 600.0,
        "maxDailyDosePerKg": None,
        "instruction": "Старше 14 лет: 600 мг 1 раз в сутки (АЦЦ Лонг). (vidal-db Doc 56981)"
    }
    
    pd.append(new_entry)
    pd_json_updated = json.dumps(pd, ensure_ascii=False)
    cur.execute('UPDATE medications SET pediatric_dosing = ? WHERE id = 6273', (pd_json_updated,))
    print(f"✓ Ацц Лонг (id=6273) добавлена запись для 600mg")

conn.commit()
conn.close()

print("\n✅ Все обновления завершены")
