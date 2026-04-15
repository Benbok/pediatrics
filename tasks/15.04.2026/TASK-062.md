# TASK-062 — Сортировка справочника исследований по приоритету

> **Модуль:** `visits/diagnostics`
> **Дата начала:** 15.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** MEDIUM

---

## 📋 Описание задачи

В модальном окне «Справочник исследований» добавить автоматическую сортировку карточек исследований по приоритету так, чтобы записи `high` отображались выше `medium`, а `medium` — выше `low`.

### Контекст
- Пользователь запросил, чтобы более приоритетные исследования всегда показывались первыми.
- В диагностических элементах уже используется поле `priority`, но в UI-списке сортировка по приоритету явно не применялась.

### Ожидаемый результат
- В списке «Справочник исследований» записи отображаются в порядке `high -> medium -> low`.
- При равном приоритете порядок стабилен и предсказуем (по названию исследования).
- Добавлен регрессионный unit-тест сортировки.

---

## 🗂️ Затрагиваемые файлы

```
tasks/
  TASKS.md
  15.04.2026/TASK-062.md
src/
  modules/visits/components/DiagnosticBrowser.tsx
  modules/visits/utils/diagnosticPriority.ts
tests/
  diagnostic-priority-sort.test.ts
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [x] Синхронизация context7 перед стартом
- [x] Type hints на всех функциях
- [ ] Zod-валидация: Frontend + Backend
- [ ] `ensureAuthenticated` на IPC handlers
- [x] `logger.*` вместо `console.*`
- [ ] `logAudit` для CRUD-операций
- [ ] Транзакции для связанных DB-операций
- [x] Нет magic numbers (используем явную таблицу приоритетов)
- [x] Код в правильном слое (UI + utility)
- [x] Производные списки через `useMemo`, не `useState + useEffect`
- [ ] CacheService для новых GET/mutation handlers
- [ ] Unit тесты написаны

Примечание: задача UI-сортировки, без изменений БД/IPC/валидации.

---

## 📐 План реализации

### Этап 1: Анализ текущей выдачи справочника исследований
**Статус:** ✅ DONE
**Файлы:** `src/modules/visits/components/DiagnosticBrowser.tsx`

- [x] Проверить текущий источник данных и порядок отображения
- [x] Подтвердить наличие поля `priority` в диагностических элементах

### Этап 2: Реализация сортировки по приоритету
**Статус:** ✅ DONE
**Файлы:** `src/modules/visits/components/DiagnosticBrowser.tsx`, `src/modules/visits/utils/diagnosticPriority.ts`

- [x] Добавить utility сортировки `high -> medium -> low`
- [x] Подключить сортировку в `DiagnosticBrowser` после фильтрации

### Этап 3: Тестирование и фиксация результата
**Статус:** ✅ DONE
**Файлы:** `tests/diagnostic-priority-sort.test.ts`, `tasks/15.04.2026/TASK-062.md`

- [x] Добавить unit-тест на приоритетную сортировку
- [x] Запустить тест и зафиксировать результат в журнале

### Этап 4: Закрытие задачи
**Статус:** ✅ DONE
**Файлы:** `tasks/15.04.2026/TASK-062.md`, `tasks/TASKS.md`

- [x] Подготовить финальный отчёт
- [x] Обновить статус задачи в `tasks/TASKS.md`

---

## 📝 Журнал выполнения

### 15.04.2026 — Старт задачи
- Задача зафиксирована в `tasks/TASKS.md` как `TASK-062`.
- Создан файл задачи `tasks/15.04.2026/TASK-062.md`.
- Подтверждено текущее место формирования списка: `DiagnosticBrowser`.
- Подтверждено наличие `priority` в `DiagnosticPlanItem`.

### 15.04.2026 — Реализация и верификация завершены
- Добавлен utility `src/modules/visits/utils/diagnosticPriority.ts` с явным порядком `high -> medium -> low` и fallback-сортировкой по названию.
- `DiagnosticBrowser` переведён на сортировку после всех пользовательских фильтров.
- Добавлен регрессионный тест `tests/diagnostic-priority-sort.test.ts`.
- Проверка: `npm run test -- tests/diagnostic-priority-sort.test.ts tests/recommendation-selection.test.ts` → `6/6` passed.

---

## 🔗 Связанные файлы и ресурсы

- `tasks/AGENT.md`
- `tasks/TASKS.md`
- `AI_CODING_GUIDELINES.md`
- `DEVELOPMENT_RULES.md`

---

## ✅ Финальный отчёт

**Дата завершения:** 15.04.2026
**Итог:** В `Справочник исследований` добавлена автоматическая сортировка карточек по приоритету с порядком `high -> medium -> low` и предсказуемым fallback по названию.
**Изменённые файлы:**
- `tasks/TASKS.md`
- `tasks/15.04.2026/TASK-062.md`
- `src/modules/visits/components/DiagnosticBrowser.tsx`
- `src/modules/visits/utils/diagnosticPriority.ts`
- `tests/diagnostic-priority-sort.test.ts`
