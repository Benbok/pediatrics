# TASK-057 — CDSS: Migrate parseComplaints + rankDiagnoses from Gemini to Local LLM

> **Модуль:** `visits / cdss`  
> **Дата начала:** 15.04.2026  
> **Статус:** ✅ DONE  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Перевести оба AI-шага CDSS-пайплайна с Gemini API на локальную модель через LM Studio HTTP API:

1. **`parseComplaints`** — извлечение симптомов из комбинированного клинического текста визита.
2. **`rankDiagnoses` (Phase 2 в cdssRankingService)** — ранжирование диагнозов-кандидатов по симптомам и контексту пациента.

`CDSSSearchService` (FTS + semantic chunks) не меняется — он уже не зависит от Gemini.

### Контекст

После TASK-051 в проекте работает локальная LLM через LM Studio (`localLlmService.cjs`) с FIFO-очередью (max 1 concurrent call) и `healthCheck`. CDSS при этом оставался на Gemini API, требуя API-ключа.  
TASK-001 (Консервативный AI-ранжинг) superseded данной задачей — prompt-engineering и пост-калибровка confidence для Gemini теряют смысл при переходе на local LLM.

### Ожидаемый результат

- Новый `electron/services/cdssLocalLlmService.cjs` реализует:
  - `parseComplaintsLocal(text, ageMonths, weight)` → `{symptoms: string[], severity: string}`
  - `rankDiagnosesLocal(symptoms, diseases, patientContext)` → `[{diseaseId, confidence, reasoning, matchedSymptoms}]`
  - `isLocalLlmAvailable()` → wrapper healthCheck с кешем 30 с
- `cdssRankingService.cjs`: Phase 2 использует `rankDiagnosesLocal` вместо Gemini `rankDiagnoses`  
- `visits/service.cjs`: `analyzeVisit()` использует `parseComplaintsLocal` вместо Gemini `parseComplaints`  
- Graceful fallback: при недоступности LLM → `_enhancedFallbackRanking` (из cdssService.cjs)  
- Тесты `tests/cdssLocalLlm.test.ts` — 100% pass

---

## 🗂️ Затрагиваемые файлы

