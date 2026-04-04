# TASK-004 — Импорт препаратов из vidal.db

> **Модуль:** `medications`  
> **Дата начала:** 03.04.2026  
> **Статус:** ✅ DONE  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Импортировать все 6 831 документ из базы данных Vidal (`vidal.db`) в нашу таблицу `medications`.  
Каждый `Document` в vidal.db = одно МНН (международное непатентованное название) с клиническими данными.

### Контекст
- TASK-003 добавила 11 новых полей в модель `Medication` — теперь структура готова принять данные Vidal
- vidal.db расположен по пути: `C:/Users/Arty/Desktop/ru.medsolutions/vidal.db`
- Наша база: `prisma/dev.db`
- Прецеденты: `scripts/add_paracetamol.cjs`, `scripts/reseed-nutrition-data.cjs` — образцы скриптов-сидеров

### Ожидаемый результат
- Скрипт `scripts/import-vidal-medications.cjs` — идемпотентный, можно запускать повторно
- После запуска в `dev.db` появятся ~6 831 записей Medication
- Отчёт в консоли: создано / обновлено / пропущено / ошибок

---

## 🗂️ Структура vidal.db (разведка проведена)

### Таблицы источника

| Таблица | Строк | Назначение |
|---------|-------|------------|
| `Document` | 6 831 | МНН-монографии с клинич. данными |
| `Product` | 26 857 | Торговые названия / формы выпуска |
| `Product_Document` | 26 624 | Связь Product → Document (N:1) |
| `Product_MoleculeName` / `MoleculeName` | — | Активное вещество (МНН текст) |
| `Product_ATC` / `ATC` | — | ATC-коды |
| `Product_ClPhGroups` / `ClPhGroups` | — | Клинико-фармакологические группы |
| `Product_PhThGrp` / `PhThGroups` | — | Фармако-терапевтические группы |
| `Product_Company` / `Company` | — | Производитель |
| `Document_IndicNozology` / `Nozology` | — | ICD-10 коды показаний |

### Маппинг Document → Medication

| vidal.db | Наше поле | Примечание |
|----------|-----------|------------|
| `Document.RusName` | `nameRu` | UPPERCASE → Title Case |
| `Document.EngName` | `nameEn` | |
| `MoleculeName.RusName` via Product_MoleculeName | `activeSubstance` | первый по ProductID |
| `ATC.ATCCode` via Product_ATC | `atcCode` | первый; может отсутствовать |
| `ClPhGroups.Name` via Product_ClPhGroups | `clinicalPharmGroup` | первый |
| `PhThGroups.Name` via Product_PhThGrp | `pharmTherapyGroup` | первый |
| `Company.LocalName` via Product_Company (ItsMainCompany=1) | `manufacturer` | первый |
| `Document.Indication` | `indications` | HTML-текст → plain text или как есть |
| `Document.ContraIndication` | `contraindications` | HTML |
| `Document.SideEffects` | `sideEffects` | HTML |
| `Document.Interaction` | `interactions` | HTML |
| `Document.Lactation` | `pregnancy` + `lactation` | один текст, записать в pregnancy |
| `MAX(Product.NonPrescriptionDrug)` | `isOtc` | если хоть один продукт OTC → true |
| `Document_IndicNozology.NozologyCode` | `icd10Codes` | массив; `Nozology.Code` = ICD-10 |
| `Document.OverDosage` | `overdose` | HTML, nullable |
| `Document.ChildInsuf` | `childDosing` | HTML, nullable |
| `Document.ChildInsufUsing` | `childUsing` | Can/Care/Not/Qwes, nullable |
| `Document.RenalInsuf` | `renalInsuf` | HTML, nullable |
| `Document.RenalInsufUsing` | `renalUsing` | Can/Care/Not/Qwes, nullable |
| `Document.HepatoInsuf` | `hepatoInsuf` | HTML, nullable |
| `Document.HepatoInsufUsing` | `hepatoUsing` | Can/Care/Not/Qwes, nullable |
| `Document.SpecialInstruction` | `specialInstruction` | HTML, nullable |
| `Document.PhKinetics` | `pharmacokinetics` | HTML, nullable |
| `Document.PhInfluence` | `pharmacodynamics` | HTML, nullable |

### Поля NOT mappable (оставляем по умолчанию)

| Поле | Значение по умолчанию | Причина |
|------|-----------------------|---------|
| `pediatricDosing` | `[]` | В vidal.db только свободный текст `Dosage` |
| `adultDosing` | `[]` | То же |
| `forms` | `[]` | В Product.Composition/ZipInfo — сложный парсинг |
| `minInterval` / `maxDosesPerDay` / `maxDurationDays` | `null` | Нет в vidal.db |
| `routeOfAdmin` | `null` | Нет структурированного поля |
| `vidalUrl` | `null` | Нет в vidal.db |
| `isFavorite` | `false` | Пользовательское поле |

---

## 📌 Архитектурные решения

### Уровень импорта: Document (МНН)
- Один `Document` = одна запись `Medication`
- Связанные `Product` (торговые названия) НЕ создаём отдельными записями
- Название берём из `Document.RusName` (convert UPPERCASE → Title Case)

