# TASK-031 — Исправить подмену названия теста при сохранении disease (upsert)

> **Модуль:** `diseases/form`  
> **Дата начала:** 06.04.2026  
> **Статус:** ✅ DONE  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

При сохранении формы заболевания (`upsert`) название теста в `diagnosticPlan` может заменяться на нерелевантное совпадение из каталога (например, "Общий анализ крови (развернутый)" -> "Анализ кала").

### Контекст

Исправление blur-нормализации не покрывает этап сохранения, потому что backend нормализация (`normalizeDiseaseData`) продолжает использовать fuzzy-сопоставление каталога тестов.

### Ожидаемый результат

- На `upsert` используется строгий режим сопоставления (exact name/alias only).
- При отсутствии точного совпадения исходное название теста сохраняется как новое.
- Новое название добавляется в каталог как отдельная запись (текущее поведение auto-add unknown names).

---

## 🗂️ Затрагиваемые файлы

```
electron/utils/diseaseNormalization.cjs
electron/modules/diseases/service.cjs
tests/**
```

---

## 📐 План реализации

### Этап 1: Реализация strict режима
**Статус:** ✅ DONE

- [x] Добавить параметр strict matching в normalize/resolve
- [x] Включить strict режим в DiseaseService.upsert

### Этап 2: Тесты
**Статус:** ✅ DONE

- [x] Добавить/обновить unit-тесты на сохранение названий
- [x] Прогнать релевантные тесты

---

## 📝 Журнал выполнения

### 06.04.2026 — Старт задачи
- Баг подтвержден пользователем после сохранения
- Локализовано в `normalizeDiseaseData` на backend

### 06.04.2026 — Реализация и проверка
- В `electron/utils/diseaseNormalization.cjs` добавлен управляемый режим сопоставления `allowFuzzy`
- Для нормализации при сохранении (`upsert`) включен строгий режим (`allowFuzzyCatalogMatch: false`)
- Теперь при отсутствии точного совпадения каталога название исследования сохраняется как введено пользователем
- Добавлен тест `tests/disease-test-name-resolution.test.ts` (strict сохранение, exact alias, optional fuzzy)
- Тесты: `tests/disease-test-name-resolution.test.ts`, `tests/validators.test.ts` — 31/31

---

## ✅ Финальный отчёт

**Дата завершения:** 06.04.2026  
**Итог:** ✅ DONE (release gate: GO)  
**Изменённые файлы:**
- `electron/utils/diseaseNormalization.cjs`
- `electron/modules/diseases/service.cjs`
- `tests/disease-test-name-resolution.test.ts`
- `tasks/06.04.2026/TASK-031.md`
- `tasks/TASKS.md`
- `src/modules/diseases/README.md`
