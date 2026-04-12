# TASK-052: ИИ-помощник (RAG) во вкладке заболевания

**Статус:** ✅ Выполнено  
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