```
electron/
  services/
    cdssLocalLlmService.cjs          ← NEW
    cdssRankingService.cjs           ← MODIFY (Phase 2 → local LLM)
    cdssService.cjs                  ← read-only (_enhancedFallbackRanking referenced)
    localLlmService.cjs              ← read-only dep
  modules/visits/
    service.cjs                      ← MODIFY (parseComplaintsLocal instead of Gemini)
tests/
  cdssLocalLlm.test.ts               ← NEW
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [x] Синхронизация context7: cdssService.cjs, cdssRankingService.cjs, localLlmService.cjs, visits/service.cjs прочитаны
- [x] `logger.*` вместо `console.*`
- [x] Timeout + graceful fallback для обоих LLM-вызовов
- [x] Нет прямых вызовов localLlmService из UI/IPC (через сервисный слой)
- [x] Нет новых Prisma-миграций (схема не меняется)
- [x] Unit тесты написаны

---

## 📐 План реализации

### Этап 1: cdssLocalLlmService.cjs
**Статус:** ✅ DONE  
**Файлы:** `electron/services/cdssLocalLlmService.cjs`

- [x] `parseComplaintsLocal(complaintsText, ageMonths, weight)`:
  - Prompt: извлечь симптомы → строгий JSON `{symptoms, severity}`
  - timeoutMs: 15 000, maxTokens: 200
  - Fallback: split by `,;` + logDegradation
- [x] `rankDiagnosesLocal(symptoms, diseases, patientContext)`:
  - Compact format: `{id, name, icd10, symptoms: slice(0,5)}`
  - timeoutMs: 40 000, maxTokens: 1000
  - Fallback: `_enhancedFallbackRanking` + logDegradation
- [x] `isLocalLlmAvailable()`: кеш 30 с, healthCheck

### Этап 2: cdssRankingService.cjs — Phase 2 → Local LLM
**Статус:** ✅ DONE  
**Файлы:** `electron/services/cdssRankingService.cjs`

- [x] Импорт `{ rankDiagnosesLocal, isLocalLlmAvailable }` из `./cdssLocalLlmService.cjs`
- [x] Заменить `canRank = Boolean(VITE_GEMINI_API_KEY)` на `await isLocalLlmAvailable()`
- [x] Вызов `rankDiagnosesLocal(symptoms, diseasesForPrompt, patientContext)` вместо `rankDiagnoses(Gemini)`
- [x] Fallback-цепочка при ошибке → `_enhancedFallbackRanking`

### Этап 3: visits/service.cjs — parseComplaintsLocal
**Статус:** ✅ DONE  
**Файлы:** `electron/modules/visits/service.cjs`

- [x] Импорт `parseComplaintsLocal` из `../../../services/cdssLocalLlmService.cjs`
- [x] Заменить вызов `parseComplaints(Gemini)` на `parseComplaintsLocal` в `analyzeVisit()`

### Этап 4: Тесты
**Статус:** ✅ DONE  
**Файлы:** `tests/cdssLocalLlm.test.ts`

- [x] Mock `localLlmService.generate` (success / timeout / bad JSON)
- [x] `parseComplaintsLocal`: парсит валидный JSON, fallback at error, fallback at bad JSON
- [x] `rankDiagnosesLocal`: ранжирует, fallback at error, фильтрует невалидные diseaseId
- [x] `isLocalLlmAvailable`: true/false по healthCheck (с кешем)

---

## 📝 Журнал выполнения

### 15.04.2026 — Старт задачи
- Задача зафиксирована в TASKS.md (TASK-057)
- Прочитаны: cdssService.cjs, cdssRankingService.cjs, visits/service.cjs analyzeVisit()
- Архитектура: CDSSSearchService не меняется; создаём cdssLocalLlmService.cjs
- TASK-001 superseded (prompt-engineering для Gemini неактуален после перехода)
- Начата реализация Этапа 1

### 15.04.2026 12:20 — Этапы 1-3 завершены
- Добавлен `electron/services/cdssLocalLlmService.cjs` (`isLocalLlmAvailable`, `parseComplaintsLocal`, `rankDiagnosesLocal`)
- `electron/services/cdssRankingService.cjs`: Phase 2 переключен на Local LLM (deferred require для testability)
- `electron/modules/visits/service.cjs`: `analyzeVisit()` переключен на `parseComplaintsLocal`

### 15.04.2026 12:30 — Этап 4 завершён
- Добавлен файл тестов `tests/cdssLocalLlm.test.ts` (покрытие helper/validation/cache-логики)
- Адаптированы интеграционные тесты: `tests/cdss-pipeline.integration.test.ts`, `tests/ai-symptom-normalizer.test.ts`
- Прогон: полный набор тестов green

### 15.04.2026 13:35 — Пост-фиксы стабильности и финальный gate
- Исправлен парсинг JSON-ответа LLM в `cdssLocalLlmService.cjs` (`_extractJson`: защита от preamble bracket и `<think>` блоков)
- Усилен fallback matching в `_fallbackRanking` (substring matching для реальных симптомов БД)
- Добавлена системная инструкция JSON-only для ранжирования и расширено debug-логирование raw response
- Исправлена устойчивость UI при навигации во время анализа: `src/services/analysisRegistry.ts` + ре-аттач в `VisitFormPage.tsx` + мгновенное сохранение suggestions в draft
- Тесты: `npx vitest run tests/cdssLocalLlm.test.ts tests/cdss-pipeline.integration.test.ts tests/ai-symptom-normalizer.test.ts` → 56/56 pass
- Регрессия: `npx vitest run` → 358 passed, 1 skipped

---

## 🔗 Связанные файлы и ресурсы

- `TASKS.md` — обновить статус
- `AI_CODING_GUIDELINES.md`
- `electron/services/localLlmService.cjs` — FIFO queue, `generate()`, `healthCheck()`
- `electron/services/cdssService.cjs` — `_enhancedFallbackRanking`, `normalizeSymptoms`  
- `electron/config/cdssConfig.cjs` — `MAX_CANDIDATES_FOR_AI_RANK = 8`

---

## ✅ Финальный отчёт

**Дата завершения:** 15.04.2026  
**Итог:** CDSS полностью мигрирован с Gemini на Local LLM (LM Studio) для обоих этапов (`parseComplaints`, `rankDiagnoses`) с graceful fallback, обновлёнными тестами и пост-фиксами стабильности UI при длительном анализе.  
**Изменённые файлы:**
- `electron/services/cdssLocalLlmService.cjs`
- `electron/services/cdssRankingService.cjs`
- `electron/modules/visits/service.cjs`
- `tests/cdssLocalLlm.test.ts`
- `tests/cdss-pipeline.integration.test.ts`
- `tests/ai-symptom-normalizer.test.ts`
- `src/modules/visits/VisitFormPage.tsx`
- `src/services/analysisRegistry.ts`
