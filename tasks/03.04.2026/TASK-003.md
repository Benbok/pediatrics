# TASK-003 — Расширение модели Medication полями из Vidal

**Дата:** 03.04.2026  
**Модуль:** medications  
**Статус:** 🔄 IN_PROGRESS  

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
- [ ] Добавить 11 полей в `model Medication` в `prisma/schema.prisma`
- [ ] Запустить `npx prisma migrate dev --name add_vidal_clinical_fields`
- [ ] Проверить что миграция применилась

### Этап 2 — Backend Zod + Service (electron/modules/medications/service.cjs)
- [ ] Добавить 11 полей в `MedicationSchema` (бэкенд Zod)
- [ ] Обновить `upsert` метод: маппинг новых полей при create/update
- [ ] Обновить `list` и `getById`: включить новые поля в возвращаемый объект (safeReturn)

### Этап 3 — Frontend Zod (src/validators/medication.validator.ts)
- [ ] Добавить `VidalUsing` enum schema
- [ ] Добавить 11 полей в `MedicationSchema`

### Этап 4 — TypeScript Types
- [ ] `src/types/medication.types.ts`: добавить `type VidalUsing = 'Can' | 'Care' | 'Not' | 'Qwes'`
- [ ] `src/types.ts`: добавить 11 полей в `interface Medication`

### Этап 5 — Проверка компиляции
- [ ] Убедиться что TypeScript компилируется без ошибок
- [ ] Проверить что существующие тесты не сломались

---

## 📔 Журнал

### 03.04.2026 — Задача создана
- Проведён анализ базы Vidal через MCP vidal-db
- Исключены нерелевантные поля (GNVLS, DLO, StorageCondition, ElderlyInsufUsing, YearEdition, MarketStatusID)
- Составлен маппинг 11 новых полей
- Утверждены архитектурные решения по типам и хранению

---

## 📦 Финальный отчёт

*(заполнить после завершения)*
