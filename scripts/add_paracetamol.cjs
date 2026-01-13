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

    // Новая структура форм выпуска (Vidal)
    const forms = [
        {
            type: 'solution',
            concentration: '24 мг/1 мл',
            volume: '50 мл, 100 мл, 150 мл, 200 мл',
            packaging: ['50 мл', '100 мл', '150 мл', '200 мл'],
            flavors: ['вишневый', 'ванильный', 'клубничный', 'апельсиновый'],
            description: 'Раствор для приема внутрь в комплекте с мерной ложкой или стаканчиком'
        }
    ];

    // Новая структура педиатрического дозирования (Vidal)
    const pediatricDosing = [
        {
            minAgeMonths: 0,
            maxAgeMonths: 3,
            dosing: {
                type: 'weight_based',
                mgPerKg: 10
            },
            timesPerDay: 4,
            maxSingleDose: null, // Нет ограничения, только по весу
            maxDailyDose: null,
            instruction: 'До 3 месяцев: 10 мг/кг разовая доза, до 4 раз в сутки с интервалом не менее 4 часов'
        },
        {
            minAgeMonths: 3,
            maxAgeMonths: 12,
            dosing: {
                type: 'fixed',
                fixedDose: {
                    min: 60,
                    max: 120,
                    unit: 'mg'
                }
            },
            timesPerDay: 4,
            maxSingleDose: 120,
            maxDailyDose: 480,
            instruction: '3 мес - 1 год: 60-120 мг разовая доза, до 4 раз в сутки'
        },
        {
            minAgeMonths: 12,
            maxAgeMonths: 60,
            dosing: {
                type: 'fixed',
                fixedDose: {
                    min: 120,
                    max: 250,
                    unit: 'mg'
                }
            },
            timesPerDay: 4,
            maxSingleDose: 250,
            maxDailyDose: 1000,
            instruction: '1-5 лет: 120-250 мг разовая доза, до 4 раз в сутки'
        },
        {
            minAgeMonths: 60,
            maxAgeMonths: 144,
            dosing: {
                type: 'fixed',
                fixedDose: {
                    min: 250,
                    max: 500,
                    unit: 'mg'
                }
            },
            timesPerDay: 4,
            maxSingleDose: 500,
            maxDailyDose: 2000,
            instruction: '6-12 лет: 250-500 мг разовая доза, до 4 раз в сутки'
        }
    ];

    // Взрослое дозирование
    const adultDosing = [
        {
            minWeightKg: 60,
            dosing: {
                type: 'fixed',
                fixedDose: {
                    min: 500,
                    max: 500,
                    unit: 'mg'
                }
            },
            timesPerDay: 4,
            maxSingleDose: 1000,
            maxDailyDose: 4000,
            instruction: 'Взрослым и подросткам с массой тела более 60 кг: 500 мг разовая доза, до 4 раз в сутки. Максимальная разовая доза - 1 г, суточная - 4 г.'
        }
    ];

    const medication = await prisma.medication.create({
        data: {
            nameRu: 'Парацетамол',
            nameEn: 'Paracetamol',
            activeSubstance: 'Парацетамол',
            atcCode: 'N02BE01',
            manufacturer: 'ТАТХИМФАРМПРЕПАРАТЫ, АО',
            packageDescription: 'Раствор для приема внутрь (вишневый, ванильный, клубничный, апельсиновый) 24 мг/1 мл: фл. 50 мл, 100 мл, 150 мл или 200 мл в компл. с мерн. ложкой или стаканчиком',
            icd10Codes: JSON.stringify(icd10Codes),
            forms: JSON.stringify(forms),
            pediatricDosing: JSON.stringify(pediatricDosing),
            adultDosing: JSON.stringify(adultDosing),
            contraindications: 'Повышенная чувствительность к парацетамолу, тяжелые нарушения функции печени, тяжелые нарушения функции почек.',
            indications: JSON.stringify(icd10Codes.map(code => ({ code }))),
            vidalUrl: 'https://www.vidal.ru/drugs/paracetamol-5',
            // Новые поля ограничений
            minInterval: 4, // Минимальный интервал 4 часа
            maxDosesPerDay: 4, // Максимум 4 дозы в сутки
            maxDurationDays: 7, // Максимальная длительность 5-7 дней
            routeOfAdmin: 'oral' // Путь введения - перорально
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
