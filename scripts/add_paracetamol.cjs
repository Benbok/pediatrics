const { app } = require('electron');
const { prisma } = require('../electron/prisma-client.cjs');

async function main() {
    console.log('Starting Paracetamol import...');

    const icd10Codes = ['J06.9', 'J10', 'K08.8', 'M79.1', 'M79.2', 'N94.4', 'N94.5', 'R50', 'R51', 'R52.0', 'R52.2'];

    // Check if already exists to avoid dupes 
    const existing = await prisma.medication.findFirst({
        where: { nameRu: 'Парацетамол' }
    });

    if (existing) {
        console.log('Medication "Парацетамол" already exists with ID:', existing.id);
        return;
    }

    const medication = await prisma.medication.create({
        data: {
            nameRu: 'Парацетамол',
            nameEn: 'Paracetamol',
            activeSubstance: 'Парацетамол',
            atcCode: 'N02BE01',
            manufacturer: 'ТАТХИМФАРМПРЕПАРАТЫ, АО',
            packageDescription: 'Раствор для приема внутрь (вишневый, ванильный, клубничный, апельсиновый) 24 мг/1 мл: фл. 50 мл, 100 мл, 150 мл или 200 мл в компл. с мерн. ложкой или стаканчиком',
            icd10Codes: JSON.stringify(icd10Codes),
            forms: JSON.stringify([]),
            pediatricDosing: JSON.stringify([
                {
                    minAgeMonths: 0,
                    maxAgeMonths: 216,
                    mgPerKg: 15,
                    timesPerDay: 4,
                    maxDailyMg: 60,
                    instruction: 'Внутрь, интервал не менее 4 часов. Разовая доза 10-15 мг/кг.'
                }
            ]),
            adultDosing: JSON.stringify({
                instruction: 'Взрослым: 500 мг до 4 раз в сутки.'
            }),
            contraindications: 'Повышенная чувствительность к парацетамолу, тяжелые нарушения функции печени, тяжелые нарушения функции почек.',
            indications: JSON.stringify(icd10Codes.map(code => ({ code }))),
            vidalUrl: 'https://www.vidal.ru/drugs/paracetamol-5'
        }
    });

    console.log('Successfully created medication:', medication.id, medication.nameRu);
}

// Since we are running with 'electron', we should wait for app ready or just run.
// But mostly we just need the node environment that matches electron.
// We'll wrap in app.whenReady to be safe regarding any electron-specifics in prisma-client or elsewhere.
app.whenReady().then(() => {
    main()
        .catch(e => {
            console.error('Error creating medication:', e);
            process.exit(1);
        })
        .finally(async () => {
            // We don't necessarily need to disconnect if we exit, but good practice
            process.exit(0);
        });
});
