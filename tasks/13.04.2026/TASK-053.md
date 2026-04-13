# TASK-053 — Полное удаление поиска по базе знаний из Dashboard

> **Модуль:** `dashboard / knowledge-query-retirement`  
> **Дата начала:** 13.04.2026  
> **Статус:** ✅ DONE  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Полностью удалить функционал «Поиск по базе знаний» из Dashboard, так как логика и рабочий UX перенесены в модуль «Болезни» (RAG assistant).

### Контекст
- Dashboard knowledge widget и связанный с ним фронтенд/IPC-контракт больше не являются актуальным пользовательским путем.
- Актуальный путь: вкладка ИИ-помощника внутри модуля заболеваний (`rag:*` контракт).
- Удаление должно быть безопасным и не затрагивать disease RAG.

### Ожидаемый результат
- В Dashboard отсутствует блок «Поиск по базе знаний».
- Удалены неиспользуемые dashboard-specific knowledge файлы и IPC-мост.
- Не затронуты `rag:*` обработчики и UI в diseases.

---

## 🗂️ Затрагиваемые файлы

- `TASKS.md`
- `tasks/13.04.2026/TASK-053.md`
- `src/modules/dashboard/Dashboard.tsx`
- `src/modules/dashboard/components/KnowledgeQueryWidget.tsx` (delete)
- `src/modules/dashboard/store/knowledgeQueryStore.ts` (delete)
- `src/services/knowledgeQuery.service.ts` (delete)
- `src/validators/knowledgeQuery.validator.ts` (delete)
- `src/types.ts`
- `electron/main.cjs`
- `electron/preload.cjs`
- `electron/modules/knowledge/handlers.cjs` (delete)
- `tests/knowledgeQuery.test.ts` (delete)

---

## 📐 План реализации (mandatory order)

### Этап 1: Prisma schema / migration
**Статус:** ✅ DONE (N/A)
- [x] Подтвердить, что изменения БД/миграций не требуются.

### Этап 2: Validators
**Статус:** ✅ DONE
- [x] Удалить frontend validator dashboard knowledge query.

### Этап 3: IPC handler backend
**Статус:** ✅ DONE
- [x] Удалить knowledge IPC handlers.
- [x] Удалить регистрацию handlers в `electron/main.cjs`.

### Этап 4: Types sync
**Статус:** ✅ DONE
- [x] Удалить dashboard knowledge API методы из `ElectronAPI`.
- [x] Удалить dashboard knowledge типы.

### Этап 5: Service layer
**Статус:** ✅ DONE
- [x] Удалить `knowledgeQuery.service.ts`.

### Этап 6: UI components
**Статус:** ✅ DONE
- [x] Удалить `KnowledgeQueryWidget` и store.
- [x] Убрать виджет из `Dashboard.tsx`.

### Этап 7: Tests
**Статус:** ✅ DONE
- [x] Удалить тесты dashboard knowledge query.
- [x] Прогнать релевантные тесты и typecheck.

---

## 📝 Журнал выполнения

### 13.04.2026 12:00 — Старт задачи
- Создан TASK-053 и зафиксирован scope удаления dashboard knowledge search.
- Прочитаны TASKS.md и tasks/AGENT.md перед реализацией.
- Выполнена MCP-синхронизация: context7/filesystem/dev-db/vidal-db.

### 13.04.2026 12:05 — Этап 1 завершён
- Prisma schema и миграции не затрагиваются: удаляется только dashboard/UI/IPC контракт.

### 13.04.2026 12:15 — Этап 2 завершён
- Удалён `src/validators/knowledgeQuery.validator.ts`.

### 13.04.2026 12:20 — Этап 3 завершён
- Удалён `electron/modules/knowledge/handlers.cjs`.
- В `electron/main.cjs` удалён импорт и вызов `registerKnowledgeHandlers()`.
- В `electron/preload.cjs` удалены `queryKnowledge` и `getLastKnowledgeQuery` из API-моста.

### 13.04.2026 12:25 — Этапы 4-6 завершены
- В `src/types.ts` удалены knowledge API-методы и связанные типы.
- Удалены `src/services/knowledgeQuery.service.ts`, `src/modules/dashboard/store/knowledgeQueryStore.ts`, `src/modules/dashboard/components/KnowledgeQueryWidget.tsx`.
- Обновлён `src/modules/dashboard/Dashboard.tsx`: блок «Поиск по базе знаний» удалён.
- Дополнительно удалён orphan backend `electron/services/knowledgeQueryService.cjs` и очищен namespace `knowledge` в `electron/services/cacheService.cjs`.

### 13.04.2026 12:35 — Этап 7 завершён
- Удалён тест `tests/knowledgeQuery.test.ts` как неактуальный для удалённого dashboard функционала.
- Проверки:
	- `npx tsc --noEmit` → есть pre-existing ошибки в несвязанных файлах (scope TASK-053 не затронут).
	- `npm run test -- --run tests/disease-test-name-resolution.test.ts` → PASS (3/3).
	- `node --check electron/main.cjs` и `node --check electron/preload.cjs` → OK.

---

## ✅ Финальный отчёт

**Дата завершения:** 13.04.2026  
**Итог:** Dashboard функционал «Поиск по базе знаний» полностью удалён; логика в модуле Болезни (RAG) сохранена и подтверждена тестом.  
**Изменённые файлы:**
- `TASKS.md`
- `tasks/13.04.2026/TASK-053.md`
- `src/modules/dashboard/Dashboard.tsx`
- `src/types.ts`
- `electron/main.cjs`
- `electron/preload.cjs`
- `electron/services/cacheService.cjs`

**Удалённые файлы:**
- `src/modules/dashboard/components/KnowledgeQueryWidget.tsx`
- `src/modules/dashboard/store/knowledgeQueryStore.ts`
- `src/services/knowledgeQuery.service.ts`
- `src/validators/knowledgeQuery.validator.ts`
- `electron/modules/knowledge/handlers.cjs`
- `electron/services/knowledgeQueryService.cjs`
- `tests/knowledgeQuery.test.ts`
