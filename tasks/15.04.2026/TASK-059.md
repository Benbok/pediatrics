# TASK-059 — Diseases AI Assistant: переключаемые режимы RAG и без RAG

> **Модуль:** `diseases / ai-assistant`
> **Дата начала:** 15.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Добавить в ИИ-помощник модуля «Болезни» два явных режима ответа с понятным UX:

1. `RAG` — ответ только на основе прикрепленных документов заболевания.
2. `Без RAG` — прямой запрос в локальную LLM без контекста RAG.

### Контекст

Текущий помощник в diseases работает только как RAG и в интерфейсе не позволяет врачу явно выбрать поведение модели. Нужно сделать прозрачное переключение режима, чтобы пользователь понимал, когда ответ grounded по документам, а когда это direct-ответ локальной модели.

### Ожидаемый результат

- Появился понятный переключатель режимов в `DiseaseAiAssistant`.
- Backend поддерживает route для direct-режима отдельным сервисным слоем.
- IPC контракт, preload и `src/types.ts` синхронизированы.
- В обоих режимах корректно работает streaming.
- Добавлены тесты для сервиса выбора режима.

---

## 🗂️ Затрагиваемые файлы

```
electron/
  services/diseaseAssistantModeService.cjs      ← NEW
  modules/diseases/handlers.cjs                 ← mode-aware IPC + validation
  preload.cjs                                   ← passthrough mode in rag API
src/
  types.ts                                      ← mode types for rag API contract
  services/rag.service.ts                       ← mode passthrough
  modules/diseases/hooks/useRagQuery.ts         ← mode-aware query/stream/cache
  modules/diseases/components/DiseaseAiAssistant.tsx  ← explicit mode toggle UI
tests/
  diseaseAssistantMode.test.ts                  ← NEW unit tests for mode service
tasks/
  15.04.2026/TASK-059.md                        ← this task log
TASKS.md                                        ← active task registry
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [x] Синхронизация context7 перед стартом
- [x] Type hints на всех новых функциях
- [x] Zod-валидация: Frontend + Backend (для изменённого IPC контракта)
- [x] `ensureAuthenticated` на IPC handlers
- [x] `logger.*` вместо `console.*`
- [x] Нет magic numbers (используем константы)
- [x] Код в правильном слое (Component / Service / IPC)
- [x] Unit тесты написаны

---

## 📐 План реализации

### Этап 1: Prisma/Migration — проверка необходимости
**Статус:** ✅ DONE
**Файлы:** `prisma/schema.prisma`, `prisma/migrations/*` (read-only)

- [x] Проверить необходимость изменений БД
- [x] Зафиксировать решение по миграциям

### Этап 2: Validators — расширение входного контракта
**Статус:** ✅ DONE
**Файлы:** `electron/modules/diseases/handlers.cjs`

- [x] Добавить валидируемый параметр режима (`rag` | `direct`)
- [x] Сохранить обратную совместимость (default = `rag`)

### Этап 3: IPC handler backend
**Статус:** ✅ DONE
**Файлы:** `electron/services/diseaseAssistantModeService.cjs`, `electron/modules/diseases/handlers.cjs`

- [x] Добавить отдельный backend service для direct-режима
- [x] Переключать backend поток `rag/direct` в `rag:query` и `rag:stream`

### Этап 4: Types sync
**Статус:** ✅ DONE
**Файлы:** `src/types.ts`, `electron/preload.cjs`

- [x] Синхронизировать IPC-типизацию нового параметра режима
- [x] Синхронизировать `getLast` cache signature с режимом

### Этап 5: Service layer
**Статус:** ✅ DONE
**Файлы:** `src/services/rag.service.ts`, `src/modules/diseases/hooks/useRagQuery.ts`

- [x] Прокинуть mode через frontend service и hook
- [x] Изолировать кеш/историю по режиму

### Этап 6: UI components
**Статус:** ✅ DONE
**Файлы:** `src/modules/diseases/components/DiseaseAiAssistant.tsx`

- [x] Добавить явный UX-переключатель RAG / Без RAG
- [x] Обновить тексты/подсказки под активный режим

### Этап 7: Tests
**Статус:** ✅ DONE
**Файлы:** `tests/diseaseAssistantMode.test.ts`

- [x] Покрыть unit-тестами сервис переключения режима
- [x] Прогнать релевантные тесты

---

## 📝 Журнал выполнения

### 15.04.2026 — Старт задачи
- Задача зафиксирована в `TASKS.md` как TASK-059
- Прочитаны `TASKS.md`, `tasks/AGENT.md`, профильные инструкции workflow
- Синхронизирован текущий код assistant-потока: UI → hook → service → preload → IPC → ragPipeline/localLlm
- Запрошены актуальные практики через context7 по chat-completions roles/streaming

### 15.04.2026 17:12 — Этап 1 завершён (Prisma/Migration)
- Проверено влияние изменений: логика полностью application-level, изменения schema/migration не требуются
- Зафиксировано решение: без Prisma и без SQL-изменений

### 15.04.2026 17:14 — Этап 2 завершён (Validators)
- `RagQueryInputSchema` расширена полем `mode` (`rag|direct`, default=`rag`) в `electron/modules/diseases/handlers.cjs`
- Сохранена обратная совместимость для текущих вызовов без `mode`

### 15.04.2026 17:16 — Этап 3 завершён (IPC handler backend)
- Добавлен `electron/services/diseaseAssistantModeService.cjs` как отдельный сервис маршрутизации режимов
- `rag:query` и `rag:stream` переключают backend поток между RAG и direct-режимом
- Кеш последнего ответа разделён по режимам (`rag`/`direct`) для прозрачного UX

### 15.04.2026 17:17 — Этап 4 завершён (Types sync)
- Обновлены контракты `src/types.ts`: `RagMode`, mode-aware сигнатуры `query/stream/getLast/onDone`
- Типы `RagQueryResult` и `RagCachedEntry` расширены полем `mode`

### 15.04.2026 17:18 — Этап 5 завершён (Service layer)
- Обновлён `src/services/rag.service.ts` для прокидывания `mode`
- Обновлён `src/modules/diseases/hooks/useRagQuery.ts`: mode-aware cache restore и вызовы query/stream
- История диалога сбрасывается при смене diseaseId или режима

### 15.04.2026 17:19 — Этап 6 завершён (UI)
- В `DiseaseAiAssistant.tsx` добавлен явный переключатель `RAG (по документам)` / `Без RAG (прямой LLM)`
- Обновлены тексты-подсказки, placeholder и busy-state под текущий режим
- Quick chips показываются только в RAG-режиме

### 15.04.2026 17:21 — Этап 7 завершён (Tests)
- Добавлен unit test `tests/diseaseAssistantMode.test.ts` (5 тестов)
- Прогон: `npm run test -- tests/diseaseAssistantMode.test.ts tests/ragPipeline.test.ts --run` → 74/74 passed

### 15.04.2026 17:22 — Финальный gate
- Изменения в scope выполнены, ошибок компиляции по изменённым файлам нет
- SQL/migration риски отсутствуют (изменения без БД)
- Gate статус: `GO` для feature-scope (с ограничением: полный регрессионный прогон проекта не выполнялся)

### 15.04.2026 17:35 — Пост-фикс UX чипов (No Data)
- `DiseaseAiAssistant.tsx`: при клике на QA-чип, если backend возвращает `null` (лог `No data for templateId=...`), чип удаляется из UI
- Аналогичное удаление добавлено для re-attach сценария (когда вычисление завершилось после возврата на вкладку)
- Поведение согласовано с доменной логикой: отсутствие данных в документе не должно оставлять пустой шаблонный чип

---

## 🔗 Связанные файлы и ресурсы

- `TASKS.md`
- `tasks/AGENT.md`
- `AI_CODING_GUIDELINES.md`
- `electron/services/ragPipelineService.cjs`
- `electron/services/localLlmService.cjs`

---

## ✅ Финальный отчёт

**Дата завершения:** 15.04.2026
**Итог:** В модуле diseases реализован явный и понятный переключатель режимов AI assistant: `RAG` и `Без RAG`. Добавлен отдельный backend service для direct-пути к локальной LLM, mode-aware IPC/типы/сервисы/UI, а также разделение кеша последнего ответа по режимам.
**Изменённые файлы:**
- `TASKS.md`
- `tasks/15.04.2026/TASK-059.md`
- `electron/services/diseaseAssistantModeService.cjs`
- `electron/modules/diseases/handlers.cjs`
- `src/types.ts`
- `src/services/rag.service.ts`
- `src/modules/diseases/hooks/useRagQuery.ts`
- `src/modules/diseases/components/DiseaseAiAssistant.tsx`
- `tests/diseaseAssistantMode.test.ts`
