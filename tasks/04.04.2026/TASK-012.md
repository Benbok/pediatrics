# TASK-012 — Поле fullInstruction + фильтрация пустых записей педиатрического дозирования

> **Модуль:** `medications/data`, `prisma/schema.prisma`
> **Дата начала:** 04.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** HIGH

---

## 📋 Описание задачи

### Проблема 1: нет полной инструкции по применению

В карточке препарата отсутствует полная «Инструкция по применению» из vidal-db. Сейчас клинические поля (Dosage, Indication, SideEffects, Interaction, OverDosage, PhInfluence, PhKinetics, SpecialInstruction и т.д.) хранятся частично в разных полях, но нет единого поля, которое содержало бы весь монограф так, как он приходит из источника.

### Проблема 2: паразитные записи в pediatricDosing

Генераторы (`generate_aminoglycoside_jsons.py`, `generate_macrolide_jsons.py`) создают записи pediatricDosing, которые не несут клинической ценности:

- Записи без дозы (`dosing: null`) — только педиатрический сигнал без мг/кг
- Записи без границ возраста (и `minAgeMonths`, и `maxAgeMonths` = null) — например, взрослые дозы, которые проскакивают через фильтр из-за наличия мг/кг-паттерна в том же фрагменте

**Пример — Гентамицин (J01GB03, doc 52101):**

Из vidal-db парсятся **5 записей**, но корректных только **3**:

| # | Источник фрагмента | Доза | Возраст | Статус |
|---|---|---|---|---|
| 1 | ChildInsuf: "осторожно у новорожденных (до 1 мес)" | ❌ нет | до 1 мес | ❌ убрать |
| 2 | Dosage: "для взрослых 1-1.7 мг/кг" | ✅ 1-1.7 | ❌ нет (взрослые) | ❌ убрать |
| 3 | Dosage: "детей старше 2 лет 3-5 мг/кг, 3 раза/сут" | ✅ 3-5 | от 24 мес | ✅ оставить |
| 4 | Dosage: "новорожденным 2-5 мг/кг, 2 раза/сут" | ✅ 2-5 | до ~1 мес | ✅ оставить |
| 5 | Dosage: "детям до 2 лет [такую же дозу] ...5 мг/кг" | ✅ 5 | до 24 мес | ✅ оставить |

---

## ✅ Критерий включения записи pediatricDosing

Запись создаётся только если выполнены **оба** условия:

1. **Доза указана**: `dosing.mgPerKg != null` (или `mgPerKgMax != null`)
2. **Хотя бы одна граница возраста указана**: `minAgeMonths != null` OR `maxAgeMonths != null`

---

## 🛠️ Что нужно сделать

### Шаг 1 — Добавить поле `full_instruction` в схему Prisma

```prisma
// В model Medication, рядом с pharmacodynamics
fullInstruction String? @map("full_instruction") // JSON: полная инструкция по применению из vidal-db (все разделы)
```

**Структура JSON** (храним HTML как есть, как в vidal-db):
```json
{
  "indication": "<P>Инфекционно-воспалительные...</P>",
  "contraIndication": "<P>Повышенная чувствительность...</P>",
  "dosage": "<P>При в/в или в/м введении...</P>",
  "sideEffects": "<P>Со стороны органов слуха...</P>",
  "interaction": "<P>...</P>",
  "overDosage": "<P>...</P>",
  "specialInstruction": "<P>При применении...</P>",
  "pharmInfluence": "<P>...</P>",
  "pharmKinetics": "<P>...</P>",
  "pregnancyUsing": "<P>...</P>",
  "nursingUsing": "<P>...</P>",
  "renalInsuf": "<P>...</P>",
  "hepatoInsuf": "<P>...</P>",
  "childInsuf": "<P>С осторожностью...</P>",
  "elderlyInsuf": "<P>...</P>",
  "storageCondition": "<P>...</P>"
}
```

