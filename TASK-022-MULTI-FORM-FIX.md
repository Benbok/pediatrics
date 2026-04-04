# TASK-022: Многоформенные препараты в генераторах

**Статус:** ✅ ЗАВЕРШЕНО  
**Дата:** 4 апреля 2026  
**Приоритет:** Средний

## Описание

Исправлена критическая проблема в генераторах препаратов: ранее каждый документ генерировал только ОДНУ форму выпуска (первый продукт из базы), игнорируя остальные варианты упаковки и концентрации. 

Пример: **Цефиксим** (документ 11506) в vidal-db имеет 12 продуктов:
- Капсулы 400 мг (Супракс, Цефиксим)
- Таблетки 100 мг (Цемидексор)
- Таблетки 400 мг (диспергируемые: Цефиксим, Супракс Солютаб, Цефиксим Экспресс)
- Суспензии 100 мг/5 мл (Супракс, Панцеф, Иксим Люпин)
- Суспензии 20 мг/1 мл (Скертцо)

Но в dev.db было только: капсулы 400 мг (одна запись).

## Решение

### 1. Исправлены генераторы (все 6 скриптов)

**Файлы:**
- `scripts/generate_cephalosporin_jsons.py` ✅
- `scripts/generate_penicillin_jsons.py` ✅
- `scripts/generate_carbapenem_jsons.py` ✅
- `scripts/generate_monobactam_jsons.py` ✅
- `scripts/generate_macrolide_jsons.py` ✅
- `scripts/generate_aminoglycoside_jsons.py` ✅

**Три критических изменения в каждом генераторе:**

#### a) Добавлен запрос всех продуктов документа
```python
all_product_forms = cur.execute("""
    SELECT DISTINCT p.ZipInfo, p.Composition
    FROM Product p
    JOIN Product_Document pd ON pd.ProductID = p.ProductID
    WHERE pd.DocumentID = ? AND p.ZipInfo IS NOT NULL
    ORDER BY p.ProductID
""", (doc_id,)).fetchall()
```

#### b) Агрегация всех форм с дедублированием
```python
forms = []
seen_form_keys = set()
for pf in all_product_forms:
    for f in parse_forms(pf["ZipInfo"], pf["Composition"]):
        key = (f.get("type"), f.get("concentration"), f.get("strengthMg"))
        if key not in seen_form_keys:
            seen_form_keys.add(key)
            forms.append(f)
if not forms:
    forms = parse_forms(zip_info, composition)
```

#### c) Улучшен ID формы медикамента
```python
fid = re.sub(r"[^a-z0-9_]+", "_", 
    f"{form_type}_{concentration or (str(int(strength_mg)) + 'mg' if strength_mg is not None else 'na')}"
).strip("_").lower()
```

**Дедупликация поключу:** `(form_type, concentration, strengthMg)`
- Таблетки 100 мг и 400 мг → разные записи (разные strengthMg)
- Суспензии 100 мг/5 мл (20 мг/мл) и 20 мг/1 мл → разные записи (разные концентрации)
- Идентичные формы → одна запись (дедублировано)

## Результаты

### JSON-генерация
```
Cephalosporins: 69 файлов (63→69 форм в исходном наборе)
Penicillins:    32 файла (обновлены)
Carbapenems:    17 файлов (обновлены)
Monobactams:    1 файл (обновлён)
Macrolides:     32 файла (обновлены)
Aminoglycosides: 20 файлов (обновлены)
```

### Импорт в dev.db
```
Cephalosporins: Updated: 69, Errors: 0
Penicillins:    Updated: 32, Errors: 0
Carbapenems:    Updated: 17, Errors: 0
Monobactams:    Updated: 1,  Errors: 0
Macrolides:     Updated: 32, Errors: 0
Aminoglycosides: Updated: 20, Errors: 0

Стратегия: --upsert-by name_ru_atc --on-duplicate update
Итого в DB: 143 препарата
```

### Проверка: Цефиксим в dev.db

**ID:** 6081, **ATC:** J01DD08  
**Формы выпуска:**
1. `capsule_400mg` — капс. 400 мг: 6 шт.
2. `suspension_100_5` — гранулы, сусп. 100 мг/5 мл (20 мг/мл)
3. `tablet_400mg` — таб. диспергируемые 400 мг
4. `tablet_100mg` — таб. покр. пленочной оболочкой, 100 мг
5. `suspension_20_1` — порошок, сусп. 20 мг/1 мл

✅ Все 5 форм успешно добавлены

## Дополнительные улучшения

- ✅ Уникальные ID для каждой формы (включены strength и concentration в ID)
- ✅ Сохранена совместимость с существующей структурой данных
- ✅ Улучшена информативность в `description` поля (полное описание из vidal-db)

## Дальнейшие шаги

1. Скрипты готовы для повторного использования при обновлении vidal-db
2. При добавлении новых групп препаратов рекомендуется применить ту же схему
3. Рассмотреть аналогичное улучшение для макроструктуры других наборов данных

## Версионирование

- **До:** Один JSON per DocumentID → одна форма per препарат
- **После:** Один JSON per DocumentID → все формы per препарат, агрегированы в `forms[]`

---
**Завершено:** 2026-04-04 ✅
