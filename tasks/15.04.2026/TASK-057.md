# TASK-057 — CDSS: Migrate parseComplaints + rankDiagnoses from Gemini to Local LLM

> **Модуль:** `visits / cdss`  
> **Дата начала:** 15.04.2026  
> **Статус:** 🔄 IN_PROGRESS  
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
- [ ] Timeout + graceful fallback для обоих LLM-вызовов
- [x] Нет прямых вызовов localLlmService из UI/IPC (через сервисный слой)
- [x] Нет новых Prisma-миграций (схема не меняется)
- [ ] Unit тесты написаны

---

## 📐 План реализации

### Этап 1: cdssLocalLlmService.cjs
**Статус:** ⬜ TODO  
**Файлы:** `electron/services/cdssLocalLlmService.cjs`

- [ ] `parseComplaintsLocal(complaintsText, ageMonths, weight)`:
  - Prompt: извлечь симптомы → строгий JSON `{symptoms, severity}`
  - timeoutMs: 15 000, maxTokens: 200
  - Fallback: split by `,;` + logDegradation
- [ ] `rankDiagnosesLocal(symptoms, diseases, patientContext)`:
  - Compact format: `{id, name, icd10, symptoms: slice(0,5)}`
  - timeoutMs: 40 000, maxTokens: 1000
  - Fallback: `_enhancedFallbackRanking` + logDegradation
- [ ] `isLocalLlmAvailable()`: кеш 30 с, healthCheck

### Этап 2: cdssRankingService.cjs — Phase 2 → Local LLM
**Статус:** ⬜ TODO  
**Файлы:** `electron/services/cdssRankingService.cjs`

- [ ] Импорт `{ rankDiagnosesLocal, isLocalLlmAvailable }` из `./cdssLocalLlmService.cjs`
- [ ] Заменить `canRank = Boolean(VITE_GEMINI_API_KEY)` на `await isLocalLlmAvailable()`
- [ ] Вызов `rankDiagnosesLocal(symptoms, diseasesForPrompt, patientContext)` вместо `rankDiagnoses(Gemini)`
- [ ] Fallback-цепочка при ошибке → `_enhancedFallbackRanking`

### Этап 3: visits/service.cjs — parseComplaintsLocal
**Статус:** ⬜ TODO  
**Файлы:** `electron/modules/visits/service.cjs`

- [ ] Импорт `parseComplaintsLocal` из `../../../services/cdssLocalLlmService.cjs`
- [ ] Заменить вызов `parseComplaints(Gemini)` на `parseComplaintsLocal` в `analyzeVisit()`

### Этап 4: Тесты
**Статус:** ⬜ TODO  
**Файлы:** `tests/cdssLocalLlm.test.ts`

- [ ] Mock `localLlmService.generate` (success / timeout / bad JSON)
- [ ] `parseComplaintsLocal`: парсит валидный JSON, fallback at error, fallback at bad JSON
- [ ] `rankDiagnosesLocal`: ранжирует, fallback at error, фильтрует невалидные diseaseId
- [ ] `isLocalLlmAvailable`: true/false по healthCheck (с кешем)

---

## 📝 Журнал выполнения

### 15.04.2026 — Старт задачи
- Задача зафиксирована в TASKS.md (TASK-057)
- Прочитаны: cdssService.cjs, cdssRankingService.cjs, visits/service.cjs analyzeVisit()
- Архитектура: CDSSSearchService не меняется; создаём cdssLocalLlmService.cjs
- TASK-001 superseded (prompt-engineering для Gemini неактуален после перехода)
- Начата реализация Этапа 1

---

## 🔗 Связанные файлы и ресурсы

- `TASKS.md` — обновить статус
- `AI_CODING_GUIDELINES.md`
- `electron/services/localLlmService.cjs` — FIFO queue, `generate()`, `healthCheck()`
- `electron/services/cdssService.cjs` — `_enhancedFallbackRanking`, `normalizeSymptoms`  
- `electron/config/cdssConfig.cjs` — `MAX_CANDIDATES_FOR_AI_RANK = 8`

---

## ✅ Финальный отчёт

**Дата завершения:** —  
**Итог:** —  
**Изменённые файлы:** —
