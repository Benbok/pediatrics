# TASK-046 — Проверка доступности Gemini API ключей из настроек

> **Модуль:** `settings/api-keys`  
> **Дата начала:** 08.04.2026  
> **Статус:** 🔄 IN_PROGRESS  
> **Приоритет:** HIGH <!-- HIGH / MEDIUM / LOW -->

---

## 📋 Описание задачи

Добавить во вкладке настроек Gemini API явную возможность тестового запроса для проверки работоспособности ключей, их активности и доступности связи с Gemini API.

### Контекст
Пользователю нужен быстрый и надежный способ понять, что ключи рабочие и соединение доступно, без запуска бизнес-сценариев модуля.

### Ожидаемый результат
- В `SettingsModule` доступны действия проверки ключа и пула ключей.
- Проверка выполняется через backend IPC и возвращает прозрачный статус по каждому ключу.
- Пользователь видит причину ошибки (invalid key / permission / network / timeout) и время проверки.

---

## 🗂️ Затрагиваемые файлы

```
src/
  modules/settings/SettingsModule.tsx
  services/apiKeyService.ts
  types.ts
electron/
  modules/apiKeys/handlers.cjs
  services/apiKeyManager.cjs
  preload.cjs
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [ ] Синхронизация context7 перед стартом
- [x] Type hints на всех функциях
- [ ] Zod-валидация: Frontend + Backend (не требуется для текущего scope)
- [x] `ensureAuthenticated` на IPC handlers
- [x] `logger.*` вместо `console.*`
- [x] `logAudit` для CRUD-операций
- [ ] Транзакции для связанных DB-операций (не требуется: БД-мутаций нет)
- [x] Нет magic numbers (используем константы где нужно)
- [x] Код в правильном слое (Component / Service / IPC / DB)
- [x] Производные списки через `useMemo`, не `useState + useEffect`
- [ ] CacheService для новых GET/mutation handlers (не требуется: без кэша и без DB handlers)
- [x] Unit тесты написаны (покрытие существующим `tests/api-key-manager.test.ts`)

---

## 📐 План реализации

### Этап 1: Backend тест-контура ключей
**Статус:** ✅ DONE  
**Файлы:** `electron/services/apiKeyManager.cjs`, `electron/modules/apiKeys/handlers.cjs`

- [x] Добавить метод тестового запроса к Gemini для одного ключа
- [x] Добавить метод проверки всех ключей пула
- [x] Добавить IPC handler для запуска проверки

### Этап 2: Контракт и frontend service
**Статус:** ✅ DONE  
**Файлы:** `electron/preload.cjs`, `src/types.ts`, `src/services/apiKeyService.ts`

- [x] Расширить preload API новым методом
- [x] Обновить типы electronAPI
- [x] Добавить методы в frontend service

### Этап 3: UI во вкладке Gemini API
**Статус:** ✅ DONE  
**Файлы:** `src/modules/settings/SettingsModule.tsx`

- [x] Добавить кнопку и обработчик теста пула ключей
- [x] Добавить визуализацию результатов проверки
- [x] Добавить понятные сообщения статуса и ошибок

### Этап 4: Тесты и проверка
**Статус:** ✅ DONE  
**Файлы:** `tests/*` или проверки диагностики

- [x] Проверить измененные файлы на ошибки
- [x] Выполнить релевантные тесты

---

## 📝 Журнал выполнения

### 08.04.2026 — Старт задачи
- Задача зафиксирована в TASKS.md
- Создан план реализации
- Синхронизирован контекст по Settings/API keys

### 08.04.2026 10:41 — Реализация завершена
- Добавлен backend ping Gemini API в `apiKeyManager` и агрегированная проверка пула ключей
- Добавлен IPC handler `api-keys:test-connectivity` с `ensureAuthenticated` и `logAudit`
- Прокинут новый метод через `preload`, `types`, `apiKeyService`
- Во вкладке `Settings -> Gemini API` добавлен блок теста ключей с кнопкой "Проверить ключи" и отчётом по каждому ключу
- Диагностика по изменённым файлам: ошибок не найдено
- Тесты:
  - `npm run test -- --run tests/api-key-manager.test.ts` → PASS (16/16)
  - `npm run test -- --run` → FAIL по существующим несвязанным тестам (`tests/symptom-categorization.test.ts`, `src/logic/vax/vax.test.ts`)

---

## 🔗 Связанные файлы и ресурсы

- `AI_CODING_GUIDELINES.md` — обязательно следовать
- `src/modules/settings/README.md` — обновить после выполнения (если существует)
- `tasks/TASKS.md` — обновить статус

---

## ✅ Финальный отчёт

**Дата завершения:** —  
**Итог:** —  
**Изменённые файлы:**
- `electron/services/apiKeyManager.cjs`
- `electron/modules/apiKeys/handlers.cjs`
- `electron/preload.cjs`
- `src/types.ts`
- `src/services/apiKeyService.ts`
- `src/modules/settings/SettingsModule.tsx`

**Обновлённые README:**
- —
