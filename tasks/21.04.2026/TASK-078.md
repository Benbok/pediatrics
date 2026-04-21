# TASK-078 — Refactor: DB Import — устранение findings compliance audit

> **Модуль:** `settings / electron/database.cjs / src/services`  
> **Дата начала:** 21.04.2026  
> **Статус:** 🔄 IN_PROGRESS  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Устранить findings из compliance-аудита сервиса импорта БД (Settings → Import).
Аудит выявил 3 HIGH, 1 MEDIUM, 1 LOW нарушения правил разработки без затрагивания архитектуры.

### Контекст
Проведён ревью-аудит по AI_CODING_GUIDELINES + DEVELOPMENT_RULES для DB Import feature (TASK-070).
Функционал работает, но нарушает правила двойной валидации, обработки ошибок и управления ресурсами.

### Ожидаемый результат
- Все 5 findings закрыты
- Нет новых TypeScript-ошибок
- Нет регрессий в логике импорта

---

## 🗂️ Затрагиваемые файлы

```
electron/
  database.cjs              ← HIGH-3: resource leak targetDb + LOW-1: дубль в whitelist
src/
  services/dbImportService.ts  ← HIGH-1: добавить Zod frontend validation
  modules/settings/SettingsModule.tsx  ← HIGH-2: try/catch + MEDIUM-2: security warning UI
```

---

## ✅ Checklist

- [x] Zod-валидация: Backend (уже была)
- [ ] Zod-валидация: Frontend (HIGH-1)
- [x] `ensureAuthenticated` на IPC handlers
- [x] `logger.*` вместо `console.*`
- [ ] try/catch в async UI handlers (HIGH-2)
- [x] Транзакции для DB-операций
- [ ] Нет resource leak (HIGH-3)
- [ ] Нет magic strings / дублирования (LOW-1)
- [ ] Security warning для users/roles в UI (MEDIUM-2)

---

## 📐 План реализации

### Этап 1: Backend — устранение resource leak targetDb
**Статус:** ✅ DONE  
**Файлы:** `electron/database.cjs`

- [x] Вынести `let targetDb` перед outer try
- [x] Добавить `if (targetDb) targetDb.close()` в outer finally
- [x] Убрать дублирование `vaccination_profiles` в IMPORTABLE_TABLES
- [x] Inner finally: оставить только `foreign_keys = ON`, убрать `targetDb.close()`

### Этап 2: Service layer — добавить Zod frontend validation
**Статус:** ✅ DONE  
**Файлы:** `src/services/dbImportService.ts`

- [x] Добавлен `DbImportExecuteInputSchema` (mirrors backend schema)
- [x] `executeImport` вызывает `safeParse()` перед IPC-вызовом, возвращает `{ success: false, error }` при невалидных данных

### Этап 3: UI — try/catch и security warning
**Статус:** ✅ DONE  
**Файлы:** `src/modules/settings/SettingsModule.tsx`

- [x] `handleImportSelectFile` обёрнут в try/catch, при ошибке `importStep → 'idle'`
- [x] `handleImportExecute` обёрнут в try/catch, при ошибке `importStep → 'selecting'`
- [x] Добавлен красный badge «⚠ Учётные записи» для таблиц users/roles/user_roles

### Этап 4: Верификация
**Статус:** ✅ DONE

- [x] `get_errors` — 0 ошибок во всех 3 файлах

---

## 📝 Журнал выполнения

### 21.04.2026 — Старт задачи
- Задача создана по результатам compliance-аудита DB Import feature
- 5 findings: HIGH-3 (resource leak), HIGH-1 (no frontend Zod), HIGH-2 (no try/catch), LOW-1 (duplicate), MEDIUM-2 (no security warning)
- Приступаем к реализации

### 21.04.2026 — Реализация завершена
- Этап 1: targetDb вынесен в outer scope, inner finally очищен, дубль vaccination_profiles удалён
- Этап 2: DbImportExecuteInputSchema добавлен в dbImportService.ts, safeParse перед IPC
- Этап 3: try/catch в обоих UI handlers, красный badge для security-таблиц
- Этап 4: get_errors → 0 ошибок во всех файлах
- **Статус задачи: ✅ DONE**
