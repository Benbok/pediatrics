# TASK-065 — Профиль организации: сущность + вкладка настроек + шапка печатной формы

> **Модуль:** `settings/printing`
> **Дата начала:** 15.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Добавить отдельную сущность профиля организации с полноценными полями, вывести редактирование в отдельной вкладке «Организация» в настройках и использовать данные профиля в шапке печатной формы приема.

### Контекст
- Пользователь запросил не просто поле в шаблоне, а полноценную сущность организации.
- Для эксплуатации в клинике название/адрес/контакты должны меняться динамически через UI настроек.
- Печатная форма уже поддерживает блок `clinicInfo`, но данные не подтягиваются централизованно из настроек.

### Ожидаемый результат
- В БД появляется таблица профиля организации (single-record).
- В backend добавлены защищенные IPC handlers `get/upsert` с валидацией и кешированием.
- В `preload` + `src/types.ts` синхронизированы IPC контракты.
- Во frontend добавлен service + вкладка «Организация» в `SettingsModule`.
- В печатной форме приема шапка использует данные профиля организации.

---

## 🗂️ Затрагиваемые файлы

```
prisma/
  schema.prisma
  migrations/20260415183000_add_organization_profile/migration.sql

electron/
  database.cjs
  preload.cjs
  services/cacheService.cjs

src/
  types.ts
  validators/organization.validator.ts
  services/organization.service.ts
  modules/settings/SettingsModule.tsx
  modules/printing/templates/visit/types.ts
  modules/printing/templates/visit/VisitForm.tsx
  modules/visits/VisitFormPage.tsx

tests/
  organization-profile.validator.test.ts

tasks/
  TASKS.md
  15.04.2026/TASK-065.md
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [x] Синхронизация context7 перед стартом
- [x] Type hints на всех функциях
- [x] Zod-валидация: Frontend + Backend
- [x] `ensureAuthenticated` на IPC handlers
- [x] `logger.*` вместо `console.*`
- [x] `logAudit` для CRUD-операций
- [ ] Транзакции для связанных DB-операций
- [x] Нет magic numbers (валидируемые лимиты и значения по умолчанию)
- [x] Код в правильном слое (Service/IPC/UI)
- [x] Производные списки через `useMemo`, не `useState + useEffect`
- [x] CacheService для новых GET/mutation handlers
- [x] Unit тесты написаны

---

## 📐 План реализации

### Этап 1: Prisma schema и миграция
**Статус:** ✅ DONE
**Файлы:** `prisma/schema.prisma`, `prisma/migrations/20260415183000_add_organization_profile/migration.sql`

- [x] Добавить модель `OrganizationProfile`
- [x] Создать SQL миграцию с single-record ограничением

### Этап 2: Валидация и backend IPC
**Статус:** ✅ DONE
**Файлы:** `src/validators/organization.validator.ts`, `electron/database.cjs`, `electron/services/cacheService.cjs`

- [x] Добавить frontend Zod schema профиля
- [x] Добавить backend Zod schema в `database.cjs`
- [x] Добавить IPC handlers `db:get-organization-profile`, `db:upsert-organization-profile`
- [x] Добавить namespace кеша и инвалидацию

### Этап 3: IPC contract + service + types
**Статус:** ✅ DONE
**Файлы:** `electron/preload.cjs`, `src/types.ts`, `src/services/organization.service.ts`

- [x] Синхронизировать preload API
- [x] Синхронизировать типы `Window.electronAPI` и доменные интерфейсы
- [x] Добавить сервисный слой профиля организации

### Этап 4: UI вкладка «Организация» и интеграция печати
**Статус:** ✅ DONE
**Файлы:** `src/modules/settings/SettingsModule.tsx`, `src/modules/visits/VisitFormPage.tsx`, `src/modules/printing/templates/visit/types.ts`, `src/modules/printing/templates/visit/VisitForm.tsx`

- [x] Добавить вкладку настроек с формой профиля
- [x] Подтягивать профиль организации при печати приема
- [x] Рендерить шапку печатной формы на основе профиля

### Этап 5: Тесты и закрытие
**Статус:** ✅ DONE
**Файлы:** `tests/organization-profile.validator.test.ts`, `tasks/15.04.2026/TASK-065.md`, `tasks/TASKS.md`

- [x] Добавить unit-тесты валидации
- [x] Запустить релевантные тесты
- [x] Обновить финальный отчет и статусы

---

## 📝 Журнал выполнения

### 15.04.2026 — Старт задачи
- Задача зафиксирована в `tasks/TASKS.md` как `TASK-065`.
- Создан файл `tasks/15.04.2026/TASK-065.md`.
- Синхронизированы workflow-инструкции, migration-safety и ipc-governance правила.

### 15.04.2026 — Этап 1 завершён (Prisma + миграция)
- В `prisma/schema.prisma` добавлена модель `OrganizationProfile`.
- Создана миграция `prisma/migrations/20260415183000_add_organization_profile/migration.sql`.
- Таблица `organization_profiles` безопасно применена к локальной `prisma/dev.db` через MCP `dev-db` (без destructive операций).

### 15.04.2026 — Этапы 2-4 завершены (backend/frontend/печать)
- Backend: добавлены Zod-схема и IPC handlers `db:get-organization-profile` / `db:upsert-organization-profile` в `electron/database.cjs`.
- Backend cache: добавлен namespace `organization` в `electron/services/cacheService.cjs`.
- IPC contract: обновлен `electron/preload.cjs` и типы `src/types.ts`.
- Service/validator: добавлены `src/services/organization.service.ts` и `src/validators/organization.validator.ts`.
- Settings UI: в `src/modules/settings/SettingsModule.tsx` добавлена вкладка «Организация» с полной формой профиля.
- Printing integration: `VisitFormPage` теперь подгружает профиль организации перед печатью.
- Print header: шаблон `visit-form` расширен полями организации (название, юр. наименование, адрес, контакты, ИНН/ОГРН, главный врач).

### 15.04.2026 — Этап 5 завершён (тесты)
- Выполнен `npx prisma generate` после обновления schema.
- Запущены тесты: `npm run test -- tests/organization-profile.validator.test.ts tests/recommendation-selection.test.ts tests/diagnostic-priority-sort.test.ts`.
- Результат: `3` test files, `9/9` tests passed.

### 15.04.2026 — Post-release hotfix
- Исправлен runtime-баг в `db:upsert-organization-profile`: кеш профиля теперь использует общий `ORGANIZATION_PROFILE_CACHE_KEY`, без обращения к несуществующей переменной.
- Во вкладке «Организация» добавлены маски ввода для телефона, ИНН и ОГРН, включая нормализацию существующих сохраненных значений при загрузке.

### 15.04.2026 — Print layout adjustment
- В шаблоне печатной формы обновлен номер формы: `025/у` вместо `025/у-04`.
- Заголовок документа переведен на динамическое название приема по типу визита (`Первичный осмотр`, `Повторный прием`, `Консультативный приём`, `Экстренный и неотложный приём`).
- Отдельный блок `Дата приема / Тип приема` удален; дата и время перенесены в шапку документа рядом с заголовком приема.
- Блок `Антропометрия` перенесен сразу после раздела `Данные пациента`.
- В разделе `Анамнез заболевания` убрано жирное начертание у внутренних подписей; заголовок секции оставлен жирным.

---

## 🔗 Связанные файлы и ресурсы

- `tasks/AGENT.md`
- `tasks/TASKS.md`
- `AI_CODING_GUIDELINES.md`
- `DEVELOPMENT_RULES.md`
- `MIGRATION_INSTRUCTIONS.md`

---

## ✅ Финальный отчёт

**Дата завершения:** 15.04.2026
**Итог:** Реализована полноценная сущность профиля организации с хранением в БД, управлением через отдельную вкладку «Организация» в настройках и динамическим выводом данных в шапке печатной формы приема.
**Изменённые файлы:**
- `tasks/TASKS.md`
- `tasks/15.04.2026/TASK-065.md`
- `prisma/schema.prisma`
- `prisma/migrations/20260415183000_add_organization_profile/migration.sql`
- `electron/database.cjs`
- `electron/preload.cjs`
- `electron/services/cacheService.cjs`
- `src/types.ts`
- `src/validators/organization.validator.ts`
- `src/services/organization.service.ts`
- `src/modules/settings/SettingsModule.tsx`
- `src/modules/printing/templates/visit/types.ts`
- `src/modules/printing/templates/visit/VisitForm.tsx`
- `src/modules/visits/VisitFormPage.tsx`
- `tests/organization-profile.validator.test.ts`
