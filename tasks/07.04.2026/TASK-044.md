# TASK-044 — License Security Hardening

> **Модуль:** `license/security`
> **Дата начала:** 07.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Закрыть риск подмены `private.pem` и несанкционированного доступа к admin-license операциям.

## 🔐 План

1. Валидация импортируемого private.pem на соответствие встроенному PUBLIC_KEY.
2. Ограничение IPC каналов `license-admin:*` по роли admin.
3. Разрешение bootstrap каналов только для first-run или admin.
4. Ужесточение first-run guard в auth (ключ должен соответствовать PUBLIC_KEY).
5. Проверка ошибок по измененным файлам.

---

## ✅ Реализация

1. `private.pem` теперь принимается только если криптографически подтверждено соответствие встроенному `PUBLIC_KEY` приложения (challenge sign/verify).
2. `license-admin:list|generate|revoke|extend|export|create-client-bundle` переведены под `ensureAuthenticated + ensureAdmin`.
3. Bootstrap-каналы `license-admin:import-key` и `license-admin:generate-own-license` разрешены только в first-run, иначе — только admin.
4. В packaged режиме убран доверительный fallback на `keys/private.pem` для приватного ключа.
5. `auth:first-run-setup` дополнительно проверяет, что найденный private key соответствует встроенному `PUBLIC_KEY`.

## 🧪 Верификация

Diagnostics (`get_errors`):

- `electron/license/admin-handlers.cjs` — OK
- `electron/auth.cjs` — OK
