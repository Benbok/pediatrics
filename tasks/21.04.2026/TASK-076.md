# TASK-076 — License Variant A: Auto-provision user from signed license payload

> **Модуль:** `license/auth`  
> **Дата начала:** 21.04.2026  
> **Статус:** 🔄 IN_PROGRESS  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Реализовать полный Variant A для first-run user flow:
- admin при создании клиентского license.json передает логин и пароль в защищенном виде;
- клиент при импорте license.json получает авто-создание пользователя в локальной БД;
- ручной шаг ввода логина/пароля в first-run user flow убирается.

### Контекст
Текущая реализация создает пользователя только в БД администратора при `license-admin:create-client-bundle`, а на клиентской машине пользователь вводит credentials вручную. Это разрывает контракт admin->client и создает риск несоответствия учетных данных.

### Ожидаемый результат
1. Подписанный payload лицензии содержит `username` и `passwordHash` (bcrypt hash).
2. `license:import` при first run создает user+role doctor в клиентской БД из payload.
3. UI first-run user flow после успешного импорта пропускает ручной ввод credentials.
4. Сохранена обратная совместимость: старые лицензии без credentials продолжают импортироваться (с fallback поведением).

---

## 🗂️ Затрагиваемые файлы

- `electron/license/admin-handlers.cjs`
- `electron/license/verify.cjs`
- `electron/license/handlers.cjs`
- `src/modules/license/FirstRunUserWaitPage.tsx`
- `src/modules/settings/SettingsModule.tsx`
- `tasks/TASKS.md`
- `tasks/21.04.2026/TASK-076.md`

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [x] Синхронизация context7 перед стартом
- [ ] Type hints на всех функциях
- [ ] Zod-валидация: Frontend + Backend
- [ ] `ensureAuthenticated` на IPC handlers
- [ ] `logger.*` вместо `console.*`
- [ ] `logAudit` для CRUD-операций
- [ ] Транзакции для связанных DB-операций
- [ ] Нет magic numbers (используем `constants.ts`)
- [ ] Код в правильном слое (Component / Service / IPC / DB)
- [ ] Производные списки через `useMemo`, не `useState + useEffect`
- [ ] CacheService для новых GET/mutation handlers
- [ ] Unit тесты написаны

---

## 📐 План реализации

### Этап 1: Prisma/Migration impact check
**Статус:** ✅ DONE  
**Файлы:** `prisma/schema.prisma` (read-only)

- [x] Подтвердить, что изменение не требует миграции схемы БД
- [x] Зафиксировать результат в журнале

### Этап 2: Validators / payload contract hardening
**Статус:** ✅ DONE  
**Файлы:** `electron/license/verify.cjs`

- [x] Расширить контракт payload опциональными полями credentials
- [x] Добавить безопасную проверку формата credentials

### Этап 3: IPC backend (admin + import)
**Статус:** ✅ DONE  
**Файлы:** `electron/license/admin-handlers.cjs`, `electron/license/handlers.cjs`

- [x] Включить `username` и `passwordHash` в подписанный payload лицензии
- [x] На импорте лицензии выполнять авто-provision пользователя в клиентской БД
- [x] Сохранить backward compatibility для лицензий без credentials

### Этап 4: Types sync
**Статус:** ✅ DONE  
**Файлы:** `src/types.ts` (только при необходимости)

- [x] Обновить тип ответа `importLicense` если расширяется возвращаемая структура

### Этап 5: Service layer
**Статус:** ✅ DONE  
**Файлы:** `src/services/*` (только при необходимости)

- [x] Проверить, требуется ли изменение сервиса для нового контракта

### Этап 6: UI flow
**Статус:** ✅ DONE  
**Файлы:** `src/modules/license/FirstRunUserWaitPage.tsx`

- [x] Удалить обязательность ручного ввода credentials при успешном auto-provision
- [x] Добавить fallback UI для старых лицензий (без credentials)

### Этап 7: Tests and verification
**Статус:** 🔄 IN_PROGRESS  
**Файлы:** `tests/**`, `src/**`

- [x] Прогнать обязательные тесты для новой функциональности
- [x] Зафиксировать результаты и риски

---

