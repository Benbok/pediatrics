# TASK-020 — Генерация и импорт монобактамов из vidal-db

> **Модуль:** `medications/data`
> **Дата начала:** 04.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** MEDIUM

---

## 📋 Описание задачи

Найти в `vidal-db` препараты группы монобактамов, сгенерировать для них JSON в формате модуля препаратов и загрузить их в нашу БД через универсальный импортёр `scripts/import_medications_json_batch.py`.

### Источник отбора

Используется ATC-префикс `J01DF*`.

Предварительно найдено `1` уникальный `DocumentID`:

- `J01DF01` — азтреонам

---

## ✅ Что нужно сделать

1. Создать `scripts/generate_monobactam_jsons.py`
2. Сохранять JSON в `src/modules/medications/data/monobactams`
3. Использовать текущие правила:
   - очистка HTML
   - нормализация `routeOfAdmin`
   - `fullInstruction` как plain text
   - фильтрация пустых записей `pediatricDosing`
4. Выполнить импорт через `scripts/import_medications_json_batch.py`
5. Проверить количество импортированных препаратов и корректность ключевых полей
