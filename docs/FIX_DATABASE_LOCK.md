# Решение проблемы блокировки базы данных

## Проблема

База данных SQLite заблокирована при попытке применения миграций:
```
Error: SQLite database error
database is locked
```

## Причины

1. **Приложение Electron все еще работает** - процессы Node.js держат соединения с базой данных
2. **Prisma Client не закрыт** - соединения остаются открытыми после закрытия приложения
3. **Миграция ожидает** - Prisma Migrate не может получить эксклюзивный доступ к базе

## Решение

### Шаг 1: Закрыть все процессы Electron/Node

**Windows:**
```powershell
# Найти процессы
Get-Process | Where-Object {$_.ProcessName -like "*electron*" -or $_.ProcessName -like "*node*"} | Stop-Process -Force

# Или через Task Manager:
# 1. Открыть Диспетчер задач (Ctrl+Shift+Esc)
# 2. Найти процессы "Electron" или "Node.js"
# 3. Завершить их
```

**Или через командную строку:**
```cmd
taskkill /F /IM electron.exe
taskkill /F /IM node.exe
```

### Шаг 2: Проверить блокировку файла

```powershell
# Проверить, открыт ли файл базы данных
Get-Process | Where-Object {$_.Path -like "*dev.db*"}

# Если файл открыт другим процессом - закрыть его
```

### Шаг 3: Применить миграцию

После закрытия всех процессов:

```bash
# Проверить статус миграций
npx prisma migrate status

# Применить миграцию
npx prisma migrate deploy

# Или для dev окружения
npx prisma migrate dev
```

### Шаг 4: Проверить подключение

```bash
# Генерация Prisma Client
npx prisma generate

# Проверка подключения
npx prisma db execute --stdin < echo "SELECT 1;"
```

## Предотвращение проблемы

### Добавить обработку закрытия соединения

В `electron/main.cjs` добавлена обработка закрытия приложения:

```javascript
app.on('before-quit', async (event) => {
    logger.info('[Main] Application is closing, disconnecting Prisma...');
    try {
        await prisma.$disconnect();
        logger.info('[Main] Prisma disconnected successfully');
    } catch (error) {
        logger.error('[Main] Error disconnecting Prisma:', error);
    }
});
```

### Настройка таймаутов SQLite

В `prisma-client.cjs` можно добавить:

```javascript
const prisma = new PrismaClient({
    adapter,
    log: isDev ? ['query', 'info', 'warn', 'error'] : ['error'],
    datasources: {
        db: {
            url: `file:${dbPath}?busy_timeout=5000` // Таймаут 5 секунд
        }
    }
});
```

## Альтернативное решение

Если база все еще заблокирована:

1. **Временно переименовать базу данных:**
   ```powershell
   Rename-Item prisma\dev.db prisma\dev.db.backup
   ```

2. **Создать новую базу с миграциями:**
   ```bash
   npx prisma migrate deploy
   ```

3. **Перенести данные из backup** (если нужно)

## Проверка после исправления

1. Запустить приложение
2. Проверить логи на ошибки подключения
3. Убедиться, что миграция применена:
   ```bash
   npx prisma migrate status
   ```
