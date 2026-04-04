# TASK-016 — Фильтр "С педиатрическим дозированием" в списке Препаратов

> **Модуль:** `medications`  
> **Дата начала:** 04.04.2026  
> **Статус:** ✅ DONE  
> **Приоритет:** MEDIUM

---

## 📋 Описание задачи

Добавить отдельный фильтр в списке препаратов, который показывает только записи с непустым полем `pediatricDosing`.

### Ожидаемый результат

- В UI доступен отдельный переключатель фильтра
- Фильтрация выполняется на backend в `list-paginated`
- Состояние фильтра сохраняется в URL и переживает переход в карточку/обратно

---

## 🗂️ Изменённые файлы

- `src/modules/medications/MedicationsModule.tsx`
- `src/modules/medications/services/medicationService.ts`
- `src/types.ts`
- `electron/modules/medications/handlers.cjs`
- `electron/modules/medications/service.cjs`
- `src/modules/medications/README.md`

---

## ✅ Что сделано

- Добавлен UI-переключатель: `С педиатрическим дозированием`
- Добавлен query-параметр состояния фильтра: `pd=1`
- Параметр `hasPediatricDosing` прокинут через frontend service/type/preload API цепочку
- На backend в `MedicationService.listPaginated` добавлено условие:
  - исключить `pediatricDosing` = `null`, `''`, `'[]'`
- Cache key paginated-выдачи расширен признаком `hasPediatricDosing`

---

## 🧪 Проверка

- `npx tsc --noEmit` — успешно

---

## ✅ Финальный отчёт

**Дата завершения:** 04.04.2026  
**Итог:** В список препаратов добавлен отдельный серверный фильтр по наличию педиатрического дозирования с сохранением состояния через URL.
