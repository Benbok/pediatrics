# TASK-041 — UI-панель администратора лицензий

> **Модуль:** `license/admin`  
> **Дата начала:** 07.04.2026  
> **Статус:** 🔄 IN_PROGRESS  
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Создать UI-панель для управления лицензиями приложения PediAssist, доступную только разработчику.  
Панель должна позволять:
- Видеть все выданные лицензии (реестр), их статусы и срок действия  
- Генерировать новые лицензии прямо из UI (без CLI)  
- Отзывать лицензии (блокировать доступ)  
- Продлевать срок действия  
- Скачивать сгенерированный `license.json` для передачи пользователю  
- Видеть сводную статистику (всего / активных / истёкших / отозванных)

### Контекст
Текущая система — полностью CLI (`tools/generate-license.cjs`). Разработчику необходимо каждый раз вручную запускать команду, сохранять файл и передавать пользователю. Реестра выданных лицензий нет — нет контроля.

### Ожидаемый результат
1. `electron/license/admin-handlers.cjs` — IPC-обработчики для 5 admin-операций
2. `src/modules/license/LicenseAdminPanel.tsx` — React-компонент с полным UI  
3. Новый таб "Лицензии" в `SettingsModule.tsx` (отображается только при наличии приватного ключа)
4. `keys/license-registry.json` — создаётся автоматически при первой генерации  
5. Типы в `src/types.ts`  
6. Строки в `electron/preload.cjs`

---

## 🔐 Архитектурные решения

### Реестр лицензий
- Хранится в `keys/license-registry.json` (рядом с `private.pem`, только на машине разработчика)
- JSON с массивом `LicenseRecord[]`
- Каждая запись содержит: id, userName, fingerprint, issuedAt, expiresAt, notes, revokedAt, licensePayload, licenseSignature

### Безопасность
- Все admin IPC-обработчики проверяют **наличие приватного ключа** (`keys/private.pem`)
- Если ключа нет — операция отклоняется (т.е. на машинах пользователей admin-функции недоступны)
- Обработчики НЕ закрыты `isDev` — они нужны и в production-сборке на машине разработчика

### Отзыв лицензии
- "Отзыв" = установка `revokedAt` в реестре (мягкое удаление)
- Физический файл `license.json` уже у пользователя — он продолжит работать до следующего перегенерирования
- Реальная блокировка требует новой версии с `revocation list` — ВЫНЕСЕНО ЗА РАМКИ задачи (future work)

### Продление
- Создаётся **новый** подписанный license.json с новой датой `expiresAt`
- Старая запись в реестре обновляется, новый файл доступен для скачивания

---

## 🗂️ Затрагиваемые файлы

```
electron/
  license/
    admin-handlers.cjs        ← НОВЫЙ: IPC admin handlers
electron/
  main.cjs                    ← регистрация admin handlers
  preload.cjs                 ← expose licenseAdmin API
src/
  types.ts                    ← LicenseRecord, LicenseStats, LicenseGenerateInput
  modules/license/
    LicenseAdminPanel.tsx     ← НОВЫЙ: React component
  modules/settings/
    SettingsModule.tsx        ← добавить вкладку "Лицензии"
keys/
  license-registry.json       ← создаётся автоматически (gitignored)
```

---

## ✅ Checklist (из AI_CODING_GUIDELINES)

- [x] Type hints на всех функциях
- [x] `logger.*` вместо `console.*`
- [x] `logAudit` для генерации и отзыва лицензий
- [x] Код в правильном слое (Component / IPC / File I/O)
- [x] Нет magic numbers
- [x] Безопасность: private key guard на admin-операциях

---

## 📐 План реализации

### Этап 1: Backend — admin-handlers.cjs
**Статус:** ✅ DONE  
**Файлы:** `electron/license/admin-handlers.cjs`

IPC-каналы:
- `license-admin:list` → возвращает весь реестр
- `license-admin:generate` → генерирует license.json + добавляет в реестр
- `license-admin:revoke` → устанавливает `revokedAt`
- `license-admin:extend` → обновляет expiresAt, перегенерирует подпись
- `license-admin:export` → возвращает base64 license.json для скачивания

### Этап 2: Main + Preload
**Статус:** ✅ DONE  
**Файлы:** `electron/main.cjs`, `electron/preload.cjs`

### Этап 3: Types
**Статус:** ✅ DONE  
**Файлы:** `src/types.ts`

### Этап 4: Frontend — LicenseAdminPanel.tsx
**Статус:** ✅ DONE  
**Файлы:** `src/modules/license/LicenseAdminPanel.tsx`

UI секции:
- Статистика: карточки (всего / активных / истёкших / отозванных)
- Форма генерации: поля userName, fingerprint, expiresAt, notes
- Таблица реестра с пагинацией и сортировкой
- Actions: Generate Download, Revoke, Extend (popup)
- Статус-бейджи: Active / Expired / Revoked

### Этап 5: Интеграция в Settings
**Статус:** ✅ DONE  
**Файлы:** `src/modules/settings/SettingsModule.tsx`

---

## 📝 Execution Log

| Время | Действие |
|-------|----------|
| 07.04.2026 | Задача создана, архитектура спроектирована |
| 07.04.2026 | Реализованы все этапы |
