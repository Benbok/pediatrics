# TASK-075 — Google AI Keys: In-App Encrypted Storage + Full CRUD UI

> **Модуль:** `settings / ai / apiKeyManager`
> **Дата начала:** 20.04.2026
> **Статус:** ✅ DONE
> **Приоритет:** HIGH

---

## 📋 Описание задачи

Убрать зависимость от `.env` файла для Google Gemini API ключей.  
Ключи хранятся **внутри приложения** в зашифрованном JSON-файле (AES-256-GCM через существующий `crypto.cjs`).  
Управление ключами — полноценный CRUD в разделе «Настройки → ИИ».  
Ключи нельзя прочитать вне приложения.

**Что НЕ меняется:**
- Локальная LLM (Ollama) — без изменений
- Логика ротации ключей в apiKeyManager
- IPC-каналы для pool-status, reset, connectivity-test

---

## 🗂️ Затрагиваемые файлы

```
electron/
  services/
    apiKeyStore.cjs          ← NEW: encrypted file-based key storage
    apiKeyManager.cjs        ← load from store instead of env
    cdssService.cjs          ← remove env fallback (use manager only)
  database.cjs               ← add CRUD IPC handlers
  preload.cjs                ← expose new IPC channels
src/
  services/
    apiKeyService.ts         ← add CRUD methods
    geminiService.ts         ← remove localStorage / env, use IPC
  modules/settings/
    SettingsModule.tsx        ← CRUD UI for keys
```

---

## 📐 Дизайн хранилища

### Файл: `{userData}/gemini-keys.enc.json`

```json
{
  "version": 1,
  "keys": [
    {
      "id": "uuid-v4",
      "label": "Основной ключ",
      "encryptedValue": "<AES-256-GCM encrypted>",
      "createdAt": "ISO8601",
      "updatedAt": "ISO8601"
    }
  ]
}
```

- `encryptedValue` — результат `encrypt(rawKey)` из `crypto.cjs`
- Ключ шифруется machine-bound ключом приложения
- Исходный API-ключ **никогда не передаётся** в UI

---

## ✅ IPC Contracts

### Новые каналы
| Channel | Direction | Payload | Response |
|---------|-----------|---------|----------|
| `api-keys:list` | invoke | — | `ApiKeyEntry[]` (без encryptedValue) |
| `api-keys:add` | invoke | `{ label, value }` | `{ success, id }` |
| `api-keys:delete` | invoke | `{ id }` | `{ success }` |
| `api-keys:update-label` | invoke | `{ id, label }` | `{ success }` |

### Существующие (без изменений)
`api-keys:get-pool-status`, `api-keys:reset-key`, `api-keys:reset-all`, `api-keys:test-connectivity`

---

## ✅ Checklist

- [ ] `apiKeyStore.cjs` — CRUD методы + шифрование
- [ ] `apiKeyManager.cjs` — `initialize()` читает из store (с env-fallback для миграции)
- [ ] `database.cjs` — 4 новых IPC handler-а
- [ ] `preload.cjs` — 4 новых expose
- [ ] `apiKeyService.ts` — `listKeys`, `addKey`, `deleteKey`, `updateKeyLabel`
- [ ] `geminiService.ts` — убрать localStorage/env зависимость
- [ ] `SettingsModule.tsx` — CRUD UI (список, добавить, удалить, переименовать)
- [ ] env fallback задокументирован (работает как миграция, но не обязателен)

---

## 📝 Журнал выполнения

### 20.04.2026 — Создание и планирование
- Задача TASK-075 создана
- Анализ текущей архитектуры выполнен
- `electron/services/apiKeyStore.cjs` — создан, полный AES-256-GCM CRUD
- `electron/services/apiKeyManager.cjs` — переключён на `loadKeysFromStore()`
- `electron/modules/apiKeys/handlers.cjs` — добавлены 4 CRUD-обработчика IPC
- `electron/preload.cjs` — добавлены 4 канала в contextBridge
- `src/services/apiKeyService.ts` — добавлены `listKeys/addKey/deleteKey/updateKeyLabel`
- `src/types.ts` — добавлены типы для 4 новых IPC-методов
- `src/modules/settings/SettingsModule.tsx` — полный CRUD-UI, убрано .env, убраны устаревшие хэндлеры
- `electron/services/cdssService.cjs` — убраны env-fallback'и в `getApiKey()`
- Все TypeScript-ошибки: 0
