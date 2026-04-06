# TASK-036 — Стабилизация визуального прогресса фоновой загрузки файлов в Базе знаний

> **Модуль:** `diseases/guidelines`  
> **Дата начала:** 07.04.2026  
> **Статус:** ✅ DONE  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

При загрузке PDF-файлов во вкладке «Файлы» модуля База знаний прогресс отображался только пока пользователь находился в текущем экране. После перехода в другой раздел визуальная индикация пропадала, хотя backend-процесс загрузки продолжал выполняться и файл появлялся позже.

### Контекст
Локальный state прогресса и подписка на `onUploadProgress` были реализованы внутри `GuidelinesList.tsx`. При размонтировании компонента подписка удалялась, а события прогресса терялись для UI.

### Ожидаемый результат
- Прогресс фоновой загрузки сохраняется между переходами по маршрутам.
- При возврате на экран пользователь видит актуальный статус jobs.
- Локальная UI-логика списка файлов остается прежней, но получает данные из устойчивого глобального источника.

---

## 🗂️ Затрагиваемые файлы

- `src/context/UploadProgressContext.tsx` (новый)
- `src/App.tsx`
- `src/modules/diseases/components/GuidelinesList.tsx`
- `tasks/TASKS.md`
- `tasks/07.04.2026/TASK-036.md`
- `src/modules/diseases/README.md`

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [x] Синхронизация context7 перед стартом (не требовалось: нет внешней библиотечной интеграции)
- [x] Type hints на всех функциях
- [x] Zod-валидация: Frontend + Backend (без изменений контрактов/валидации)
- [x] `ensureAuthenticated` на IPC handlers (без изменений IPC)
- [x] `logger.*` вместо `console.*` (без backend-изменений)
- [x] `logAudit` для CRUD-операций (не применимо: CRUD не менялся)
- [x] Транзакции для связанных DB-операций (не применимо: DB не менялась)
- [x] Нет magic numbers
- [x] Код в правильном слое (Component / Context / App composition)
- [x] Производные списки через `useMemo`, не `useState + useEffect` (данные прогресса теперь производные из глобального контекста)
- [x] CacheService для новых GET/mutation handlers (не применимо)
- [x] Unit/регрессионные тесты прогнаны

---

## 📐 План реализации

### Этап 1: Вынести источник прогресса загрузки в глобальный слой
**Статус:** ✅ DONE  
**Файлы:** `src/context/UploadProgressContext.tsx`

- [x] Создать `UploadProgressProvider` с app-lifetime подпиской на `window.electronAPI.onUploadProgress`
- [x] Добавить API: `registerBatch`, `getProgressForDisease`, `clearCompletedForDisease`
- [x] Хранить связь `diseaseId -> jobIds` для фильтрации прогресса по заболеванию

### Этап 2: Подключить provider на уровне приложения
**Статус:** ✅ DONE  
**Файлы:** `src/App.tsx`

- [x] Импортировать `UploadProgressProvider`
- [x] Обернуть роутер и глобальные UI-слои в provider

### Этап 3: Перевести UI списка файлов на глобальный прогресс
**Статус:** ✅ DONE  
**Файлы:** `src/modules/diseases/components/GuidelinesList.tsx`

- [x] Удалить локальный `uploadProgress` state и локальную подписку `onUploadProgress`
- [x] Использовать `useUploadProgress()` для чтения прогресса и регистрации batch
- [x] Сохранить локальную логику `activeBatchId` и перезагрузки списка по `onUploadBatchFinished`
- [x] Добавить очистку завершенных/ошибочных job при ре-монтаже disease-экрана

### Этап 4: Тесты и верификация
**Статус:** ✅ DONE  
**Файлы:** `tests/disease-*.test.ts`

- [x] Прогнать релевантные disease-тесты
- [x] Подтвердить отсутствие TS-ошибок в измененных файлах

---

## 📝 Журнал выполнения

### 07.04.2026 18:54 — Старт
- Зафиксирован баг: потеря визуального прогресса загрузки при уходе с экрана «Файлы».
- Определена причина: локальная подписка в `GuidelinesList` размонтируется при навигации.

### 07.04.2026 18:59 — Этап 1 завершен
- Добавлен `UploadProgressContext` с глобальной подпиской на IPC-события прогресса.
- Реализована привязка jobs к disease для адресного отображения прогресса.

### 07.04.2026 19:01 — Этап 2 завершен
- `UploadProgressProvider` подключен в `App.tsx` вокруг router/layout слоя.

### 07.04.2026 19:03 — Этап 3 завершен
- `GuidelinesList` переведен на глобальный источник прогресса.
- Локальный `uploadProgress` и локальный `onUploadProgress` удалены.
- При добавлении batch выполняется `registerBatch(diseaseId, jobs)`.

### 07.04.2026 19:06 — Этап 4 завершен
- Запущены тесты:
  - `tests/disease-alias-linking.test.ts`
  - `tests/disease-medication-view-model.test.ts`
  - `tests/disease-medications-integration.test.ts`
  - `tests/disease-test-name-resolution.test.ts`
- Результат: 4 files passed, 31 tests passed.

### 07.04.2026 19:15 — Follow-up фикс UI прогресса
- Исправлен merge обновлений progress-state в `UploadProgressContext`: промежуточные IPC-события без `fileName` больше не затирают уже известное имя файла.
- Добавлен fallback имени `Файл загружается...` для ранних событий до полной инициализации.
- Повторно прогнаны релевантные disease-тесты: 4 files passed, 31 tests passed.

---

## 🔗 Связанные файлы и ресурсы

- `AI_CODING_GUIDELINES.md`
- `DEVELOPMENT_RULES.md`
- `tasks/AGENT.md`
- `tasks/TASKS.md`
- `src/modules/diseases/README.md`

---

## ✅ Финальный отчёт

**Дата завершения:** 07.04.2026  
**Итог:** UI прогресса фоновой загрузки файлов в Базе знаний теперь устойчив к навигации между разделами. При возврате в экран «Файлы» отображается актуальный статус загрузки.  
**Изменённые файлы:**
- `src/context/UploadProgressContext.tsx`
- `src/App.tsx`
- `src/modules/diseases/components/GuidelinesList.tsx`
- `tasks/TASKS.md`
- `tasks/07.04.2026/TASK-036.md`
- `src/modules/diseases/README.md`

**Обновлённые README:**
- `src/modules/diseases/README.md` — добавлена changelog-запись по TASK-036
