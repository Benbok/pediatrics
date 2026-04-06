# TASK-037 — Специфичность и патогномоничность симптомов в базе знаний заболеваний

> **Модуль:** `diseases/form`  
> **Дата начала:** 07.04.2026  
> **Статус:** ✅ DONE  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Добавить в схему симптома два новых поля:

- `isPathognomonic: boolean` — патогномоничный признак (однозначно указывает на диагноз, встречается только при данной болезни)
- `specificity: 'low' | 'medium' | 'high'` — диагностическая специфичность симптома

### Контекст

Из анализа структуры хранения заболеваний выявлено, что все симптомы структурно равны при поиске. Это приводит к тому, что «высокая температура» (неспецифический симптом, присутствует при сотнях болезней) влияет на cosine similarity так же, как патогномоничный признак «тонзиллярный экссудат с плёнкой» (дифтерия). Добавление мета-данных о специфичности позволяет улучшить точность верификации диагнозов.

### Ожидаемый результат

- Форма редактирования заболевания: при добавлении/редактировании симптома доступны новые поля
- UX: ⭐ golden-star toggle для `isPathognomonic`, трёхсегментный pill-селектор для `specificity`
- Визуализация в списке симптомов: патогномоничные — золотая звезда ★, specificity — цветная точка
- Взвешенный поиск: патогномоничные симптомы влияют на cosine similarity весом 2× (vs средний 1× и низкий 0.5×)
- Обратная совместимость: старые симптомы без полей → `specificity: 'medium'`, `isPathognomonic: false`

---

## 🗂️ Затрагиваемые файлы

```
src/
  types.ts                                                 ← CategorizedSymptom + новые поля
  validators/disease.validator.ts                         ← SymptomSchema frontend Zod
  modules/diseases/
    components/SymptomsList.tsx                           ← UI: star-toggle, pill-selector, визуализация
    DiseaseFormPage.tsx                                   ← addSymptom: default values
    services/diseaseService.ts                            ← parseSymptoms backward compat
    README.md                                             ← docs update
electron/
  modules/diseases/
    service.cjs                                           ← _parseSymptoms, DiseaseSchema, searchBySymptoms
    validator.cjs                                         ← validateSymptoms
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [x] Синхронизация context7 перед стартом (не требовалось: нет внешней библиотечной интеграции)
- [ ] Type hints на всех функциях
- [ ] Zod-валидация: Frontend + Backend
- [ ] `ensureAuthenticated` на IPC handlers (без изменений IPC-регистраций)
- [ ] `logger.*` вместо `console.*`
- [ ] Транзакции для связанных DB-операций (не применимо: DB-схема не меняется)
- [ ] Нет magic numbers (веса → константы в cdssConfig.cjs)
- [ ] Код в правильном слое
- [ ] Производные списки через `useMemo`
- [ ] Unit тесты написаны

---

## 📐 План реализации

### Этап 1: Types + Frontend Zod
**Статус:** ✅ DONE  
**Файлы:** `src/types.ts`, `src/validators/disease.validator.ts`

- [x] Добавить `specificity` и `isPathognomonic` в `CategorizedSymptom`
- [x] Обновить `SymptomSchema` во frontend validator

### Этап 2: Backend парсинг и валидация
**Статус:** ✅ DONE  
**Файлы:** `electron/modules/diseases/service.cjs`, `electron/modules/diseases/validator.cjs`

- [x] Обновить `_parseSymptoms` с fallback (old format → medium/false)
- [x] Обновить `SymptomSchema` backend Zod + `validateSymptoms`
- [x] `normalizeSymptomsForSave` — сохранять новые поля

### Этап 3: Поисковые веса
**Статус:** ✅ DONE  
**Файлы:** `electron/modules/diseases/service.cjs`, `electron/config/cdssConfig.cjs`

- [x] Константы весов в cdssConfig: `SYMPTOM_WEIGHT_PATHOGNOMONIC`, `SYMPTOM_WEIGHT_HIGH`, `SYMPTOM_WEIGHT_MEDIUM`, `SYMPTOM_WEIGHT_LOW`
- [x] Взвешенный текст запроса в `searchBySymptoms`

### Этап 4: UI
**Статус:** ✅ DONE  
**Файлы:** `src/modules/diseases/components/SymptomsList.tsx`, `src/modules/diseases/DiseaseFormPage.tsx`

- [x] PillSelector для specificity в режиме редактирования
- [x] Star-toggle для isPathognomonic
- [x] Авто-specificity=high при isPathognomonic=true
- [x] Визуализация в чипах: ★ + цветная точка

### Этап 5: README + финальная верификация
**Статус:** ✅ DONE  
**Файлы:** `src/modules/diseases/README.md`

---

## 📋 Execution Log

- 07.04.2026: Задача создана. Начата реализация.
- 07.04.2026: Все этапы завершены. Реализованы поля specificity/isPathognomonic, UX пилл-селектор + star-toggle, взвешенный поиск, backward compat, README обновлён.
