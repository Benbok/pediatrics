# TASK-054 — RAG pipeline: compliance-fixes + performance optimizations

> **Модуль:** `diseases / ragPipeline`
> **Дата начала:** 2026-04-13
> **Статус:** ✅ DONE
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Устранение compliance-нарушений, выявленных аудитом feature-compliance-audit, и реализация полного набора оптимизаций производительности RAG-пайплайна.

### Compliance fixes (Phase 1)

1. `rag:stream` не обёрнут `ensureAuthenticated` и не логирует ошибку через `logger`.
2. Нет Zod-валидации входящих параметров `{ query, diseaseId, history }` в IPC-обработчиках.

### Performance improvements (Phase 2 & 3)

- `expandQueryViaLlm` блокирует 1-5с перед каждой генерацией — делаем условным (только если FTS вернул < 3 чанков).
- Embed circuit breaker — при недоступности endpoint выключаем на 60с.
- Кеш `resolveModelCtxLength` увеличиваем до сессии (сбрасывается при ошибке).
- Уменьшить `topK` / `topKAfterRank` для простых запросов (drug/dose).
- `disease_qa_cache` — Prisma-таблица для pre-computed ответов.
- Фоновый precompute стандартных вопросов при загрузке гайдлайна.
- IPC + types + preload для QA-кеша.
- UI quick-answer chips в DiseaseAiAssistant.
- `src/services/rag.service.ts` — сервисный слой над IPC.

---

## 🗂️ Затрагиваемые файлы

```
electron/
  modules/diseases/handlers.cjs           ← auth fix, Zod schema, QA cache handlers
  modules/diseases/service.cjs            ← precompute trigger after guideline upload
  services/ragPipelineService.cjs         ← conditional LLM expand, embed CB, topK tuning, ctx cache
  services/ragQaPrecomputeService.cjs     ← NEW: precompute worker
  preload.cjs                             ← QA cache API
prisma/
  schema.prisma                           ← DiseaseQaCache model
  migrations/                             ← новая миграция
src/
  types.ts                                ← QaCache types, ElectronAPI.rag расширение
  services/rag.service.ts                 ← NEW: service layer
  modules/diseases/components/DiseaseAiAssistant.tsx ← quick-answer chips
  modules/diseases/hooks/useRagQuery.ts   ← optional: QA cache hook usage
```

---

## ✅ Checklist

- [x] ensureAuthenticated / auth-guard на rag:stream
- [x] Zod-схема RagQueryInputSchema — applied в rag:query и rag:stream
- [x] logger.error в rag:stream catch
- [x] expandQueryViaLlm conditional (FTS < LLM_EXPAND_MIN_CHUNKS)
- [x] Embed circuit breaker
- [x] Model ctx cache lifetime extended
- [x] topK tuning для drug/dose типов
- [x] Prisma DiseaseQaCache model + migration
- [x] ragQaPrecomputeService.cjs
- [x] Service trigger в uploadGuidelineSingle
- [x] IPC handlers rag:qa:list + rag:qa:trigger + rag:qa:templates
- [x] Preload API (qaList, qaTrigger, qaTemplates)
- [x] Types sync (QaCacheEntry, QaTemplate)
- [x] rag.service.ts
- [x] UI chips в DiseaseAiAssistant
- [x] UI: отображение процесса подготовки чипсов + кеширование
- [ ] Базовые тесты для чистых функций ragPipelineService

---

## 📐 План реализации

### Этап 1: Compliance fixes (handlers.cjs)
**Статус:** ✅ DONE
**Файлы:** `electron/modules/diseases/handlers.cjs`

- Auth guard на `rag:stream`
- `logger.error` в `rag:stream` catch
- `RagQueryInputSchema` (Zod) — validate в `rag:query` и `rag:stream`

### Этап 2: Performance quick wins (ragPipelineService.cjs)
**Статус:** ✅ DONE
**Файлы:** `electron/services/ragPipelineService.cjs`

- `expandQueryViaLlm` — conditional (skip if initialChunks.length >= LLM_EXPAND_MIN_CHUNKS)
- Embed circuit breaker (`_embedDisabled` flag, 60s retry)
- `resolveModelCtxLength` cache TTL → session-lifetime (reset on error)
- `topK`/`topKAfterRank` — добавить тип `simple` для drug/dose, уменьшить topK до 10/6

### Этап 3: Prisma + precompute service
**Статус:** ✅ DONE
**Файлы:** `prisma/schema.prisma`, new `ragQaPrecomputeService.cjs`

- Новая модель `DiseaseQaCache`
- Миграция
- Сервис precompute (STANDARD_QUESTIONS × diseaseId)
- Trigger в `service.cjs` после загрузки гайдлайна

### Этап 4: IPC + types + preload
**Статус:** ✅ DONE
**Файлы:** `handlers.cjs`, `preload.cjs`, `src/types.ts`

- `rag:qa:list` — список доступных pre-computed вопросов/ответов для diseaseId
- `rag:qa:get` — получить конкретный pre-computed ответ
- Types: `QaCacheEntry`, `QaTemplate`
- Preload расширяем

### Этап 6: UI: процесс подготовки чипсов + кеширование
**Статус:** ✅ DONE
**Файлы:** `DiseaseAiAssistant.tsx`, `rag.service.ts`, `handlers.cjs`, `ragQaPrecomputeService.cjs`

- Чипсы отображаются всегда (из `qaTemplates`)
- Цвет: серый (не готов), зелёный (готов)
- При клике на неготовый чипс: загрузка + `qaComputeSingle` → кеш + отображение
- Сохранение в системный кеш для persistence между вкладками

### Этап 6: Unit tests
**Статус:** ✅ DONE
**Файлы:** `tests/ragPipeline.test.ts`

- `buildFtsQuery`, `detectQueryType`, `rerankByKeywords`, `expandQueryWithSynonyms`, `dedup`, `buildContextSmart`
- 48 тестов — 48 PASS (2026-04-15)

---

## 📝 Лог задачи

### 2026-04-13 — Задача создана
- Scope определён по результатам feature-compliance-audit.
- Начинаем с Этапа 1 (compliance fixes).

### 2026-04-13 — Этапы 1–5 завершены
- Phase 1: auth guard + Zod + logger.error на rag:stream ✅
- Phase 2: expandQueryViaLlm conditional, embed CB, ctx cache 10min, topKSimple ✅
- Phase 3.1: DiseaseQaCache Prisma model + migration applied + generated ✅
- Phase 3.2: ragQaPrecomputeService.cjs (7 templates, FIFO queue, getQaCache) ✅
- Phase 3.2: schedulePrecompute wired to upload handlers ✅
- Phase 3.2: IPC handlers rag:qa:list + rag:qa:trigger + rag:qa:templates ✅
- Phase 3.3: QaTemplate + QaCacheEntry types in src/types.ts ✅
- Phase 3.3: preload.cjs expanded with qaList/qaTrigger/qaTemplates ✅
- Phase 3.4: DiseaseAiAssistant.tsx — quick-answer chips + trigger button ✅
- Phase 4: src/services/rag.service.ts created ✅
- Phase 6: UI chips with loading states + on-demand compute + caching ✅
- Остаток: Этап 6 (unit tests для ragPipelineService pure functions)
