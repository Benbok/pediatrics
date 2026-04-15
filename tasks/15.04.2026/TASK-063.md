# TASK-063 — Toggle-удаление повторным выбором в справочнике рекомендаций

> **Модуль:** `visits/recommendations`
> **Дата начала:** 15.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** MEDIUM

---

## 📋 Описание задачи

В модальном окне «Справочник рекомендаций» реализовать toggle-поведение карточек: первый клик добавляет рекомендацию в раздел «Рекомендации», повторный клик по уже выбранной карточке удаляет её из раздела.

### Контекст
- В «Справочник исследований» уже используется паттерн повторного выбора для удаления элемента.
- В `RecommendationsBrowser` повторный клик по выбранной карточке сейчас игнорируется, из-за чего поведение модуля рекомендаций отличается от соседнего справочника.

### Ожидаемый результат
- Клик по невыбранной карточке добавляет рекомендацию.
- Повторный клик по выбранной карточке удаляет эту рекомендацию.
- Поведение закрыто регрессионным тестом.

---

## 🗂️ Затрагиваемые файлы

```
tasks/
  TASKS.md
  15.04.2026/TASK-063.md
src/
  modules/visits/components/RecommendationsBrowser.tsx
  modules/visits/VisitFormPage.tsx
  modules/visits/utils/recommendationSelection.ts
tests/
  recommendation-selection.test.ts
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
- [x] Нет magic numbers (используем явную toggle-логику)
- [x] Код в правильном слое (UI + utility)
- [x] Производные списки через `useMemo`, не `useState + useEffect`
- [ ] CacheService для новых GET/mutation handlers
- [ ] Unit тесты написаны

Примечание: задача UI-поведения без изменений БД/IPC.

---

## 📐 План реализации

### Этап 1: Анализ текущего поведения выбора рекомендаций
**Статус:** ✅ DONE
**Файлы:** `src/modules/visits/components/RecommendationsBrowser.tsx`, `src/modules/visits/VisitFormPage.tsx`

- [x] Найти точку добавления рекомендации из справочника
- [x] Подтвердить отсутствие toggle-удаления при повторном выборе

### Этап 2: Реализация toggle-поведения
**Статус:** ✅ DONE
**Файлы:** `src/modules/visits/components/RecommendationsBrowser.tsx`, `src/modules/visits/VisitFormPage.tsx`, `src/modules/visits/utils/recommendationSelection.ts`

- [x] Добавить utility toggle выбора рекомендаций
- [x] Подключить удаление по повторному клику в браузере рекомендаций

### Этап 3: Тестирование и фиксация результата
**Статус:** ✅ DONE
**Файлы:** `tests/recommendation-selection.test.ts`, `tasks/15.04.2026/TASK-063.md`

- [x] Добавить unit-тест на toggle-поведение
- [x] Запустить тест и зафиксировать результат

### Этап 4: Закрытие задачи
**Статус:** ✅ DONE
**Файлы:** `tasks/15.04.2026/TASK-063.md`, `tasks/TASKS.md`

- [x] Подготовить финальный отчёт
- [x] Обновить статус задачи в `tasks/TASKS.md`

---

## 📝 Журнал выполнения

### 15.04.2026 — Старт задачи
- Задача зафиксирована в `tasks/TASKS.md` как `TASK-063`.
- Создан файл задачи `tasks/15.04.2026/TASK-063.md`.
- Найдены точки интеграции: `RecommendationsBrowser` и `VisitFormPage`.
- Подтверждено, что повторный клик по выбранной карточке сейчас не удаляет рекомендацию.

### 15.04.2026 — Реализация и верификация завершены
- Добавлен utility `src/modules/visits/utils/recommendationSelection.ts` с toggle-логикой выбранных рекомендаций.
- `RecommendationsBrowser` получил `onRemove` и теперь снимает рекомендацию повторным кликом по выбранной карточке.
- `VisitFormPage` переведён на единый toggle-обработчик для добавления и удаления рекомендаций из раздела «Рекомендации».
- Добавлен регрессионный тест `tests/recommendation-selection.test.ts`.
- Проверка: `npm run test -- tests/recommendation-selection.test.ts tests/diagnostic-priority-sort.test.ts` → `6/6` passed.

---

## 🔗 Связанные файлы и ресурсы

- `tasks/AGENT.md`
- `tasks/TASKS.md`
- `AI_CODING_GUIDELINES.md`
- `DEVELOPMENT_RULES.md`

---

## ✅ Финальный отчёт

**Дата завершения:** 15.04.2026
**Итог:** В `Справочник рекомендаций` повторный клик по уже выбранной карточке теперь удаляет рекомендацию из раздела «Рекомендации».
**Изменённые файлы:**
- `tasks/TASKS.md`
- `tasks/15.04.2026/TASK-063.md`
- `src/modules/visits/components/RecommendationsBrowser.tsx`
- `src/modules/visits/VisitFormPage.tsx`
- `src/modules/visits/utils/recommendationSelection.ts`
- `tests/recommendation-selection.test.ts`
