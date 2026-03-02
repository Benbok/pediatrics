# Сервис кеширования (CacheService)

## Общее описание

`CacheService` — централизованный in-memory сервис кеширования данных в процессе Electron. Используется IPC-обработчиками для уменьшения обращений к БД: списки пациентов, профили вакцинации, записи прививок, каталоги заболеваний и препаратов кешируются по namespace с настраиваемым TTL и автоматической инвалидацией при изменениях.

**Расположение:** `electron/services/cacheService.cjs`  
**Использование:** только в backend (IPC handlers в `electron/database.cjs` и `electron/modules/*/handlers.cjs`). Frontend кеш не видит.

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│  IPC Handler (database.cjs, modules/*/handlers.cjs)         │
│  - get(namespace, key)  → при промахе: запрос к Prisma       │
│  - set(namespace, key, value) после чтения/записи            │
│  - invalidate(namespace, key?) при мутациях                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  CacheService (electron/services/cacheService.cjs)           │
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

| Namespace   | TTL    | Статус   | Владелец / использование |
|------------|--------|----------|---------------------------|
| `children` | 60 с   | активен  | `database.cjs` — списки пациентов по пользователю, один ребёнок по id |
| `diseases` | 300 с  | активен  | `electron/modules/diseases/handlers.cjs` — список всех, заболевание по id |
| `medications` | 300 с | активен | `electron/modules/medications/handlers.cjs` — список всех, по id, по diseaseId |
| `users`    | 300 с  | **не используется** | Нет вызовов get/set/invalidate |
| `profiles` | 60 с   | активен  | `database.cjs` — профиль вакцинации по childId |
| `records`  | 30 с   | активен  | `database.cjs` — записи прививок по childId |
| `visits`   | 60 с   | **не используется** | Модуль visits не использует CacheService |

Конфигурация TTL задаётся в `cacheService.cjs` в `NAMESPACE_CONFIG`. Максимальный размер кеша — 10 000 записей (суммарно); при переполнении удаляются самые старые 10% в текущем namespace.

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

Используется в: `db:create-child`, `db:update-child`, `db:delete-child`, `db:share-patient`, `db:unshare-patient`, а также в модулях diseases и medications.

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

Важно: при инвалидации использовать тот же формат ключа, что и при `set`, иначе запись останется в кеше до истечения TTL.

## IPC-управление кешем

Доступно из renderer (через preload) для отладки и сброса:

| Канал | Описание |
|-------|----------|
| `cache:get-stats` | Возвращает статистику: hits, misses, sets, invalidations, hitRate, размер по namespace, кол-во устаревших записей. |
| `cache:clear-all` | Полная очистка всех namespace. |
| `cache:clear-namespace` | Очистка одного namespace; аргумент: строка namespace (например `children`, `profiles`). |

Все три handler защищены `ensureAuthenticated`.

## Известные проблемы и техдолг

1. **Неиспользуемые namespace**  
   `users` и `visits` объявлены в `NAMESPACE_CONFIG`, но ни один handler их не использует. Модуль визитов каждый раз ходит в Prisma. Рекомендация: либо подключить кеш для `visits`, либо убрать namespace из конфига.

2. **Ошибка инвалидации в `medications:delete`**  
   Файл: `electron/modules/medications/handlers.cjs`, ~строка 108.  
   Вызов: `CacheService.invalidate('medications', 'by_disease_${id}')` — неверный префикс (`by_disease_` вместо `disease_`) и неверный id (id препарата вместо id заболевания). Списки препаратов по заболеванию (`disease_${diseaseId}`) после удаления препарата не инвалидируются. Нужно инвалидировать ключи `disease_*` для всех заболеваний, с которыми был связан удалённый препарат, или перейти на инвалидацию всего namespace при delete.

3. **Избыточная инвалидация в `medications:upsert`**  
   Файл: `electron/modules/medications/handlers.cjs`, строки 80–87.  
   Сначала инвалидируются `all` и `id_${result.id}`, затем вызывается `invalidate('medications')` (весь namespace). Первые два вызова не дают эффекта. Имеет смысл оставить только полную инвалидацию namespace или только точечную.

4. **Асимметричная инвалидация при share/unshare пациента**  
   Файл: `electron/database.cjs`, обработчики `db:share-patient` и `db:unshare-patient`.  
   Инвалидируются только ключи `user_${userId}_admin_false`. Если пользователь, которому расшаривают/убирают доступ, — администратор, его ключ `user_${userId}_admin_true` не очищается, список пациентов будет устаревшим до истечения TTL (60 с). Рекомендация: инвалидировать оба ключа (`_admin_false` и `_admin_true`) для затронутого пользователя.

5. **Разная стратегия после мутаций в database.cjs**  
   Вакцинация: write-through для `db:update-vaccination-profile`, `db:save-record`, `db:delete-record`.  
   Пациенты: только invalidate для `db:update-child` (и других child/share handlers). Поведение кеша после изменений непоследовательно. Рекомендация: по возможности перевести обновления пациентов на write-through для предсказуемости и меньшей нагрузки на БД при повторном открытии карточки.

6. **Отсутствие инвалидации в handlers заметок заболеваний**  
   Файл: `electron/modules/diseases/handlers.cjs`, обработчики `diseases:notes-create`, `diseases:notes-update`, `diseases:notes-delete`.  
   После создания/обновления/удаления заметки кеш заболевания `diseases:id_${diseaseId}` не инвалидируется. Если в кешированном объекте заболевания есть заметки, они будут устаревшими до 5 минут. Нужно вызывать `CacheService.invalidate('diseases', 'id_${diseaseId}')` после каждой из этих операций.

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
| Парсинг/формат данных на границе (в handler при set после чтения из БД) | Рекомендовано в README, соблюдается в актуальных handler |
| Единообразие стратегии (write-through vs invalidate) | Частично: в vaccination — write-through, в children/diseases/medications — в основном invalidate; в разделе «Известные проблемы» указано как техдолг |

Дополнительно: все IPC handlers, использующие кеш, должны быть защищены `ensureAuthenticated` и валидировать входящие данные (Zod) до операций с БД и кешем — это обеспечивается на уровне отдельных handlers, а не самого CacheService.
