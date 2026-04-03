# TASK-001 — Консервативный AI-ранжинг при размытых жалобах

> **Модуль:** `visits / cdss`  
> **Дата начала:** 02.04.2026  
> **Статус:** 🔄 IN_PROGRESS  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Повысить надежность CDSS на размытых формулировках жалоб (например, "частый кашель ночью") за счет более осторожного prompt-ранжирования и пост-калибровки confidence.

### Контекст
Система уже корректно ранжирует на специфичных жалобах, но при общих/неспецифичных симптомах может завышать confidence лидирующего диагноза. Требуется сделать объяснения клинически более прозрачными и confidence более консервативным.

### Ожидаемый результат
- Prompt ранжирования в `cdssService` требует явного перечисления:
  - подтверждающих признаков,
  - отсутствующих, но ожидаемых признаков,
  - противоречащих признаков.
- Введена пост-обработка confidence (cap/penalty) при одном совпавшем или неспецифичном симптоме.
- Добавлены unit/integration тесты на сценарии размытых жалоб.

---

## 🗂️ Затрагиваемые файлы

```
electron/
  services/cdssService.cjs            ← prompt + пост-калибровка confidence
  services/cdssRankingService.cjs     ← при необходимости расширение прокидываемых полей
src/
  types.ts                            ← при необходимости новые поля ранжирования
tests/
  cdss-pipeline.integration.test.ts   ← проверки консервативного confidence
  ai-symptom-normalizer.test.ts       ← smoke/регрессия пайплайна (если потребуется)
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [x] Синхронизация context7 перед стартом
- [ ] Type hints на всех функциях
- [ ] Zod-валидация: Frontend + Backend
- [ ] `ensureAuthenticated` на IPC handlers
- [ ] `logger.*` вместо `console.*`
- [ ] `logAudit` для CRUD-операций
- [ ] Транзакции для связанных DB-операций
- [x] Нет magic numbers (используем `constants.ts`)
- [x] Код в правильном слое (Component / Service / IPC / DB)
- [x] Производные списки через `useMemo`, не `useState + useEffect`
- [x] CacheService для новых GET/mutation handlers (не требуется в рамках задачи)
- [ ] Unit тесты написаны

---

## 📐 План реализации

### Этап 1: Дизайн формата ранжирования
**Статус:** 🔄 IN_PROGRESS  
**Файлы:** `electron/services/cdssService.cjs`

- [ ] Обновить prompt для `rankDiagnoses()` с обязательными полями `supportingFindings`, `missingExpectedFindings`, `conflictingFindings`.
- [ ] Добавить инструкции по консервативной интерпретации при 1 неспецифичном симптоме.

### Этап 2: Пост-калибровка confidence
**Статус:** ⬜ TODO  
**Файлы:** `electron/services/cdssService.cjs`, `electron/config/cdssConfig.cjs`

- [ ] Вынести caps/penalties в конфиг.
- [ ] Добавить нормализацию confidence после ответа LLM (cap + штрафы за missing/conflicting).

### Этап 3: Совместимость и типизация
**Статус:** ⬜ TODO  
**Файлы:** `src/types.ts`, `electron/services/cdssRankingService.cjs`

- [ ] При необходимости расширить типы результата ранжирования.
- [ ] Проверить, что UI безопасно работает с новыми полями (fallback при их отсутствии).

### Этап 4: Тесты
**Статус:** ⬜ TODO  
**Файлы:** `tests/cdss-pipeline.integration.test.ts`

- [ ] Добавить сценарий: размытая жалоба + 1 неспецифичный симптом → ограниченный confidence.
- [ ] Добавить сценарий: специфичная жалоба → confidence выше, без чрезмерного штрафа.

---

## 📝 Журнал выполнения

### 02.04.2026 — Старт задачи
- Задача зафиксирована в `tasks/TASKS.md`
- Создан файл `tasks/02.04.2026/TASK-001.md`
- Определен план реализации (prompt → calibration → types → tests)

### 02.04.2026 14:43 — A/B прогон prompt-ов на пользовательском кейсе
- Добавлен A/B скрипт `scripts/cdss-prompt-ab-test.cjs` с параметрами `--complaints`, `--age-months`, `--delay-ms`
- Выполнен запуск с жалобой: "ночной кашель, лихорадка до 38,5, боль в горле, болезненность при глотании, насморк"
- Пауза между old/new prompt: `20000 ms` (для снижения риска rate-limit)
- Результат сравнения:
  - OLD prompt top-1: `Острый ларингит (60%)`
  - NEW prompt top-1: `Острый ларингит (60%)`
  - NEW prompt дал более детализированное объяснение (`supporting/missing/conflicting`), без изменения лидера

---

## 🔗 Связанные файлы и ресурсы

- `AI_CODING_GUIDELINES.md` — обязательные правила реализации
- `tasks/TASKS.md` — трекер статусов
- `tasks/AGENT.md` — оркестрация шагов агента
- `src/modules/visits/CDSS_SYSTEM.md` — описание пайплайна CDSS

---

## ✅ Финальный отчёт

**Дата завершения:** —  
**Итог:** —  
**Изменённые файлы:**
- —

**Обновлённые README:**
- `src/modules/visits/README.md` (планируется после завершения)