### Шаг 2 — Миграция SQLite

Добавить колонку в `dev.db`:
```sql
ALTER TABLE medications ADD COLUMN full_instruction TEXT;
```

### Шаг 3 — Обновить генераторы

В `generate_aminoglycoside_jsons.py` и `generate_macrolide_jsons.py`:

#### 3a. Новая функция `build_full_instruction(doc_row)` → Dict or None

```python
def build_full_instruction(doc):
    fields = {
        "indication":       doc.get("Indication"),
        "contraIndication": doc.get("ContraIndication"),
        "dosage":           doc.get("Dosage"),
        "sideEffects":      doc.get("SideEffects"),
        "interaction":      doc.get("Interaction"),
        "overDosage":       doc.get("OverDosage"),
        "specialInstruction": doc.get("SpecialInstruction"),
        "pharmInfluence":   doc.get("PhInfluence"),
        "pharmKinetics":    doc.get("PhKinetics"),
        "pregnancyUsing":   doc.get("PregnancyUsing"),
        "nursingUsing":     doc.get("NursingUsing"),
        "renalInsuf":       doc.get("RenalInsuf"),
        "hepatoInsuf":      doc.get("HepatoInsuf"),
        "childInsuf":       doc.get("ChildInsuf"),
        "elderlyInsuf":     doc.get("ElderlyInsuf"),
        "storageCondition": doc.get("StorageCondition"),
    }
    # Оставляем только непустые поля
    return {k: v for k, v in fields.items() if v and str(v).strip()}
```

#### 3b. Фильтр в `parse_pediatric_dosing()` — добавить в конце цикла перед `rules.append(rule)`:

```python
# ❌ Отфильтровываем записи без дозы или без ограничения возраста
dose_ok = rule.get("dosing") is not None and rule["dosing"].get("mgPerKg") is not None
age_ok = rule.get("minAgeMonths") is not None or rule.get("maxAgeMonths") is not None
if not dose_ok or not age_ok:
    continue
```

#### 3c. Добавить `fullInstruction` в итоговый JSON:

```python
"fullInstruction": build_full_instruction(doc_row),
```

### Шаг 4 — Обновить `import_medications_json_batch.py`

Добавить маппинг нового поля в `map_payload()`:
```python
'full_instruction': to_json(data.get('fullInstruction')),
```

Обновить INSERT и UPDATE SQL-запросы — добавить `full_instruction` в оба места.

### Шаг 5 — Регенерировать и переимпортировать

```bash
python scripts/generate_aminoglycoside_jsons.py
python scripts/generate_macrolide_jsons.py
python scripts/import_medications_json_batch.py --dir src/modules/medications/data/aminoglycosides --on-duplicate update
python scripts/import_medications_json_batch.py --dir src/modules/medications/data/macrolides --on-duplicate update
```

### Шаг 6 — Обновить схему Prisma и проверить TypeScript

```bash
npx prisma generate
npx tsc --noEmit
```

---

## 📊 Ожидаемый результат

- Поле `full_instruction` (JSON) у препаратов, генерируемых из vidal-db
- Гентамицин: `pediatricDosing` содержит ровно 3 записи (вместо 5)
- Все записи pediatricDosing имеют и дозу, и ограничение по возрасту
- TypeScript без ошибок

---

## 📁 Затрагиваемые файлы

| Файл | Изменение |
|------|-----------|
| `prisma/schema.prisma` | Добавить поле `fullInstruction` |
| `scripts/generate_aminoglycoside_jsons.py` | Добавить `build_full_instruction()`, фильтр в `parse_pediatric_dosing()` |
| `scripts/generate_macrolide_jsons.py` | То же самое |
| `scripts/import_medications_json_batch.py` | Добавить `full_instruction` в `map_payload()`, INSERT, UPDATE |
| `prisma/dev.db` | Миграция: ALTER TABLE medications ADD COLUMN full_instruction |
