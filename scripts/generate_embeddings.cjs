/**
 * Скрипт для генерации embeddings для всех существующих заболеваний
 * Используется при первом запуске или миграции
 * 
 * Использование:
 * node scripts/generate_embeddings.cjs
 */

const { app } = require('electron');
const { prisma } = require('../electron/prisma-client.cjs');
const { generateEmbedding } = require('../electron/services/embeddingService.cjs');
const { logger } = require('../electron/logger.cjs');

async function main() {
    console.log('Starting embeddings generation for all diseases...');

    try {
        // Получаем все заболевания без embeddings
        const diseases = await prisma.disease.findMany({
            where: {
                OR: [
                    { symptomsEmbedding: null },
                    { symptomsEmbedding: '' }
                ]
            }
        });

        console.log(`Found ${diseases.length} diseases without embeddings`);

        if (diseases.length === 0) {
            console.log('All diseases already have embeddings. Exiting.');
            return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < diseases.length; i++) {
            const disease = diseases[i];
            const symptoms = JSON.parse(disease.symptoms || '[]');

            if (!symptoms || symptoms.length === 0) {
                console.log(`[${i + 1}/${diseases.length}] Skipping ${disease.nameRu} - no symptoms`);
                continue;
            }

            try {
                const symptomsText = symptoms.join(', ');
                const embedding = await generateEmbedding(symptomsText);

                await prisma.disease.update({
                    where: { id: disease.id },
                    data: {
                        symptomsEmbedding: JSON.stringify(embedding)
                    }
                });

                successCount++;
                console.log(`[${i + 1}/${diseases.length}] ✓ Generated embedding for: ${disease.nameRu}`);

                // Небольшая задержка, чтобы не превысить rate limits
                if (i < diseases.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            } catch (error) {
                errorCount++;
                console.error(`[${i + 1}/${diseases.length}] ✗ Failed for ${disease.nameRu}:`, error.message);
                logger.error(`[GenerateEmbeddings] Failed for disease ${disease.id}:`, error);
            }
        }

        console.log('\n=== Summary ===');
        console.log(`Total: ${diseases.length}`);
        console.log(`Success: ${successCount}`);
        console.log(`Errors: ${errorCount}`);
        console.log('Done!');

    } catch (error) {
        console.error('Fatal error:', error);
        logger.error('[GenerateEmbeddings] Fatal error:', error);
        process.exit(1);
    }
}

app.whenReady().then(() => {
    main()
        .catch(e => {
            console.error('Error:', e);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
            process.exit(0);
        });
});
