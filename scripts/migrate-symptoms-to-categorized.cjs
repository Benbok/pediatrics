/**
 * Миграция симптомов из формата string[] в формат {text, category}[]
 * Создает backup перед миграцией.
 *
 * Использование: node scripts/migrate-symptoms-to-categorized.cjs
 */

const path = require('path');
const fs = require('fs');

async function main() {
    const { prisma } = require('../electron/prisma-client.cjs');

    console.log('Начинаем миграцию симптомов...');

    const backupDir = path.join(__dirname, '..', 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }
    const backupPath = path.join(backupDir, `diseases_backup_${Date.now()}.json`);

    try {
        const allDiseases = await prisma.disease.findMany();
        fs.writeFileSync(backupPath, JSON.stringify(allDiseases, null, 2));
        console.log('Backup создан:', backupPath);
    } catch (error) {
        console.error('Не удалось создать backup:', error.message);
        console.log('Продолжить без backup? (Ctrl+C для отмены)');
        await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    const diseases = await prisma.disease.findMany();
    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (const disease of diseases) {
        try {
            const symptoms = JSON.parse(disease.symptoms || '[]');

            if (symptoms.length > 0 && typeof symptoms[0] === 'object' && symptoms[0] !== null && 'text' in symptoms[0]) {
                console.log('Заболевание', disease.id, '(' + disease.nameRu + ') уже мигрировано');
                skipped++;
                continue;
            }

            const categorized = symptoms.map((text) => ({
                text: String(text).trim(),
                category: 'other',
            })).filter((s) => s.text.length > 0);

            await prisma.disease.update({
                where: { id: disease.id },
                data: {
                    symptoms: JSON.stringify(categorized),
                },
            });

            console.log('Мигрировано', disease.nameRu + ':', categorized.length, 'симптомов');
            migrated++;
        } catch (error) {
            console.error('Ошибка при миграции', disease.id, '(' + disease.nameRu + '):', error.message);
            failed++;
        }
    }

    console.log('\n=== Миграция завершена ===');
    console.log('Успешно:', migrated);
    console.log('Пропущено:', skipped);
    console.log('Ошибок:', failed);
    console.log('Backup:', backupPath);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => {
        try {
            const { prisma } = require('../electron/prisma-client.cjs');
            prisma.$disconnect();
        } catch (_) {}
    });
