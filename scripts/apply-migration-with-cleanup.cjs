/**
 * Скрипт для очистки старой таблицы visits и применения миграции
 * 
 * Использование:
 * node scripts/apply-migration-with-cleanup.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const clearScriptPath = path.join(__dirname, 'clear-visits-table.sql');

async function cleanupAndMigrate() {
    console.log('🧹 Начинаем очистку и применение миграции...\n');

    try {
        // Шаг 1: Очищаем данные через Prisma CLI
        console.log('🗑️  Удаляем старые данные из таблицы visits...');
        
        // Создаем временный SQL файл для очистки
        const cleanupSQL = `
-- Удаляем связанные записи informed_consents (если таблица существует)
DELETE FROM informed_consents WHERE visit_id IS NOT NULL;

-- Удаляем все записи из таблицы visits
DELETE FROM visits;
`;
        
        const tempSqlPath = path.join(__dirname, 'temp-cleanup.sql');
        fs.writeFileSync(tempSqlPath, cleanupSQL);
        
        try {
            // Выполняем SQL через Prisma
            execSync(`npx prisma db execute --file ${tempSqlPath} --schema prisma/schema.prisma`, {
                stdio: 'inherit',
                cwd: path.join(__dirname, '..')
            });
            console.log('✅ Старые данные удалены\n');
        } catch (e) {
            // Если ошибка - возможно таблицы еще нет, это нормально
            console.log('ℹ️  Таблица visits может быть пустой или еще не создана (это нормально)\n');
        } finally {
            // Удаляем временный файл
            if (fs.existsSync(tempSqlPath)) {
                fs.unlinkSync(tempSqlPath);
            }
        }

        // Шаг 5: Применяем миграцию
        console.log('📦 Применяем миграцию...');
        execSync('npx prisma migrate deploy', {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        
        // Шаг 6: Генерируем Prisma Client
        console.log('\n⚙️  Генерируем Prisma Client...');
        execSync('npx prisma generate', {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
        });
        
        console.log('\n✅ Готово! Миграция применена успешно.');
        console.log('📝 Теперь можно запускать приложение: npm run electron:dev');
        
    } catch (error) {
        console.error('\n❌ Ошибка:', error.message);
        console.error('\nПолная ошибка:', error);
        process.exit(1);
    }
}

// Запускаем скрипт
cleanupAndMigrate();
