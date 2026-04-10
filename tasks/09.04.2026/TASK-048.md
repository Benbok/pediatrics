# TASK-048 — Локальный LLM-агент (node-llama-cpp / Qwen2.5-7B)

> **Модуль:** `electron/services/localLlmService` + `electron/modules/llm`  
> **Дата начала:** 09.04.2026  
> **Статус:** ✅ DONE  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Реализовать централизованный сервис для инференса локальной LLM-модели (`Qwen2.5-7B-Instruct-Q4_K_M.gguf`) через `node-llama-cpp`. Сервис является самостоятельным модулем, полностью изолированным от существующей Gemini-интеграции, и выступает фундаментом для последующей замены Gemini в RAG-пайплайне (`knowledgeQueryService.cjs`).

### Контекст
- Текущая AI-интеграция: Gemini 2.5-flash через HTTPS (apiKeyManager + knowledgeQueryService)
- Цель: локальный инференс без зависимости от внешнего API, приватность данных, offline-режим
- Будущее: RAG-система на базе `knowledgeQueryService.cjs` + локальный LLM

### Ожидаемый результат
- `electron/services/localLlmService.cjs` — singleton-сервис с API: `initialize`, `generate`, `abort`, `getStatus`, `dispose`
- `electron/modules/llm/handlers.cjs` — IPC-обработчики: `llm:generate`, `llm:abort`, `llm:get-status`
- `electron/preload.cjs` — расширен `window.electronAPI.llm.*`
- `electron/main.cjs` — регистрация модуля + lifecycle hooks
- `src/types.ts` — TypeScript-типы для LLM API

---

## 🗂️ Затрагиваемые файлы

```
electron/
  services/localLlmService.cjs   ← NEW (core service)
  modules/llm/handlers.cjs       ← NEW (IPC module)
  preload.cjs                    ← extend electronAPI
  main.cjs                       ← register + lifecycle
src/
  types.ts                       ← LlmAPI, LlmStatus, LlmGenerateOptions
package.json                     ← dep + build config
models/
  qwen2.5-7b-instruct.Q4_K_M.gguf  ← model file (не в git, dev only)
```

---

## ✅ Checklist

- [x] Zod-валидация на IPC handler (prompt length ≤ 16384)
- [x] `ensureAuthenticated` на всех handlers
- [x] `logger.*` вместо `console.*`
- [x] Graceful degradation без модели (warn, не crash)
- [x] AbortController per-request (стриминг прерывается корректно)
- [x] Memory check перед loadModel (freemem ≥ 6 GB)
- [x] Lifecycle: dispose при before-quit
- [x] `asarUnpack` для нативного `.node` в build config
- [x] TypeScript типы в `src/types.ts`
- [x] Стриминг через `event.sender` без хранения ссылки на win
- [x] contextIsolation enforced (WebPreferences не меняются)

---

## 📐 План реализации

### Этап 1: Package & Build Setup
**Статус:** ✅ DONE  
**Файлы:** `package.json`  
- Установить `node-llama-cpp@latest`
- Добавить `extraResources: ["models/**/*"]`
- Добавить `asarUnpack` записи для нативного `.node` и `node-llama-cpp`

### Этап 2: Core Service
**Статус:** ✅ DONE  
**Файлы:** `electron/services/localLlmService.cjs`
- `initialize()` — memory check + dynamic import + loadModel + createContext + getSequence
- `generate(prompt, options, onToken)` — AbortController, streaming callback
- `abort()`, `getStatus()`, `dispose()`
- Path resolution: dev `../../models/`, prod `process.resourcesPath/models/`

### Этап 3: IPC Module
**Статус:** ✅ DONE  
**Файлы:** `electron/modules/llm/handlers.cjs`
- `llm:generate` — Zod validation + ensureAuthenticated + streaming to sender
- `llm:abort` — ensureAuthenticated
- `llm:get-status` — ensureAuthenticated

### Этап 4: Preload Update
**Статус:** ✅ DONE  
**Файлы:** `electron/preload.cjs`
- Добавить `llm:` под `window.electronAPI`

### Этап 5: Main.cjs Update
**Статус:** ✅ DONE  
**Файлы:** `electron/main.cjs`
- Регистрация setupLlmHandlers()
- Eager init после createWindow()
- `before-quit` dispose hook

### Этап 6: TypeScript Types
**Статус:** ✅ DONE  
**Файлы:** `src/types.ts`
- `LlmGenerateOptions`, `LlmGenerateResult`, `LlmStatus`
- Расширение `electronAPI` — `llm:` ветка

---

## 📝 Execution Log

| Дата | Этап | Статус | Заметка |
|------|------|--------|---------|
| 09.04.2026 | Все этапы | ✅ DONE | Реализация завершена |
| 10.04.2026 | Compliance audit | ✅ DONE | Найдены и закрыты FINDING-01..07: parallel sequences, ChatML prompt, ALLOWED_FIELDS, no-throw, batchSize=1 |
