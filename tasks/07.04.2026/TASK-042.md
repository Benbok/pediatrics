# TASK-042 — Developer Bootstrap: First Run + Client Provisioning Workflow

> **Модуль:** `license/bootstrap`
> **Дата начала:** 07.04.2026
> **Статус:** 🔄 IN_PROGRESS
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Спроектировать и реализовать безопасный end-to-end workflow предоставления доступа к приложению:

1. **First Run Setup** — разработчик ставит скомпилированный `.exe`, видит визард первого запуска,
   импортирует `private.pem`, создаёт свой admin-аккаунт, получает лицензию для своей машины,
   и сразу входит в приложение.

2. **Client Provisioning** — из панели «Лицензии» в настройках разработчик одним действием
   создаёт юзера (doctor) + генерирует `license.json`. Скачивает оба, передаёт клиенту.

## 🔐 Security/Architecture Decisions

### private.pem location (packaged app)
`admin-handlers.cjs` сейчас читает `../../keys/private.pem` (внутри asar → сломано в prod).
**Fix:** `app.getPath('userData')/private.pem` → `%APPDATA%\PediAssist\private.pem`
Dev fallback: `../../keys/private.pem` (если не найден в userData).

### init-db.cjs bootstrap
Сейчас бросает `Error` если нет `ADMIN_PASSWORD`. В packaged app это ломает первый старт.
**Fix:** если пароль не задан → пропустить создание, залогировать warning.
First Run Setup завершит инициализацию.

### First Run guard
`auth:first-run-setup` работает ТОЛЬКО если `userCount === 0` AND `private.pem` существует в userData.
Присутствие private.pem = доказательство что это разработчик.

### Роли
- Разработчик → admin + doctor
- Клиент → doctor only (нельзя дать admin через client bundle)

---

## 🗂️ Затрагиваемые файлы

```
electron/
  init-db.cjs                              ← graceful missing ADMIN_PASSWORD
  auth.cjs                                 ← auth:is-first-run, auth:first-run-setup
  license/
    admin-handlers.cjs                     ← new paths + check-key + import-key
                                              + generate-own-license + create-client-bundle
  preload.cjs                              ← expose new IPC
src/
  types.ts                                 ← ClientBundle, new electronAPI methods
  App.tsx                                  ← first-run state
  modules/license/
    FirstRunSetupPage.tsx                  ← NEW: developer setup wizard
    LicenseAdminPanel.tsx                  ← add key import + client bundle sections
```

---

## 📐 Plan realized

All stages completed in single session.