## 📝 Журнал выполнения

### 21.04.2026 — Старт задачи
- Создан TASK-076 и зафиксирован scope Variant A
- Подтверждена необходимость IPC contract change (admin license generation + client license import)
- Запущена поэтапная реализация согласно обязательному порядку проекта

### 21.04.2026 09:08 — Этап 1 завершён
- Проверен `prisma/schema.prisma`: структура `users`, `roles`, `user_roles` уже покрывает Variant A
- Миграции не требуются, изменения ограничены license/auth IPC и UI flow
- Этап 2 (validators/contract hardening) переведен в IN_PROGRESS

### 21.04.2026 09:11 — Этапы 2-6 завершены
- `verify.cjs`: расширен и ужесточен контракт payload для опциональных credentials в подписанных лицензиях
- `admin-handlers.cjs`: `username` + `passwordHash` добавлены в подписанный payload при create-client-bundle
- `handlers.cjs`: реализован auto-provision user+doctor-role на клиентской машине при `license:import`
- Сохранена backward compatibility: старые лицензии без credentials продолжают работать через ручной fallback
- `types.ts` синхронизирован под расширенный ответ `importLicense`
- `FirstRunUserWaitPage.tsx`: при `autoProvisioned=true` доступ открывается сразу без ручного ввода

### 21.04.2026 09:12 — Этап 7 проверка тестов
- Выполнена команда `npm run test -- --run`
- Результат: `26 passed, 1 skipped, 1 failed file (3 failed tests)`
- Падения вне scope TASK-076: `tests/diseaseAssistantMode.test.ts` (ожидания по direct-mode LLM сообщению/доступности)
- По измененным файлам TASK-076: статический анализ (`get_errors`) без ошибок
- Текущий статус этапа 7 оставлен `IN_PROGRESS` до решения по несвязанным test-failures

### 21.04.2026 09:19 — Hotfix по обратной связи пользователя
- Исправлен production runtime error в `license:import`: удален несовместимый аргумент `skipDuplicates` из `tx.userRole.createMany(...)`
- Дефолт темы переключен на светлую (без авто-перехода в dark по системным настройкам)
- Экраны активации (user/admin first-run) переведены на светлую тему по умолчанию с поддержкой dark при ручном переключении
- Проверка измененных файлов через `get_errors`: без ошибок

### 21.04.2026 09:21 — Smoke-run после hotfix
- Выполнен `npm run electron:build`: сборка production успешна, инсталлятор создан
- Выполнен `npm run electron:dev`: main/renderer стартуют без crash, инициализация БД/IPC проходит успешно
- Новая ошибка `skipDuplicates` в runtime не наблюдается на старте
- Сообщения `Autofill.enable/setAddresses` подтверждены как devtools-шум (не функциональная ошибка)

### 21.04.2026 09:24 — Дополнительный UI hotfix (First Run Scenario)
- `FirstRunScenarioPage` переведен на светлую тему по умолчанию (раньше использовал жестко заданный dark gradient)
- Добавлены `dark:*` классы для сохранения ручной поддержки темной темы
- Проверка файла через `get_errors`: без ошибок

### 21.04.2026 09:29 — Обновление прав для license-provisioned admin
- `license:import` теперь создает/синхронизирует локального пользователя как `isAdmin=true` и назначает роли `admin+doctor`
- Для уже существующего пользователя синхронизируется `passwordHash` из подписанного payload лицензии, чтобы вход соответствовал переданным credentials
- Вкладка «Лицензии» в настройках теперь показывается только при двух условиях: `admin` + локально присутствует `private.pem`
- Таким образом пользователь может управлять локальными учетными записями, но не получает доступ к license-admin разделу без приватного ключа
- Проверка измененных файлов через `get_errors`: без ошибок

---

## 🔗 Связанные файлы и ресурсы

- `tasks/TASKS.md`
- `tasks/AGENT.md`
- `AI_CODING_GUIDELINES.md`
- `DEVELOPMENT_RULES.md`
- `electron/license/LICENSING.md`

---

## ✅ Финальный отчёт

**Дата завершения:** —  
**Итог:** —  
**Изменённые файлы:**
- —

**Обновлённые README:**
- —
