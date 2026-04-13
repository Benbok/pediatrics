# TASK-052: ИИ-помощник (RAG) во вкладке заболевания

**Статус:** ✅ Выполнено (updated 2026-04-13)  
**Приоритет:** Высокий  
**Дата создания:** 2026-04-12  
**Модуль:** diseases/guidelines  

## Описание

Добавить вкладку «ИИ помощник» в страницу заболевания (`DiseaseKnowledgeView`).
Врач задаёт медицинский вопрос → система ищет релевантные чанки из прикреплённых PDF гайдлайнов → LM Studio даёт сухой точный ответ ТОЛЬКО по найденным данным.

## Архитектурные решения

- **Retrieval**: FTS5 (`guideline_chunks_fts`) + семантический ранжинг по embedding (если доступны). Не зависит от Gemini.
- **Embedding**: LM Studio `/v1/embeddings` (nomic-embed-text или активная модель). Fallback: FTS-only.
- **Generation**: `localLlmService.cjs` (уже готов, HTTP-клиент к LM Studio).
- **Scope**: только чанки конкретного `diseaseId` (не глобальный RAG).
- **Streaming**: поддерживается через `ipcMain.on` + `event.sender.send`.

## Затрагиваемые файлы

- `electron/services/ragPipelineService.cjs` — СОЗДАТЬ
- `electron/modules/diseases/handlers.cjs` — добавить 3 IPC-хендлера
- `electron/preload.cjs` — добавить rag.*
- `src/types.ts` — добавить RagSource, RagQueryResult, RagReindexResult
- `src/modules/diseases/hooks/useRagQuery.ts` — СОЗДАТЬ
- `src/modules/diseases/components/DiseaseAiAssistant.tsx` — СОЗДАТЬ
- `src/modules/diseases/components/DiseaseKnowledgeView.tsx` — добавить вкладку

## Этапы

- [x] Создан TASK-052.md
- [x] **Этап 1**: `ragPipelineService.cjs` — создан, синтаксис verified (`node --check` OK)
- [x] **Этап 2**: IPC handlers (`rag:query`, `rag:stream`, `rag:reindex`) + preload `rag.*` namespace
- [x] **Этап 3**: Types sync — `RagSource`, `RagQueryResult`, `RagReindexResult` + `ElectronAPI.rag`
- [x] **Этап 4**: React hook `useRagQuery.ts` — streaming + blocking + reindex + cleanup
- [x] **Этап 5**: UI компонент `DiseaseAiAssistant.tsx` — streaming answer, sources, reindex
- [x] **Этап 6**: Вкладка «ИИ помощник» добавлена в `DiseaseKnowledgeView.tsx` (до «Поиск в PDF»)
- [x] **Этап 7**: TSC no new errors; vitest failures pre-existing (symptom schema + missing testing-library)

## Continuation (2026-04-13): Кеш ответа ИИ во вкладке Болезни

- [x] **Этап 0**: Оркестратор и scope синхронизированы (TASKS.md + AGENT.md + активный TASK)
- [x] **Этап 1**: Prisma schema / Migration — N/A (изменения БД не требуются)
- [x] **Этап 2**: Validators — N/A (новые входные контракты не вводятся)
- [x] **Этап 3**: IPC handler + backend cache (RAG last answer cache, invalidate on new request)
- [x] **Этап 4**: Types sync (`src/types.ts`)
- [x] **Этап 5**: Service/renderer integration (`preload` + `useRagQuery`)
- [x] **Этап 6**: UI compatibility check (без новых UI-элементов)
- [x] **Этап 7**: Tests/checks + release readiness summary

## Журнал

### 2026-04-12 — Задача создана
- Контекст синхронизирован: изучены service.cjs, handlers.cjs, preload.cjs, types.ts, DiseaseKnowledgeView.tsx
- Архитектурные решения: FTS retrieval + LM Studio generation, no Gemini dependency
- Embedding: LM Studio /v1/embeddings, fallback FTS-only
- Streaming через ipcMain.on + event.sender.send паттерн (аналог llm:token)

### 2026-04-12 — Задача завершена
- Все 7 этапов выполнены.
- Новые файлы: `ragPipelineService.cjs` (298 lines), `useRagQuery.ts`, `DiseaseAiAssistant.tsx`
- Изменения: `handlers.cjs` (+3 IPC), `preload.cjs` (+rag namespace), `types.ts` (+3 interfaces + ElectronAPI), `DiseaseKnowledgeView.tsx` (+import Bot, +секция, +TabsContent)
- TSC: 0 новых ошибок; все ошибки pre-existing
- Vitest: 239 passed, 7 failed (pre-existing: symptom schema + missing @testing-library/react)

### 2026-04-13 13:00 — Continuation старт
- Scope: кешировать последний ответ ИИ в модуле Diseases AI assistant до вызова нового запроса.
- Workflow синхронизирован: TASKS.md, tasks/AGENT.md, TASK-052.
- MCP routing: filesystem/context7 подключены; dev-db/vidal-db не требуются (SQL-изменений нет).

### 2026-04-13 13:20 — Этап 3 завершён
- `electron/modules/diseases/handlers.cjs`: добавлен `rag:get-last`, кеш последнего ответа по `diseaseId`, инвалидация перед новым `rag:query`/`rag:stream`.
- Добавлена инвалидация RAG-кеша при изменениях disease/guidelines и после `rag:reindex`.
- Проверка: diagnostics для файла без новых ошибок.

### 2026-04-13 13:30 — Этапы 4-6 завершены
- `src/types.ts`: добавлен контракт `RagCachedEntry` и метод `rag.getLast(...)`.
- `electron/preload.cjs`: экспортирован мост `rag:get-last`.
- `src/modules/diseases/hooks/useRagQuery.ts`: добавлено восстановление кешированного ответа при загрузке/смене `diseaseId`.
- Совместимость UI: `DiseaseAiAssistant` использует существующий state без изменения интерфейса.

### 2026-04-13 13:40 — Этап 7 завершён (проверки)
- `node --check electron/modules/diseases/handlers.cjs` и `node --check electron/preload.cjs` — OK.
- `npx tsc --noEmit` — есть pre-existing ошибки в несвязанных файлах (DiseaseFormPage, SettingsModule, MedicationBrowser, medication.types, parseInstructionText, knowledgeQuery.validator, tests/disease-history-section).
- `npm run test -- --run` — выполнен; часть test suite падает pre-existing (vax, symptom-categorization, отсутствует `@testing-library/react`).
- По изменённому scope новых ошибок/падений не зафиксировано.
