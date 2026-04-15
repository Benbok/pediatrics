# TASK-061 — Перенос пробиотиков из vidal-db в dev-db

> **Модуль:** `medications/data`
> **Дата начала:** 15.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Перенести препараты группы пробиотиков из базы `vidal-db` в рабочую базу `dev-db` c дедупликацией и безопасным upsert в таблицу `medications`.

### Контекст
- Пользователь запросил целевой перенос препаратов пробиотической группы.
- В проекте уже есть успешные прецеденты импорта групп препаратов из Vidal в `dev-db`.
- Для SQL-операций по правилам репозитория используются MCP-серверы `vidal-db` и `dev-db`.

### Ожидаемый результат
- Определён прозрачный SQL-критерий отбора пробиотиков в `vidal-db`.
- Выполнен импорт в `dev-db` без потери уже существующих ручных данных.
- Зафиксированы результаты (количество кандидатов / вставок / обновлений) в журнале задачи.

---

## 🗂️ Затрагиваемые файлы

```
tasks/
  TASKS.md
  15.04.2026/TASK-061.md
scripts/
  import-vidal-medications.py
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [x] Синхронизация context7 перед стартом
- [x] Type hints на всех функциях
- [ ] Zod-валидация: Frontend + Backend
- [ ] `ensureAuthenticated` на IPC handlers
- [ ] `logger.*` вместо `console.*`
- [ ] `logAudit` для CRUD-операций
- [x] Транзакции для связанных DB-операций
- [x] Нет magic numbers (используем явные критерии отбора)
- [x] Код в правильном слое (DB import task)
- [x] Производные списки через `useMemo`, не `useState + useEffect`
- [ ] CacheService для новых GET/mutation handlers
- [ ] Unit тесты написаны

Примечание: задача data-import, без изменений UI/IPC/validator-слоёв.

---

## 📐 План реализации

### Этап 1: Отбор пробиотиков в vidal-db
**Статус:** ✅ DONE
**Файлы:** `tasks/15.04.2026/TASK-061.md`

- [x] Подобрать и зафиксировать критерии отбора (ATC/клиническая группа)
- [x] Посчитать количество кандидатов
- [x] Проверить sample-выборку

### Этап 2: Импорт в dev-db (idempotent upsert)
**Статус:** ✅ DONE
**Файлы:** `tasks/15.04.2026/TASK-061.md`

- [x] Подготовить safe-upsert стратегию
- [x] Выполнить импорт через MCP SQL
- [x] Проверить отсутствие дублей

### Этап 3: Верификация результата
**Статус:** ✅ DONE
**Файлы:** `tasks/15.04.2026/TASK-061.md`

- [x] Проверить число импортированных пробиотиков в `dev-db`
- [x] Сделать spot-check полей у нескольких записей
- [x] Зафиксировать результат в журнале

### Этап 4: Тесты и закрытие
**Статус:** ✅ DONE
**Файлы:** `tasks/15.04.2026/TASK-061.md`, `tasks/TASKS.md`

- [x] Зафиксировать решение по тестам (для data-only изменений)
- [x] Обновить статус задачи и финальный отчёт

---

## 📝 Журнал выполнения

### 15.04.2026 — Старт задачи
- Задача зафиксирована в `tasks/TASKS.md`
- Создан файл задачи `tasks/15.04.2026/TASK-061.md`
- Синхронизирован task-workflow контекст и правила MCP routing

### 15.04.2026 — Этапы 1-3 завершены
- Критерий отбора пробиотиков зафиксирован как строгий `ATC A07FA*`.
- В `vidal-db` найдено `23` уникальных кандидата по ключу `name_ru + atc_code` (с учётом дедупликации документов).
- Выполнен импорт в `dev-db` через MCP SQL с защитой от дублей по `LOWER(TRIM(name_ru)) + LOWER(TRIM(atc_code))`.
- Успешно добавлено `23` записи (id `6419-6441`).
- Пост-валидация в `dev-db`:
  - `total medications = 416`;
  - `A07FA* rows = 23`;
  - дублей по `name_ru + atc_code` среди `A07FA*` не обнаружено.

### 15.04.2026 — Data enrichment по замечанию пользователя
- По замечанию о пустых полях выполнено дообогащение импортированных пробиотиков данными из `vidal-db`.
- Для всех `23` записей `A07FA*` обновлены поля:
  - `child_dosing` (детский раздел/дозирование из Vidal);
  - `icd10_codes` (JSON-массив кодов МКБ-10);
  - `pediatric_dosing` (непустой JSON-массив с `instruction`, сформированный из детского текста Vidal).
- Валидация после обновления:
  - `with_pediatric_dosing = 23/23`;
  - `with_icd10 = 23/23`;
  - `with_child_dosing = 23/23`;
  - записей с `icd10_codes = []` не осталось.

### 15.04.2026 — Улучшение импортера TASK-004 (интеллектуальные pediatric_dosing + очистка HTML)
- Обновлён `scripts/import-vidal-medications.py`:
  - добавлен единый `clean_html_text()` для очистки HTML-разметки в клинических текстовых полях;
  - реализован `build_intelligent_pediatric_dosing()` с эвристиками извлечения возрастных диапазонов, частоты приёма, маршрута и фиксированной/мг-кг дозы из Vidal-текста;
  - добавлен fallback `child_dosing` из `Dosage`, если `ChildInsuf` пуст;
  - в SQL-выборку документов добавлено поле `Dosage` для лучшего извлечения педиатрической информации.
- Проверка: `python -m py_compile scripts/import-vidal-medications.py` — успешно.

### 15.04.2026 — Повторное дообогащение пробиотиков (исправление замечаний)
- Обновлён `scripts/enrich-probiotics.py` для целевой группы `id 6419-6441`:
  - исправлен источник `is_otc` (теперь из `Product.NonPrescriptionDrug`, а не по факту наличия `ATC`);
  - добавлена догрузка lookup-полей из Vidal (`active_substance`, `clinical_pharm_group`, `pharm_therapy_group`, `manufacturer`);
  - добавлена очистка HTML для `name_en` и lookup-значений `active_substance`;
  - улучшена генерация `pediatric_dosing`: сегментация текста по возрастным фрагментам, построение отдельных правил по возрастам, дедупликация правил.
- Скрипт выполнен успешно: `python scripts/enrich-probiotics.py` → `Обновлено: 23, ошибок: 0`.
- SQL-валидация после обновления (`medications.id 6419-6441`):
  - HTML-разметка в ключевых полях отсутствует (`name_en`, `active_substance`, `contraindications`, `side_effects`, `interactions`, `child_dosing`, `pediatric_dosing`, `full_instruction`);
  - `pediatric_dosing`: `23/23` валидный JSON, `23/23` непустой массив правил, пустых `instruction` нет;
  - `is_otc` синхронизирован с Vidal (в т.ч. `ПРО-СИМБИОФЛОР` корректно `0`).
- Решение по тестам (data-only scope): выполнены целевые проверки `python -m py_compile` + SQL-валидация данных; запуск frontend/unit suites не требовался.

### 15.04.2026 — Нормализация full_instruction (убран JSON-префикс)
- По запросу пользователя удалена JSON-разметка вида `{"indications": ...}` в поле `full_instruction`.
- Обновлён `scripts/enrich-probiotics.py`: `build_full_instruction()` теперь формирует plain-text секции (`key:\nvalue`), а не JSON-строку.
- Выполнена SQL-нормализация в `dev-db` для ранее импортированных данных:
  - конвертировано `195` строк `full_instruction` из JSON-объекта в plain-text;
  - остаток JSON-подобных значений (`full_instruction LIKE '{"%'`) после конвертации: `0`.
- Spot-check пробиотиков (`id 6419-6441`) подтверждает plain-text префикс (`indications:\n...`) без JSON-обёртки.

### 15.04.2026 — Hardening импортера для будущих импортов
- Обновлён `scripts/import-vidal-medications.py`, чтобы новые импорты сразу заполняли поля корректно:
  - добавлен `clean_html_text()` с нормализацией HTML/переносов строк;
  - включена интеллектуальная сборка `pediatric_dosing` из `ChildInsuf`/`Dosage` (`weight_based`/`fixed`, возрастные диапазоны, route, частота);
  - `full_instruction` теперь формируется как plain text секции (`key:\nvalue`), без JSON-обёртки;
  - расширена загрузка полей `Document` (`Dosage`, `ElderlyInsuf`, `StorageCondition`, `CompiledComposition`) для полноты;
  - `INSERT/UPDATE` синхронизированы с полем `full_instruction`, а `pediatric_dosing` теперь обновляется при legacy HTML-артефактах.
- Проверка: `python -m py_compile scripts/import-vidal-medications.py` — успешно.

### 15.04.2026 — Заполнение package_description для пробиотиков
- По запросу пользователя заполнено поле `package_description` (UI: «Описание формы выпуска и упаковки») для целевой группы пробиотиков `id 6419-6441`.
- Источник данных: Vidal `Product.ZipInfo` (агрегировано по `DocumentID`), с ручной нормализацией формулировок для текущего backfill.
- Итог в `dev-db` после обновления:
  - `total = 23`;
  - `empty_package_description = 0`;
  - `filled_package_description = 23`.
- Для будущих импортов добавлено автозаполнение `package_description` в скрипты:
  - `scripts/import-vidal-medications.py` — `package_description` заполняется из `ZipInfo` с fallback на `CompiledComposition`;
  - `scripts/enrich-probiotics.py` — аналогичная логика для точечного дообогащения.

### 15.04.2026 — Финальный release-gate по TASK-061
- Статус этапов: `Этап 1-4 = DONE`.
- Данные в `dev-db` по целевой группе пробиотиков валидированы (`23/23` по ключевым полям, включая `pediatric_dosing`, `full_instruction`, `package_description`).
- Решение по тестам: data-only scope, зафиксирован waiver на frontend/unit suite; выполнены целевые проверки SQL + компиляция Python-скриптов.
- Вердикт release gate: **GO** для закрытия задачи TASK-061.

---

## 🔗 Связанные файлы и ресурсы

- `tasks/AGENT.md`
- `tasks/TASKS.md`
- `AI_CODING_GUIDELINES.md`
- `DEVELOPMENT_RULES.md`

---

## ✅ Финальный отчёт

**Дата завершения:** 15.04.2026
**Итог:** Импорт и дообогащение пробиотиков из `vidal-db` завершены: целевая группа `A07FA*` загружена и провалидирована, исправлены `pediatric_dosing`, `full_instruction` (plain text без JSON-обёртки), заполнено `package_description`, а импортёры обновлены для корректной работы в будущих запусках.
**Изменённые файлы:**
- `tasks/TASKS.md`
- `tasks/15.04.2026/TASK-061.md`
- `src/modules/medications/README.md`
- `scripts/import-vidal-medications.py`
- `scripts/enrich-probiotics.py`
