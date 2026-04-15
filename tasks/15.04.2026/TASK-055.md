# TASK-055 — RAG Advanced: Template Multi-query + Self-refining + Embedding Config

> **Модуль:** `diseases / ragPipeline`  
> **Дата начала:** 2026-04-15
> **Статус:** ✅ DONE  
> **Приоритет:** MEDIUM

---

## 📋 Описание задачи

Реализация трёх улучшений RAG-пайплайна, предложенных при анализе по методологии Advanced RAG (апрель 2026):

1. **Template-based Multi-query** — для каждого `queryType` добавляются 2 статических FTS-прохода с альтернативными формулировками, результаты мёрджатся с основным поиском. Без LLM, без latency overhead.

2. **Self-refining по score** — после реранкинга проверяем средний score top-чанков. Если ниже порога (`CFG.selfRefineScoreThreshold = 0.15`) — автоматически добавляем широкий проход `BROAD_PASS_QUERY` (не только для `list`).

3. **Embedding model config** — обновить дефолтную модель на multilingual (`multilingual-e5-large`) + добавить env-документацию.

### Контекст
Анализ RAG-системы (2026-04-15) показал: Multi-query и Self-refining — наиболее реализуемые улучшения с высоким потенциалом без LLM-overhead. Обе стратегии работают через уже существующую инфраструктуру (FTS, `BROAD_PASS_QUERY`).

### Ожидаемый результат
- Улучшен recall для редких медицинских терминов через multi-query FTS
- Автоматический fallback на широкий поиск при низком качестве retrieval
- Документация по выбору embedding-модели в коде

---

## 🗂️ Затрагиваемые файлы

```
electron/
  services/ragPipelineService.cjs   ← MULTI_QUERY_TEMPLATES, self-refining, cfg
tests/
  ragPipeline.test.ts               ← тесты для новых функций
```

---

## ✅ Checklist

- [x] `MULTI_QUERY_TEMPLATES` константа добавлена
- [x] `retrieveAndRank` запускает дополнительные FTS-проходы по шаблонам
- [x] `CFG.selfRefineScoreThreshold` добавлен
- [x] Self-refining score check в `retrieveAndRank`
- [x] Embedding model default + env doc обновлён
- [x] Тесты для multi-query и self-refining логики (15 новых тестов)
- [x] Все 63 теста PASS

---

## 📐 План реализации

### Этап 1: Multi-query templates in ragPipelineService.cjs
**Статус:** ✅ DONE
**Файлы:** `electron/services/ragPipelineService.cjs`

- Добавить `MULTI_QUERY_TEMPLATES: Record<queryType, string[]>` — 2 строки на тип
- В `retrieveAndRank`: после основного FTS прогнать шаблоны и добавить новые чанки

### Этап 2: Self-refining score threshold
**Статус:** ✅ DONE
**Файлы:** `electron/services/ragPipelineService.cjs`

- Добавить `CFG.selfRefineScoreThreshold = 0.15`
- После `dedup().slice()` вычислить `avgScore`; если < threshold → broad pass merge

### Этап 3: Embedding model config
**Статус:** ✅ DONE
**Файлы:** `electron/services/ragPipelineService.cjs`

- Обновить дефолт модели на `multilingual-e5-large`
- Добавить комментарий с инструкцией по смене и reindex

### Этап 4: Tests
**Статус:** ✅ DONE
**Файлы:** `tests/ragPipeline.test.ts`

- 7 тестов MULTI_QUERY_TEMPLATES
- 8 тестов self-refining score logic

---

## 📝 Лог задачи

### 2026-04-15 — Задача создана
- Scope: 3 улучшения из анализа Advanced RAG (2026-04-15)
- Все изменения в `ragPipelineService.cjs` + тесты
- Предшествует: TASK-054 закрыта (48 тестов PASS)

### 2026-04-15 — Реализация завершена
- MULTI_QUERY_TEMPLATES: 7 типов × 1-2 шаблона, все генерируют валидные FTS-запросы
- Self-refining: CFG.selfRefineScoreThreshold=0.15, работает для всех типов кроме list
- Embedding doc: комментарий в embedTextViaLmStudio + embedBatchViaLmStudio
- Итог: 63 теста PASS (48 регрессионных + 15 новых TASK-055)