### Идемпотентность
- Проверка по `nameRu` (после нормализации регистра): если существует → **update** Vidal-полей, не трогая `pediatricDosing`/`forms`/`isFavorite`
- Если не существует → **create**
- При update: поля `pediatricDosing`, `adultDosing`, `forms`, `isFavorite`, `icd10Codes` (если уже заполнены вручную) — НЕ перезаписываем

### Производительность
- Пакетная обработка: commits каждые 100 записей (транзакции Prisma)
- Всего ~6 831 записей, ~68 батчей

### Путь к vidal.db
- Константа в начале скрипта: `VIDAL_DB_PATH = 'C:/Users/Arty/Desktop/ru.medsolutions/vidal.db'`
- При отсутствии файла — graceful exit с понятным сообщением

### Зависимости
- `better-sqlite3` — уже используется в `electron/database.cjs`
- `@prisma/client` — уже в проекте

---

## 📐 План реализации

### Этап 1 — SQL-запрос для извлечения данных
**Статус:** ✅ DONE  

- [x] 7 lookup Maps: molecule, atc, clph, phth, manufacturer, isOtc, icd10
- [x] Стратегия: отдельные SELECT → dict в памяти (JOIN-ы через Product_Document работали хорошо)
- [x] Fallback: если нет MoleculeName → использовать Document.RusName (1 030 таких документов)

### Этап 2 — Написать скрипт импорта
**Статус:** ✅ DONE  
**Файлы:** `scripts/import-vidal-medications.py`

- [x] `to_title_case()` — ПАРАЦЕТАМОЛ → Парацетамол
- [x] `strip_html()` — для `indications`; остальные текстовые поля — HTML-as-is
- [x] Upsert по `name_ru` (idempotent)
- [x] UPDATE: COALESCE для полей, которые могут быть заполнены вручную
- [x] Колонки snake_case (Prisma-маппинг)
- [x] `contraindications` fallback = "" (NOT NULL в схеме)
- [x] Прогресс-вывод + статистика

### Этап 3 — Запуск и верификация
**Статус:** ✅ DONE  

3 прогона (итеративные фиксы):
1. Прогон 1: 5 799 ок, 1 032 ошибки (wrong column names: camelCase vs snake_case)  
2. Прогон 2: 5 799+, 1 032→19 ошибки (missing `active_substance` fallback)
3. Прогон 3: 6 831 / 6 831, **ошибок: 0** ✅

**Финальные цифры (dev.db):**
| Метрика | Значение |
|---------|----------|
| Всего записей в medications | **6 008** |
| Дедупликаций по name_ru | ~823 |
| OTC-препаратов | 2 683 |
| С child_dosing | 4 533 |
| С ICD-10 кодами | 5 825 |

**Spot-check:**
- Парацетамол: ATC=N02BE01, OTC=1, child_using=Not, renal=Care, **ped_rules=4** (сохранены)  
- Амоксициллин: ATC=J01CA04, OTC=0, renal=Care ✅  
- Ибупрофен: ATC=M01AE01, OTC=0 ✅  

### Этап 4 — Тест компиляции и отчёт
**Статус:** ✅ DONE  

- [x] `npx tsc --noEmit` — Exit code 0

---

## 📔 Журнал

### 03.04.2026 — Задача создана
- Проведён анализ структуры vidal.db через MCP vidal-db
- vidal.db: `C:/Users/Arty/Desktop/ru.medsolutions/vidal.db` (6 831 Document, 26 857 Product)
- Составлен полный маппинг полей Document → Medication  
- Подтверждено что TASK-003 (11 новых полей) создала готовую принимающую структуру
- Ключевые находки разведки:
  - `Document.RusName` = UPPERCASE МНН → нужен toTitleCase
  - `Product_ATC` пустой для Парацетамола (ATC-коды могут отсутствовать у части)
  - `Document_IndicNozology` содержит ICD-10 коды (2 547 уникальных кодов)
  - `Nozology.Code` = ICD-10 формат (A00, R50 и т.д.)
  - HTML-контент во всех текстовых полях Document

---

## 📦 Финальный отчёт

**Завершено:** 03.04.2026  

| Файл | Что сделано |
|------|-------------|
| `scripts/import-vidal-medications.py` | Скрипт импорта Python: 7 lookup Maps + upsert + idempotency |

**Команда запуска:** `python scripts/import-vidal-medications.py`  
**Результат:** 6 008 препаратов в `medications`, 0 ошибок, pediatric_dosing существующих записей сохранён.

**Технические решения:**
- `better-sqlite3` несовместим с системным Node (MODULE_VERSION mismatch) → использован Python
- Prisma использует snake_case в SQLite → колонки `name_ru`, `atc_code`, вместо camelCase
- 1 030 Documents без MoleculeName → fallback на Document.RusName
- `contraindications NOT NULL` → fallback пустая строка `""`
- ~823 дедупликаций: несколько Document с одинаковым RusName после TitleCase

