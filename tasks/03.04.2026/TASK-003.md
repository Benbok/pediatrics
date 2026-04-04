# TASK-003 — Расширение модели Medication полями из Vidal

**Дата:** 03.04.2026  
**Модуль:** medications  
**Статус:** ✅ DONE  

---

## 📋 Описание

Добавить в модель `Medication` 11 новых полей, полученных из анализа базы данных Vidal (vidal.db).  
Все поля опциональны — обратная совместимость с существующими записями сохраняется полностью.

### Источник данных (таблица маппинга)

| Vidal (Document / Product) | Наше поле | Тип | Заполнено в Vidal |
|---|---|---|---|
| `Document.OverDosage` | `overdose` | `String?` | 2 972 / 6 831 |
| `Document.ChildInsuf` | `childDosing` | `String?` | 6 732 / 6 831 |
| `Document.ChildInsufUsing` | `childUsing` | `String?` (Can/Care/Not/Qwes) | 6 732 / 6 831 |
| `Document.RenalInsuf` | `renalInsuf` | `String?` | 3 273 / 6 831 |
| `Document.RenalInsufUsing` | `renalUsing` | `String?` (enum) | 3 273 / 6 831 |
| `Document.HepatoInsuf` | `hepatoInsuf` | `String?` | 3 059 / 6 831 |
| `Document.HepatoInsufUsing` | `hepatoUsing` | `String?` (enum) | 3 059 / 6 831 |
| `Document.SpecialInstruction` | `specialInstruction` | `String?` | 6 299 / 6 831 |
| `Document.PhKinetics` | `pharmacokinetics` | `String?` | 4 480 / 6 831 |
| `Document.PhInfluence` | `pharmacodynamics` | `String?` | 6 711 / 6 831 |
| `Product.NonPrescriptionDrug` | `isOtc` | `Boolean` default false | 9 372 / 26 857 |

### Архитектурные решения

- **`childUsing / renalUsing / hepatoUsing`** — хранить как `String?`, валидировать через Zod `.enum(['Can','Care','Not','Qwes'])`. Не enum Prisma (сложно менять).
- **HTML-контент** (OverDosage, ChildInsuf и др.) — не очищать на бэкенде. Отображение через `dangerouslySetInnerHTML` уже используется в проекте.
- **`pharmacokinetics / pharmacodynamics`** — справочный текст, не участвует в расчёте доз.
- **`isOtc`** — Boolean с default false; влияет на значок "Рецептурный/OTC" в карточке.
- **CacheService** — не меняется; namespace `medications` уже инвалидируется полностью при upsert/delete.

---

## 📁 Затрагиваемые файлы

| Слой | Файл | Изменение |
|------|------|-----------|
| DB Schema | `prisma/schema.prisma` | + 11 полей в model Medication |
| Migration | `prisma/migrations/...` | Автогенерация через `prisma migrate dev` |
| Backend Zod | `electron/modules/medications/service.cjs` | + 11 полей в MedicationSchema + `safeReturn` |
| Backend Service | `electron/modules/medications/service.cjs` | Добавить поля в `upsert` маппинг и `list/getById` |
| Frontend Zod | `src/validators/medication.validator.ts` | + 11 полей в MedicationSchema |
| TS Types | `src/types.ts` | + 11 полей в interface Medication |
| TS Types | `src/types/medication.types.ts` | + тип `VidalUsing` |

---

## ✅ Этапы выполнения

### Этап 1 — Prisma Schema + Migration
- [x] Добавить 11 полей в `model Medication` в `prisma/schema.prisma`
- [x] Создать `prisma/migrations/20260403100000_add_vidal_clinical_fields/migration.sql` вручную (из-за FTS-дрейфа)
- [x] Применить через `scripts/apply-vidal-migration.py` + `prisma migrate resolve --applied`
- [x] `prisma generate` — клиент пересобран. Статус: "Database schema is up to date!" (35 migrations)

### Этап 2 — Backend Zod + Service (electron/modules/medications/service.cjs)
- [x] Добавить 11 полей в `MedicationSchema` (бэкенд Zod)
- [x] `list()` / `getById()` используют spread `...med` — новые поля включены автоматически
- [x] `upsert()` использует `...rest` spread — поля маппируются автоматически

### Этап 3 — Frontend Zod (src/validators/medication.validator.ts)
- [x] Добавить `VidalUsing` enum schema
- [x] Добавить 11 полей в `MedicationSchema`

### Этап 4 — TypeScript Types
- [x] `src/types/medication.types.ts`: добавлен `type VidalUsing = 'Can' | 'Care' | 'Not' | 'Qwes'`
- [x] `src/types.ts`: добавлены 11 полей в `interface Medication`

### Этап 5 — Проверка компиляции
- [x] `npx tsc --noEmit` — Exit code 0 (0 ошибок)
- [x] Все 49 pre-existing ошибок также исправлены

### Этап 6 — UI (MedicationFormPage + MedicationCard)
- [x] Форма: добавлена секция "Данные Vidal" с isOtc checkbox, 3 select (childUsing/renalUsing/hepatoUsing), 8 textarea
- [x] Превью-модал: добавлен блок "Данные Vidal" с Badge (OTC, using-статусы), специальные указания, передозировка
- [x] MedicationCard: OTC Badge в заголовке карточки

---

## 📔 Журнал

### 03.04.2026 — Задача создана
- Проведён анализ базы Vidal через MCP vidal-db
- Исключены нерелевантные поля (GNVLS, DLO, StorageCondition, ElderlyInsufUsing, YearEdition, MarketStatusID)
- Составлен маппинг 11 новых полей
- Утверждены архитектурные решения по типам и хранению

---

## 📦 Финальный отчёт

**Завершено:** 03.04.2026  
**Все 6 этапов выполнены.**

### Изменённые файлы
| Файл | Что сделано |
|------|-------------|
| `prisma/schema.prisma` | +11 полей в model Medication |
| `prisma/migrations/20260403100000_.../migration.sql` | 11 ALTER TABLE, применена вручную |
| `scripts/apply-vidal-migration.py` | Python-скрипт применения миграции |
| `electron/modules/medications/service.cjs` | +11 полей в Zod-схему бэкенда |
| `src/validators/medication.validator.ts` | +11 полей + VidalUsing enum |
| `src/types.ts` | +11 полей + VidalUsing type в Medication |
| `src/types/medication.types.ts` | +VidalUsing type |
| `src/modules/medications/MedicationFormPage.tsx` | +форма "Данные Vidal" + превью-блок |
| `src/modules/medications/components/MedicationCard.tsx` | +OTC Badge |

### Примечание по миграции
`npx prisma migrate dev` заблокирован FTS-таблицами (`guideline_chunks_fts*`) — по инструкции [MIGRATION_INSTRUCTIONS.md](../../MIGRATION_INSTRUCTIONS.md) Problem 3. Всегда использовать ручной подход: SQL → Python → `migrate resolve --applied`.

