# Сервис кеширования (CacheService)

**Файл:** `README-cache-service.md`

## Общее описание

`CacheService` — централизованный in-memory сервис кеширования данных в процессе Electron. Используется IPC-обработчиками для уменьшения обращений к БД: списки пациентов, профили вакцинации, записи прививок, каталоги заболеваний и препаратов кешируются по namespace с настраиваемым TTL и автоматической инвалидацией при изменениях.

**Расположение:** `electron/services/cacheService.cjs`  
**Использование:** только в backend (IPC handlers в `electron/database.cjs` и `electron/modules/*/handlers.cjs`). Frontend кеш не видит.

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│  IPC Handler (database.cjs, modules/*/handlers.cjs)         │
│  - get(namespace, key)  → при промахе: запрос к Prisma       │
│  - set(namespace, key, value) после чтения/записи          │
│  - invalidate(namespace, key?) при мутациях                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  CacheService (electron/services/cacheService.cjs)         │
│  - Namespace-based хранилище (Map на namespace)              │
│  - TTL на запись, проверка при get                           │
│  - Фоновая очистка раз в 60 с                                │
│  - Логирование через logger                                  │
└─────────────────────────────────────────────────────────────┘
```

Принципы:
- **Один источник правды:** данные читаются из БД, кеш только ускоряет повторные чтения.
- **Инвалидация при записи:** любой handler, меняющий данные, обязан инвалидировать или обновить (write-through) соответствующие ключи.
- **Парсинг на границе:** в кеш кладётся уже приведённый к формату API объект (JSON распарсен, поля расшифрованы и т.д.).

## Карта namespace

| Namespace   | TTL    | Владелец / использование |
|------------|--------|---------------------------|
| `children` | 60 с   | `database.cjs` — списки пациентов по пользователю, один ребёнок по id |
| `diseases`  | 300 с  | `electron/modules/diseases/handlers.cjs` — список всех, заболевание по id |
| `medications` | 300 с | `electron/modules/medications/handlers.cjs` — список всех, по id, по diseaseId |
| `profiles` | 60 с   | `database.cjs` — профиль вакцинации по childId |
| `records`  | 30 с   | `database.cjs` — записи прививок по childId |
| `visits`   | 300 с  | `electron/modules/visits/handlers.cjs` — кэш `all_diagnostic_tests` |

Конфигурация TTL задаётся в `cacheService.cjs` в `NAMESPACE_CONFIG`. Максимальный размер кеша — 10 000 записей (суммарно); при переполнении удаляются самые старые 10% в текущем namespace. Namespace `users` удалён из конфига (не использовался).

## Паттерны работы с кешем

### Read-through (чтение с подстановкой из кеша)

При чтении: сначала `get`; при промахе — запрос к БД, приведение данных к формату API, `set`, возврат.

```javascript
const cacheKey = `child_${childId}`;
const cached = CacheService.get('profiles', cacheKey);
if (cached) return cached;

const profile = await prisma.vaccinationProfile.findUnique({ where: { childId } });
// ... парсинг, расшифровка ...
const parsed = { id: profile.id, childId: profile.childId, ... };
CacheService.set('profiles', cacheKey, parsed);
return parsed;
```

### Write-through (запись с обновлением кеша)

После мутации в БД — повторное чтение актуальных данных и `set` в кеш. Следующий read даёт cache hit.

```javascript
await prisma.vaccinationProfile.update({ where: { childId }, data: { ... } });
const updated = await prisma.vaccinationProfile.findUnique({ where: { childId } });
if (updated) {
  const parsedUpdated = { id: updated.id, ... };
  CacheService.set('profiles', `child_${childId}`, parsedUpdated);
}
return true;
```

Используется в: `db:update-vaccination-profile`, `db:save-record`, `db:delete-record`.

### Invalidate-only (инвалидация без подогрева)

После мутации вызывается только `CacheService.invalidate(namespace, key)`. Следующее чтение — cache miss и запрос к БД.

```javascript
await prisma.child.update({ where: { id }, data: validated });
CacheService.invalidate('children', `child_${id}`);
CacheService.invalidate('children', `user_${session.user.id}_admin_false`);
CacheService.invalidate('children', `user_${session.user.id}_admin_true`);
return result;
```

Используется в: `db:create-child`, `db:update-child`, `db:delete-child`, `db:share-patient`, `db:unshare-patient`, а также в модулях diseases и medications. При share/unshare инвалидируются оба ключа (`_admin_false` и `_admin_true`) для обоих пользователей, чтобы список пациентов обновлялся и у админов.

## Соглашения по ключам

| Namespace   | Формат ключа | Пример |
|------------|---------------|--------|
| `children` | `user_${userId}_admin_${isAdmin}` | `user_1_admin_false` |
| `children` | `child_${id}` | `child_42` |
| `diseases`  | `all` | список всех заболеваний |
| `diseases`  | `id_${id}` | `id_5` |
| `medications` | `all` | список всех препаратов |
| `medications` | `id_${id}` | `id_10` |
| `medications` | `disease_${diseaseId}` | `disease_3` |
| `profiles` | `child_${childId}` | `child_1` |
| `records`  | `child_${childId}` | `child_1` |
| `visits`   | `all_diagnostic_tests` | кэш справочника диагностических тестов |

Важно: при инвалидации использовать тот же формат ключа, что и при `set`, иначе запись останется в кеше до истечения TTL.

## IPC-управление кешем

Доступно из renderer (через preload) для отладки и сброса:

| Канал | Описание |
|-------|----------|
| `cache:get-stats` | Возвращает статистику: hits, misses, sets, invalidations, hitRate, размер по namespace, кол-во устаревших записей. |
| `cache:clear-all` | Полная очистка всех namespace. |
| `cache:clear-namespace` | Очистка одного namespace; аргумент: строка namespace (например `children`, `profiles`). |

Все три handler защищены `ensureAuthenticated`.

## Выполненные исправления (по аудиту)

Следующие пункты ранее относились к техдолгу и исправлены:

1. **Неиспользуемые namespace** — из `NAMESPACE_CONFIG` удалён `users`.
2. **medications:delete** — вместо неверного ключа `by_disease_${id}` выполняется полная инвалидация namespace `medications`.
3. **medications:upsert** — оставлен один вызов `CacheService.invalidate('medications')`.
4. **share/unshare пациента** — в `db:share-patient` и `db:unshare-patient` инвалидируются оба ключа (`user_*_admin_false` и `user_*_admin_true`) для текущего и целевого пользователя.
5. **Handlers заметок заболеваний** — в `diseases:notes-create`, `diseases:notes-update`, `diseases:notes-delete` добавлена инвалидация `CacheService.invalidate('diseases', 'id_${diseaseId}')`.

## Рекомендация на будущее

**Стратегия после мутаций:** в модуле пациентов используется только invalidate-only (`db:update-child`, `db:create-child`, share/unshare). Модуль вакцинации использует write-through. При необходимости снизить нагрузку на БД при частом открытии картотки пациента можно ввести write-through для `db:update-child` (после update перечитывать ребёнка и вызывать `CacheService.set('children', 'child_${id}', parsed)`).

## Как добавить кеширование в новый handler

1. **Выбрать namespace** (или завести новый в `NAMESPACE_CONFIG` с TTL в ms).
2. **Определить ключ** по соглашениям выше (например `entity_${id}`).
3. **Чтение (GET):**
   - В начале handler: `const cached = CacheService.get(namespace, key); if (cached) return cached;`
   - После получения данных из Prisma: привести к формату API, затем `CacheService.set(namespace, key, parsed); return parsed;`
4. **Запись (CREATE/UPDATE/DELETE):**
   - Либо **write-through:** после успешной мутации заново прочитать данные, распарсить и вызвать `CacheService.set(namespace, key, data)`.
   - Либо **invalidate-only:** вызвать `CacheService.invalidate(namespace, key)` (и при необходимости связанные ключи, например списки `user_*` при изменении ребёнка).
5. **Кросс-namespace:** при удалении сущности, от которой зависят другие кеши (например ребёнок → профиль вакцинации и записи), инвалидировать все затронутые ключи в соответствующих namespace (`profiles`, `records` и т.д.).

Минимальный шаблон read-through:

```javascript
const { CacheService } = require('../services/cacheService.cjs');

ipcMain.handle('db:get-something', ensureAuthenticated(async (_, id) => {
  const key = `item_${id}`;
  const cached = CacheService.get('myNamespace', key);
  if (cached) return cached;

  const row = await prisma.something.findUnique({ where: { id: Number(id) } });
  if (!row) return null;
  const result = { id: row.id, ... }; // формат для API
  CacheService.set('myNamespace', key, result);
  return result;
}));
```

## Соответствие AI_CODING_GUIDELINES.md

| Требование | Статус |
|------------|--------|
| Логирование через `logger`, не `console` | Выполнено |
| Ошибки в try/catch логируются и при необходимости пробрасываются | Выполнено |
| Сервис в правильном слое (backend, electron/services) | Выполнено |
| Нет бизнес-логики в кеше — только хранение и TTL | Выполнено |
| Парсинг/формат данных на границе (в handler при set после чтения из БД) | Соблюдается в handler |
| Единообразие стратегии (write-through vs invalidate) | Частично: vaccination — write-through, patients/diseases/medications — invalidate-only; документировано как осознанный выбор |

Дополнительно: все IPC handlers, использующие кеш, должны быть защищены `ensureAuthenticated` и валидировать входящие данные (Zod) до операций с БД и кешем — это обеспечивается на уровне отдельных handlers, а не самого CacheService.
