# Инструкция по применению миграции

## Проблема: База данных заблокирована

При попытке применить миграцию возникает ошибка:
```
Error: SQLite database error
database is locked
```

## Решение

### Шаг 1: Закрыть все процессы Electron/Node

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

### Шаг 2: Подождать 2-3 секунды

Дайте время системе освободить блокировки файлов.

### Шаг 3: Применить миграцию

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

### Шаг 4: Проверить результат

```bash
# Генерация Prisma Client
npx prisma generate

# Проверка подключения
npx prisma db execute --stdin
# Введите: SELECT name FROM sqlite_master WHERE type='table' AND name='informed_consents';
# Нажмите Ctrl+D для завершения
```

## Что было исправлено

1. ✅ **Добавлена обработка закрытия соединений** в `electron/main.cjs`:
   - `before-quit` - отключение Prisma перед выходом
   - `will-quit` - финальная очистка

2. ✅ **Добавлен busy_timeout для SQLite** в `electron/prisma-client.cjs`:
   - Таймаут 5 секунд для обработки параллельных запросов

3. ✅ **Обработка сигналов SIGINT/SIGTERM**:
   - Graceful shutdown при завершении процесса

## После применения миграции

После успешного применения миграции:

1. **Перезапустите приложение:**
   ```bash
   npm run electron:dev
   ```

2. **Проверьте логи** на наличие ошибок подключения

3. **Проверьте новые таблицы:**
   - `informed_consents` - должна существовать
   - `visit_templates` - должна существовать
   - `visits` - должна иметь все новые поля

## Если проблема сохраняется

1. **Временно переименуйте базу данных:**
   ```cmd
   ren prisma\dev.db prisma\dev.db.backup
   ```

2. **Создайте новую базу:**
   ```bash
   npx prisma migrate deploy
   ```

3. **Перенесите данные** из backup при необходимости

4. **Или удалите WAL/SHM файлы:**
   ```cmd
   del prisma\dev.db-wal
   del prisma\dev.db-shm
   ```

**Примечание:** Удаление WAL/SHM файлов может привести к потере последних транзакций, но это безопасно если приложение полностью закрыто.
