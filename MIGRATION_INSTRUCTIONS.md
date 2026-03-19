# Инструкция по применению миграции

---

## Текущий статус проекта (после исправления)

> **Вывод: добавлять новые модули безопасно.** `npx prisma migrate dev --name add_new_module` работает корректно.

### Почему будущие миграции не пострадают

1. **`guideline_chunks_fts` и все shadow-таблицы физически существуют в `dev.db`** — они никогда не были реально удалены. Команда `prisma migrate resolve --applied` только пометила миграцию как применённую в `_prisma_migrations`, не выполняя SQL.

2. **Prisma игнорирует FTS-таблицы при проверке синхронизации** — потому что `guideline_chunks_fts` создана через raw SQL и **не является моделью в `schema.prisma`**. Prisma сравнивает только то, что знает из схемы.

3. **Триггеры FTS продолжают работать** — `guideline_chunks_ai`, `guideline_chunks_ad`, `guideline_chunks_au` ссылаются на `guideline_chunks_fts`, которая по-прежнему существует.

4. **Shadow DB валидация чистая** — при создании новой миграции Prisma прогоняет все 32 миграции в shadow DB, включая `20260319080016` (DROP IF EXISTS). Финальное состояние shadow DB совпадает с `schema.prisma` → drift не обнаруживается.

### Текущее состояние миграций

| Имя | Статус | Содержимое |
|-----|--------|------------|
| `20260319075808_add_nutrition_module` | ✅ applied | CREATE TABLE для 6 nutrition-таблиц + RedefineTables для `children` |
| `20260319080016_add_nutrition_module` | ✅ applied (resolve) | DROP TABLE IF EXISTS для FTS-таблиц (фактически не выполнялся) |

> ⚠️ **Особенность:** оба folder имеют суффикс `_add_nutrition_module`. Это нормально — они различаются по timestamp. Не удалять ни один из них.

---

## Проблема 1: FTS5 shadow-таблицы блокируют `migrate dev` (P3006)

### Симптом

```
Error: P3006
Migration `XXXXXXXXXXXXXXXX_add_nutrition_module` failed to apply cleanly to the shadow database.
Error:
SQLite database error
no such table: guideline_chunks_fts_config
```

Также возможна ошибка drift:

```
Drift detected: Your database schema is not in sync with your migration history.
[-] Removed tables
  - guideline_chunks_fts
  - guideline_chunks_fts_config
  ...
```

### Причина

Prisma использует теневую (shadow) базу данных для валидации миграций. В SQLite FTS5 при выполнении `DROP TABLE "guideline_chunks_fts"` (виртуальная таблица) **автоматически удаляются все shadow-таблицы** (`_config`, `_data`, `_idx`, `_docsize`, `_content`). Если после этого миграция пытается явно удалить те же shadow-таблицы без `IF EXISTS` — возникает ошибка «no such table».

Дополнительно: если миграция с DROP помечена как «rolled back» (failed) в `_prisma_migrations`, Prisma не считает её применённой и видит FTS-таблицы в «ожидаемой» схеме — возникает drift с реальной БД.

### Решение (было применено в проекте)

**Шаг 1.** Добавить `IF EXISTS` во все `DROP TABLE` для FTS-таблиц в проблемной миграции:

```sql
-- Было:
DROP TABLE "guideline_chunks_fts";
DROP TABLE "guideline_chunks_fts_config";

-- Стало:
DROP TABLE IF EXISTS "guideline_chunks_fts";
DROP TABLE IF EXISTS "guideline_chunks_fts_config";
```

**Шаг 2.** Пересчитать SHA-256 нового содержимого файла миграции и обновить запись в `_prisma_migrations`. Скрипт (`scripts/fix-fts-migration.py`) делает это автоматически:

```bash
python scripts/fix-fts-migration.py
```

**Шаг 3.** Пометить миграцию как применённую (если она осталась в состоянии rolled back):

```bash
npx prisma migrate resolve --applied <migration_name>
# Пример:
npx prisma migrate resolve --applied 20260319080016_add_nutrition_module
```

**Шаг 4.** Проверить, что всё в порядке:

```bash
npx prisma migrate status
# Ожидается: "Database schema is up to date!"

npx prisma migrate dev
# Ожидается: "Already in sync, no schema change or pending migration was found."
```

### Правило для будущих миграций, затрагивающих FTS-таблицы

Всегда используйте `DROP TABLE IF EXISTS` для удаления FTS5 virtual table и её shadow-таблиц. Никогда не удаляйте shadow-таблицы (`_config`, `_data` и т.д.) отдельно — достаточно удалить основную виртуальную таблицу, и SQLite каскадно удалит все shadow-таблицы.

