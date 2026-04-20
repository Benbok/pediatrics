# TASK-071 — Bugfix: IPC channel mismatch для createBackup

> **Модуль:** `settings / backup`
> **Дата начала:** 20.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Ручное резервное копирование (кнопка «Создать копию сейчас» в Настройки → Безопасность)
не работало из-за несовпадения IPC-канала.

### Root Cause

| Слой | Значение канала |
|------|----------------|
| `electron/preload.cjs` (было) | `'create-backup'` |
| `electron/database.cjs` (handler) | `'db:create-backup'` |

Renderer invokе уходил в пустоту — Electron выбрасывал
`Error: No handler registered for ipc channel`.

### Ожидаемый результат

Один символ-разрыв устранён: preload использует правильный канал `db:create-backup`.
Автоматический backup (вызывается при старте напрямую) не затронут.

---

## 🗂️ Затронутые файлы

```
electron/
  preload.cjs   ← единственное изменение (строка 254)
```

---

## ✅ IPC Contract Audit

- [x] Handler имеет `ensureAuthenticated` — **уже было, не тронуто**
- [x] Zod-валидация отсутствует намеренно (нет payload) — **ок**
- [x] `src/types.ts` не требует изменений (сигнатура не менялась)
- [x] Компонент вызывает через сервисный слой (`handleCreateBackup → window.electronAPI.createBackup()`)
- [x] Канал preload → handler приведён в соответствие

---

## 📝 Журнал выполнения

### 20.04.2026 — Фикс

- Анализ: preload использует `'create-backup'`, handler зарегистрирован как `'db:create-backup'`.
- Применён минимальный diff: `preload.cjs:254` — `'create-backup'` → `'db:create-backup'`.
- Тесты: 382 passed, 1 skipped. Регрессий нет.
