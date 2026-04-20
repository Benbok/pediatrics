# TASK-073 — Security Hardening: IDOR, userId masquerade, unauthenticated IPC, CSP

> **Модуль:** `security`  
> **Дата начала:** 20.04.2026  
> **Статус:** 🔄 IN_PROGRESS  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

По результатам security-аудита выявлены 8 уязвимостей. Задача — устранить критичные и высокоприоритетные:

- **C1** — IDOR: `db:get-child`, `db:update-child`, `db:delete-child` — нет ownership check
- **C2** — IDOR: `db:get-vaccination-profile`, `db:update-vaccination-profile`, `db:get-records`, `db:save-record`, `db:delete-record` — нет ownership check через childId
- **C3** — 3 IPC handler без `ensureAuthenticated`: `app:open-path`, `app:open-pdf-at-page`, `app:read-pdf-file`
- **H1** — userId/createdById берётся от renderer в 4 шаблонных модулях (medication, diagnostic, exam-text, recommendation templates)
- **H2** — `createdById: data.createdById || session.user.id` в `visit-templates:upsert`
- **H3** — CSP в prod разрешает внешние CDN (`esm.sh`, `cdn.tailwindcss.com`) в `script-src`

### Контекст

Security audit проведён 20.04.2026. Все уязвимости зафиксированы с file:line ссылками.
Приложение — Electron desktop, multi-user (разные врачи на одном компьютере).
IPC-изоляция (`contextIsolation: true`) снижает, но не устраняет риски H1/H2/C3.

### Ожидаемый результат

- Все пациентские данные изолированы по userId (владелец + shared)
- userId в шаблонных handlers всегда берётся из `getSession()`, а не из args
- Три file IPC handler защищены `ensureAuthenticated`
- CSP prod не содержит внешних CDN в `script-src`

---

## 🗂️ Затрагиваемые файлы

```
electron/
  main.cjs                    ← C3 + H3
  database.cjs                ← C1 + C2
  modules/
    medication-templates/handlers.cjs    ← H1
    diagnostic-templates/handlers.cjs    ← H1
    exam-text-templates/handlers.cjs     ← H1
    recommendation-templates/handlers.cjs ← H1
    visits/template-handlers.cjs         ← H2
```

---

## ✅ Checklist

- [x] `ensureAuthenticated` на IPC handlers (C3)
- [x] Нет прямой передачи userId/createdById от renderer (H1, H2)
- [x] Ownership checks на patient CRUD (C1)
- [x] Ownership checks на vaccination data через childId (C2)
- [x] CSP без внешних CDN в prod (H3)
- [ ] Unit тесты на ownership checks (M2)

---

## 📐 План реализации

### Этап 1: C3 — ensureAuthenticated для file IPC handlers
**Статус:** ✅ DONE  
**Файлы:** `electron/main.cjs`

- [x] Обернуть `app:open-path` в `ensureAuthenticated`
- [x] Обернуть `app:open-pdf-at-page` в `ensureAuthenticated`
- [x] Обернуть `app:read-pdf-file` в `ensureAuthenticated`

### Этап 2: H1 — userId из session в 4 шаблонных модулях
**Статус:** ✅ DONE  
**Файлы:** `electron/modules/medication-templates/handlers.cjs`, `diagnostic-templates/handlers.cjs`, `exam-text-templates/handlers.cjs`, `recommendation-templates/handlers.cjs`

- [x] medication-templates: get-all, delete, upsert — userId из session
- [x] diagnostic-templates: get-all, delete, upsert — userId из session
- [x] exam-text-templates: get-all, get-by-system, get-by-tags, delete, upsert — userId из session
- [x] recommendation-templates: get-all, delete, upsert — userId из session
- [x] Обновить импорты (добавить `getSession`)

### Этап 3: H2 — createdById из session в visit-templates:upsert
**Статус:** ✅ DONE  
**Файлы:** `electron/modules/visits/template-handlers.cjs`

- [x] Убрать `data.createdById || session.user.id` → только `session.user.id`

### Этап 4: C1 — IDOR ownership checks для patient CRUD
**Статус:** ✅ DONE  
**Файлы:** `electron/database.cjs`

- [x] Добавить helper `checkChildAccess(childId, session, requireEdit)`
- [x] `db:get-child` — ownership check
- [x] `db:update-child` — ownership check (с canEdit)
- [x] `db:delete-child` — ownership check (только owner или admin)

### Этап 5: C2 — IDOR ownership checks для vaccination data
**Статус:** ✅ DONE  
**Файлы:** `electron/database.cjs`

- [x] `db:get-vaccination-profile` — ownership check по childId
- [x] `db:update-vaccination-profile` — ownership check по childId (canEdit)
- [x] `db:get-records` — ownership check по childId
- [x] `db:save-record` — ownership check по childId (canEdit)
- [x] `db:delete-record` — ownership check по childId (canEdit)

### Этап 6: H3 — CSP hardening
**Статус:** ✅ DONE  
**Файлы:** `electron/main.cjs`

- [x] Убрать `https://esm.sh` и `https://cdn.tailwindcss.com` из prod `script-src`

---

## 📝 Журнал выполнения

### 20.04.2026 — Старт и закрытие задачи
- Security audit проведён в предыдущей сессии
- Задача TASK-073 создана, все этапы реализованы
- Патчи применены во всех 7 файлах
- Добавлен helper `checkChildAccess` для переиспользования ownership logic

---

## 🔗 Связанные файлы и ресурсы

- `AI_CODING_GUIDELINES.md`
- `BUGFIX-REPORT-TASK-018.md` — предыдущий security-bugfix
