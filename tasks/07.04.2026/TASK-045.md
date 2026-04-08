# TASK-045 — Settings Security UI: hide Licenses for non-admin

> **Модуль:** `settings/security-ui`
> **Дата начала:** 07.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** MEDIUM

---

## 📋 Описание задачи

Скрыть вкладку «Лицензии» в настройках для пользователей без роли `admin`.

## ✅ Реализация

1. В `SettingsModule` подключен `useAuth`, добавлено вычисление `isAdmin`.
2. Кнопка таба «🔑 Лицензии» рендерится только для admin.
3. Контент таба `LicenseAdminPanel` также показывается только для admin.
4. Добавлен safety-redirect: если non-admin каким-то образом попал на `activeTab='licenses'`, таб переключается на `api`.

## 🧪 Верификация

- `src/modules/settings/SettingsModule.tsx` — diagnostics OK
