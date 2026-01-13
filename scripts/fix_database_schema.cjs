/**
 * Скрипт для исправления структуры базы данных
 * Удаляет старое поле symptoms_vector, если оно существует
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

async function fixDatabase() {
    console.log('Checking database schema...');

    const dbPath = path.join(__dirname, '../prisma/dev.db');
    
    if (!fs.existsSync(dbPath)) {
        console.error('Database file not found:', dbPath);
        return;
    }

    const db = new Database(dbPath);
    
    try {
        // Проверяем структуру таблицы diseases
        const tableInfo = db.prepare('PRAGMA table_info(diseases)').all();
        console.log('Current columns in diseases table:');
        tableInfo.forEach(col => {
            console.log(`  - ${col.name} (${col.type})`);
        });

        const hasOldField = tableInfo.some(col => col.name === 'symptoms_vector');
        const hasNewField = tableInfo.some(col => col.name === 'symptoms_embedding');

        if (hasOldField && !hasNewField) {
            console.log('\n⚠️  Found old field symptoms_vector, migrating data...');
            
            // Копируем данные из старого поля в новое
            db.exec(`
                ALTER TABLE diseases ADD COLUMN symptoms_embedding TEXT;
                UPDATE diseases SET symptoms_embedding = symptoms_vector WHERE symptoms_vector IS NOT NULL;
            `);
            
            console.log('✅ Data migrated to symptoms_embedding');
        }

        if (hasOldField) {
            console.log('\n⚠️  Removing old field symptoms_vector...');
            
            // SQLite не поддерживает DROP COLUMN напрямую, нужно пересоздать таблицу
            db.exec(`
                PRAGMA foreign_keys=OFF;
                
                CREATE TABLE diseases_new (
                    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                    icd10_code TEXT NOT NULL UNIQUE,
                    icd10_codes TEXT NOT NULL DEFAULT '[]',
                    name_ru TEXT NOT NULL,
                    name_en TEXT,
                    description TEXT NOT NULL,
                    symptoms TEXT NOT NULL DEFAULT '[]',
                    symptoms_embedding TEXT,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                
                INSERT INTO diseases_new (id, icd10_code, icd10_codes, name_ru, name_en, description, symptoms, symptoms_embedding, created_at)
                SELECT id, icd10_code, icd10_codes, name_ru, name_en, description, symptoms, symptoms_embedding, created_at
                FROM diseases;
                
                DROP TABLE diseases;
                ALTER TABLE diseases_new RENAME TO diseases;
                
                PRAGMA foreign_keys=ON;
            `);
            
            console.log('✅ Old field removed');
        }

        // Проверяем результат
        const finalInfo = db.prepare('PRAGMA table_info(diseases)').all();
        console.log('\n✅ Final columns in diseases table:');
        finalInfo.forEach(col => {
            console.log(`  - ${col.name} (${col.type})`);
        });

        console.log('\n✅ Database schema fixed!');
        
    } catch (error) {
        console.error('❌ Error fixing database:', error);
        throw error;
    } finally {
        db.close();
    }
}

fixDatabase()
    .then(() => {
        console.log('\n✅ Done!');
        process.exit(0);
    })
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
