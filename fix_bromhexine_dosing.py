import sqlite3
import json

conn = sqlite3.connect('prisma/dev.db')
cur = conn.cursor()

# Bromhexine medications to update
bromhexine_ids = [6274, 6275, 6276, 6277, 6278, 6279, 6281]

for med_id in bromhexine_ids:
    cur.execute('SELECT name_ru, pediatric_dosing FROM medications WHERE id = ?', (med_id,))
    row = cur.fetchone()
    if not row:
        continue
    
    name_ru, pd_json = row
    pd = json.loads(pd_json)
    new_pd = []
    
    for entry in pd:
        min_age = entry.get('minAgeMonths')
        max_age = entry.get('maxAgeMonths')
        
        # Remove entries for 0-24 months (contraindicated before 2 years)
        if min_age == 0 or (min_age is None and max_age == 24):
            continue
        
        # Create new entry structure
        new_entry = entry.copy()
        
        # Update dosing field with min/max
        if min_age == 24 and max_age == 72:
            # 2-6 лет: 2-4 mg
            new_entry['dosing'] = {"type": "fixed", "fixedDose": {"min": 2, "max": 4, "unit": "mg"}}
            new_entry['maxSingleDose'] = {"min": 4, "max": 4}
            new_entry['maxDailyDose'] = {"min": 12, "max": 12}
        elif min_age == 72 and max_age == 120:
            # 6-10 лет: 4-8 mg
            new_entry['dosing'] = {"type": "fixed", "fixedDose": {"min": 4, "max": 8, "unit": "mg"}}
            new_entry['maxSingleDose'] = {"min": 8, "max": 8}
            new_entry['maxDailyDose'] = {"min": 24, "max": 24}
        elif min_age == 120 and max_age == 144:
            # 10-12 лет: 8-16 mg (как взрослые, но верхняя граница 12 лет = 144 месяца)
            new_entry['dosing'] = {"type": "fixed", "fixedDose": {"min": 8, "max": 16, "unit": "mg"}}
            new_entry['maxSingleDose'] = {"min": 16, "max": 16}
            new_entry['maxDailyDose'] = {"min": 48, "max": 48}
            # Расширяем верхний предел до 168 месяцев (14 лет)
            new_entry['maxAgeMonths'] = 168
        elif min_age == 120 and (max_age is None or max_age > 144):
            # Это для взрослых - пропускаем
            continue
        
        new_pd.append(new_entry)
    
    pd_json_updated = json.dumps(new_pd, ensure_ascii=False)
    cur.execute('UPDATE medications SET pediatric_dosing = ? WHERE id = ?', (pd_json_updated, med_id))
    print(f"✓ {name_ru} (id={med_id}) обновлена ({len(new_pd)} entries)")

conn.commit()
conn.close()

print("\n✅ Обновление бромгексина завершено")