```sql
-- Правильно: удалить только виртуальную таблицу
DROP TABLE IF EXISTS "guideline_chunks_fts";

-- Неправильно: пытаться удалить shadow-таблицы отдельно
-- DROP TABLE "guideline_chunks_fts_config";  -- ошибка после DROP виртуальной таблицы
```

### Когда снова может возникнуть эта проблема

Проблема возникнет снова ТОЛЬКО если:
1. Через raw SQL (вне миграции) будет создана новая FTS5 таблица (например, через `electron/init-db.cjs` или скрипт).
2. Потом будет запущен `prisma migrate dev` — Prisma обнаружит неизвестную таблицу и добавит `DROP TABLE` без `IF EXISTS`.

**Решение:** никогда не создавать долгоживущие объекты схемы (таблицы, virtual tables, триггеры) через `db.exec()` за пределами Prisma миграций.

### Утилита `scripts/fix-fts-migration.py`

Скрипт создан для автоматического исправления описанной проблемы. Делает три вещи:
1. Читает SQL файл миграции
2. Добавляет `IF EXISTS` ко всем `DROP TABLE` для FTS-таблиц
3. Пересчитывает SHA-256 и обновляет `_prisma_migrations.checksum`

> **Важно:** Prisma хранит SHA-256 хэш каждого `migration.sql` в поле `checksum`. При ручном редактировании файла миграции — хэш устаревает и Prisma откажется применять другие миграции. Скрипт обновляет хэш автоматически.

Запуск:
```bash
python scripts/fix-fts-migration.py
```

---

## Проблема 2: База данных заблокирована

При попытке применить миграцию возникает ошибка:
```
Error: SQLite database error
database is locked
```

### Решение

#### Шаг 1: Закрыть все процессы Electron/Node

**Важно:** Нужно полностью закрыть приложение перед применением миграции!

**Способ 1: Через командную строку (рекомендуется)**
```cmd
taskkill /F /IM electron.exe
taskkill /F /IM node.exe
```

**Способ 2: Через PowerShell**
```powershell
Get-Process | Where-Object {$_.ProcessName -like "*electron*" -or $_.ProcessName -like "*node*"} | Stop-Process -Force
```

**Способ 3: Вручную**
1. Откройте Диспетчер задач (Ctrl+Shift+Esc)
2. Найдите все процессы "Electron" и "Node.js"
3. Завершите их все

#### Шаг 2: Подождать 2-3 секунды

Дайте время системе освободить блокировки файлов.

#### Шаг 3: Применить миграцию

```bash
# Проверить статус
npx prisma migrate status

# Применить миграцию
npx prisma migrate deploy
```

Или для dev окружения:
```bash
npx prisma migrate dev
```

#### Шаг 4: Проверить результат

```bash
npx prisma migrate status
npx prisma generate
```

### Что было исправлено в коде

1. ✅ **Добавлена обработка закрытия соединений** в `electron/main.cjs`:
   - `before-quit` — отключение Prisma перед выходом
   - `will-quit` — финальная очистка

2. ✅ **Добавлен busy_timeout для SQLite** в `electron/prisma-client.cjs`:
   - Таймаут 5 секунд для обработки параллельных запросов

3. ✅ **Обработка сигналов SIGINT/SIGTERM**:
   - Graceful shutdown при завершении процесса

---

## После применения миграций

1. **Перезапустите приложение:**
   ```bash
   npm run electron:dev
   ```

2. **Проверьте логи** на наличие ошибок подключения.

3. **Убедитесь, что таблицы созданы:**
   ```bash
   npx prisma migrate status
   # Ожидается: "Database schema is up to date!"
   ```

---

## Если проблема не решена: крайние меры

> ⚠️ **Только для dev-окружения!** Все данные будут удалены.

1. **Резервная копия:**
   ```cmd
   copy prisma\dev.db prisma\dev.db.backup
   ```

2. **Полный сброс:**
   ```bash
   npx prisma migrate reset
   ```

3. **Или удалите WAL/SHM файлы** (если БД заблокирована файловыми остатками):
   ```cmd
   del prisma\dev.db-wal
   del prisma\dev.db-shm
   ```

---

## Диагностика: что в базе прямо сейчас

```bash
# Список всех таблиц в dev.db
python -c "import sqlite3; db=sqlite3.connect('prisma/dev.db'); c=db.cursor(); c.execute(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\"); [print(r[0]) for r in c.fetchall()]; db.close()"

# Состояние миграций
python -c "import sqlite3; db=sqlite3.connect('prisma/dev.db'); c=db.cursor(); c.execute('SELECT migration_name, finished_at, rolled_back_at, applied_steps_count FROM _prisma_migrations ORDER BY started_at'); [print(r) for r in c.fetchall()]; db.close()"
```
