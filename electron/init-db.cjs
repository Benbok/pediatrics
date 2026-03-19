const { prisma } = require('./prisma-client.cjs');
const bcrypt = require('bcryptjs');
const { logger } = require('./logger.cjs');

/**
 * DATABASE INITIALIZATION
 * 
 * Creates the first admin user if the users table is empty.
 * Uses credentials from .env.local (ADMIN_LOGIN and ADMIN_PASSWORD).
 */
async function initializeDatabase() {
    try {
        logger.info('[DB Init] Checking database initialization status...');

        // Устанавливаем busy_timeout для SQLite перед операциями
        await prisma.$executeRawUnsafe(`PRAGMA busy_timeout = 5000`);

        // Check if users table is empty
        const userCount = await prisma.user.count();

        if (userCount === 0) {
            logger.info('[DB Init] No users found. Creating first admin user...');

            const adminLogin = process.env.ADMIN_LOGIN || 'admin';
            const adminPassword = process.env.ADMIN_PASSWORD;

            if (!adminPassword) {
                logger.error('[DB Init] CRITICAL: ADMIN_PASSWORD not set in .env.local');
                throw new Error('ADMIN_PASSWORD must be set in .env.local for first-time setup');
            }

            // Hash password (handle both plain text and bcrypt hash)
            let passwordHash;
            if (adminPassword.startsWith('$2a$') || adminPassword.startsWith('$2b$')) {
                // Already a bcrypt hash
                passwordHash = adminPassword;
            } else {
                // Plain text - hash it
                passwordHash = await bcrypt.hash(adminPassword, 10);
                logger.warn('[DB Init] Plain text password found in .env.local. Consider using bcrypt hash.');
            }

            // Create first admin user and assign admin+doctor roles (in one transaction)
            const admin = await prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        username: adminLogin,
                        passwordHash: passwordHash,
                        lastName: 'Администратор',
                        firstName: '',
                        middleName: '',
                        isAdmin: true,
                        isActive: true
                    }
                });

                // Ensure roles exist and assign admin + doctor to first user
                const roleAdmin = await tx.role.upsert({
                    where: { key: 'admin' },
                    update: {},
                    create: { key: 'admin' }
                });
                const roleDoctor = await tx.role.upsert({
                    where: { key: 'doctor' },
                    update: {},
                    create: { key: 'doctor' }
                });

                await tx.userRole.createMany({
                    data: [
                        { userId: created.id, roleId: roleAdmin.id },
                        { userId: created.id, roleId: roleDoctor.id }
                    ]
                });

                return created;
            });

            logger.info(`[DB Init] First admin user created: ${admin.username} (ID: ${admin.id}) with roles admin+doctor`);

            return { initialized: true, adminCreated: true };
        } else {
            logger.info(`[DB Init] Database already initialized (${userCount} users found)`);

            // Ensure every user has roles (fix users created before role migration or without roles)
            // NOTE: Use raw SQL to avoid relying on Prisma relation field presence in generated client.
            const usersWithoutRoles = await prisma.$queryRawUnsafe(`
                SELECT u.id as id, u.is_admin as isAdmin
                FROM users u
                WHERE NOT EXISTS (
                    SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
                )
            `);
            if (usersWithoutRoles.length > 0) {
                logger.info(`[DB Init] Assigning roles to ${usersWithoutRoles.length} user(s) that have no roles`);
                const roleAdmin = await prisma.role.upsert({ where: { key: 'admin' }, update: {}, create: { key: 'admin' } });
                const roleDoctor = await prisma.role.upsert({ where: { key: 'doctor' }, update: {}, create: { key: 'doctor' } });
                for (const u of usersWithoutRoles) {
                    const roles = Boolean(u.isAdmin) ? [roleAdmin.id, roleDoctor.id] : [roleDoctor.id];
                    await prisma.userRole.createMany({
                        data: roles.map(roleId => ({ userId: u.id, roleId }))
                    });
                }
            }

            return { initialized: true, adminCreated: false };
        }

    } catch (error) {
        logger.error('[DB Init] Initialization failed:', error);
        throw error;
    }
}

/**
 * Seed nutrition reference data (idempotent — uses upsert).
 * Sources: Национальная программа оптимизации питания детей РФ (2019),
 *          МР 2.3.1.0253-21 (2021).
 */
async function seedNutritionData() {
    try {
        logger.info('[DB Init] Seeding nutrition reference data...');

        // ——— Age Norms ———
        const ageNorms = [
            {
                feedingStage: '0-10d',
                ageMinDays: 0,
                ageMaxDays: 10,
                energyKcalPerKg: null,
                fixedEnergyKcal: null,
                volumeFactorMin: null,
                volumeFactorMax: null,
                totalFoodMinG: null,
                totalFoodMaxG: null,
                mealsPerDay: 7,
                notes: 'Формулы Тура (70/80×n) и Зайцевой (2%×масса×n), n — день жизни',
            },
            {
                feedingStage: '10d-2m',
                ageMinDays: 11,
                ageMaxDays: 60,
                energyKcalPerKg: 115,
                fixedEnergyKcal: null,
                volumeFactorMin: 0.167, // 1/6
                volumeFactorMax: 0.2,   // 1/5
                totalFoodMinG: null,
                totalFoodMaxG: null,
                mealsPerDay: 7,
                notes: 'I полугодие: 115 ккал/кг; объёмный метод 1/5–1/6 массы',
            },
            {
                feedingStage: '2-4m',
                ageMinDays: 61,
                ageMaxDays: 120,
                energyKcalPerKg: 115,
                fixedEnergyKcal: null,
                volumeFactorMin: 0.143, // 1/7
                volumeFactorMax: 0.167, // 1/6
                totalFoodMinG: null,
                totalFoodMaxG: null,
                mealsPerDay: 6,
                notes: 'I полугодие: 115 ккал/кг; объёмный метод 1/6–1/7 массы',
            },
            {
                feedingStage: '4-6m',
                ageMinDays: 121,
                ageMaxDays: 180,
                energyKcalPerKg: 115,
                fixedEnergyKcal: null,
                volumeFactorMin: 0.125, // 1/8
                volumeFactorMax: 0.143, // 1/7
                totalFoodMinG: null,
                totalFoodMaxG: null,
                mealsPerDay: 6,
                notes: 'I полугодие: 115 ккал/кг; объёмный метод 1/7–1/8 массы; начало прикорма',
            },
            {
                feedingStage: '6-12m',
                ageMinDays: 181,
                ageMaxDays: 365,
                energyKcalPerKg: 110,
                fixedEnergyKcal: null,
                volumeFactorMin: 0.111, // 1/9
                volumeFactorMax: 0.125, // 1/8
                totalFoodMinG: null,
                totalFoodMaxG: null,
                mealsPerDay: 5,
                notes: 'II полугодие: 110 ккал/кг; объёмный метод 1/8–1/9 массы; активный прикорм',
            },
            {
                feedingStage: '12-36m',
                ageMinDays: 366,
                ageMaxDays: 1095,
                energyKcalPerKg: null,
                fixedEnergyKcal: 1200,
                volumeFactorMin: null,
                volumeFactorMax: null,
                totalFoodMinG: 1000,
                totalFoodMaxG: 1500,
                mealsPerDay: 4,
                notes: '1–3 года: ~1000–1400 ккал/сут; суточный объём пищи 1000–1500 г; 4–5 приёмов',
            },
        ];

        for (const norm of ageNorms) {
            await prisma.nutritionAgeNorm.upsert({
                where: {
                    // Upsert by stage name (unique enough for reference data)
                    // We use findFirst + update/create pattern since there's no unique index
                    // Instead we'll check and skip below
                    id: -1, // forces "not found" path every time — handled via create logic
                },
                update: norm,
                create: norm,
            }).catch(async () => {
                // If upsert fails (no matching id=-1), do create-if-not-exists
                const existing = await prisma.nutritionAgeNorm.findFirst({
                    where: { feedingStage: norm.feedingStage },
                });
                if (!existing) {
                    await prisma.nutritionAgeNorm.create({ data: norm });
                }
            });
        }

        // Simpler idempotent seeding pattern — just skip if feedingStage already exists
        const existingStages = await prisma.nutritionAgeNorm.findMany({
            select: { feedingStage: true },
        });
        const existingStageCodes = new Set(existingStages.map(s => s.feedingStage));

        for (const norm of ageNorms) {
            if (!existingStageCodes.has(norm.feedingStage)) {
                await prisma.nutritionAgeNorm.create({ data: norm });
                logger.info(`[DB Init] Created nutrition age norm: ${norm.feedingStage}`);
            }
        }

        // ——— Product Categories ———
        const categories = [
            { code: 'BREAST_MILK',     name: 'Грудное молоко',      minAgeDays: 0,   maxAgeDays: 1095 },
            { code: 'INFANT_FORMULA',  name: 'Молочная смесь',      minAgeDays: 0,   maxAgeDays: 1095 },
            { code: 'VEG_PUREE',       name: 'Овощное пюре',        minAgeDays: 120, maxAgeDays: 1095 },
            { code: 'CEREAL',          name: 'Каша',                minAgeDays: 120, maxAgeDays: 1095 },
            { code: 'FRUIT_PUREE',     name: 'Фруктовое пюре',      minAgeDays: 150, maxAgeDays: 1095 },
            { code: 'MEAT',            name: 'Мясное пюре',         minAgeDays: 180, maxAgeDays: 1095 },
            { code: 'FISH',            name: 'Рыба',                minAgeDays: 240, maxAgeDays: 1095 },
            { code: 'EGG_YOLK',        name: 'Желток',              minAgeDays: 240, maxAgeDays: 1095 },
            { code: 'JUICE',           name: 'Сок',                 minAgeDays: 180, maxAgeDays: 1095 },
            { code: 'DAIRY_1_3Y',      name: 'Молочные продукты',   minAgeDays: 365, maxAgeDays: 1095 },
            { code: 'BREAD_PASTA',     name: 'Хлеб / крупы',        minAgeDays: 365, maxAgeDays: 1095 },
        ];

        for (const cat of categories) {
            await prisma.nutritionProductCategory.upsert({
                where: { code: cat.code },
                update: { name: cat.name, minAgeDays: cat.minAgeDays, maxAgeDays: cat.maxAgeDays },
                create: cat,
            });
        }

        // ——— Feeding Templates by National Programme 2019 ———
        const categoryMap = {};
        const allCats = await prisma.nutritionProductCategory.findMany();
        for (const c of allCats) categoryMap[c.code] = c.id;

        const templates = [
            {
                ageMinDays: 121,
                ageMaxDays: 180,
                title: 'Прикорм 4–6 мес',
                description: 'Введение первого прикорма: овощное пюре или безмолочная каша. Начинать с 5–10 г, за 2 нед довести до 150 г.',
                items: [
                    { mealOrder: 1, code: 'BREAST_MILK',    portionSizeG: 180, note: 'ГМ / смесь' },
                    { mealOrder: 2, code: 'VEG_PUREE',      portionSizeG: 100, note: 'Первый прикорм, постепенно до 150 г' },
                    { mealOrder: 3, code: 'BREAST_MILK',    portionSizeG: 180, note: 'ГМ / смесь' },
                    { mealOrder: 4, code: 'BREAST_MILK',    portionSizeG: 180, note: 'ГМ / смесь' },
                    { mealOrder: 5, code: 'BREAST_MILK',    portionSizeG: 180, note: 'ГМ / смесь' },
                ],
            },
            {
                ageMinDays: 181,
                ageMaxDays: 212,
                title: 'Рацион 6 мес',
                description: 'Расширение прикорма: добавляется каша. Мясо — с 6 мес при ИВ, с 7–8 при ГВ.',
                items: [
                    { mealOrder: 1, code: 'BREAST_MILK',    portionSizeG: 200, note: 'ГМ / смесь' },
                    { mealOrder: 2, code: 'CEREAL',          portionSizeG: 150, note: 'Безмолочная каша + фруктовое пюре 30 г' },
                    { mealOrder: 3, code: 'VEG_PUREE',       portionSizeG: 150, note: 'Овощи + растительное масло 3 мл' },
                    { mealOrder: 4, code: 'BREAST_MILK',    portionSizeG: 150, note: 'ГМ / смесь' },
                    { mealOrder: 5, code: 'BREAST_MILK',    portionSizeG: 200, note: 'ГМ / смесь' },
                ],
            },
            {
                ageMinDays: 213,
                ageMaxDays: 273,
                title: 'Рацион 7–9 мес',
                description: 'Добавляются мясное пюре (50–60 г), желток, детское печенье. Вводится третий прикорм вместо одного кормления грудью/смесью.',
                items: [
                    { mealOrder: 1, code: 'BREAST_MILK',    portionSizeG: 200, note: 'ГМ / смесь' },
                    { mealOrder: 2, code: 'CEREAL',          portionSizeG: 180, note: 'Каша молочная + фрукт 30 г' },
                    { mealOrder: 3, code: 'VEG_PUREE',       portionSizeG: 150, note: 'Овощи' },
                    { mealOrder: 3, code: 'MEAT',            portionSizeG: 50,  note: 'Мясное пюре' },
                    { mealOrder: 4, code: 'FRUIT_PUREE',     portionSizeG: 60,  note: 'Фруктовое пюре' },
                    { mealOrder: 5, code: 'BREAST_MILK',    portionSizeG: 200, note: 'ГМ / смесь / кефир' },
                ],
            },
            {
                ageMinDays: 274,
                ageMaxDays: 365,
                title: 'Рацион 9–12 мес',
                description: 'Вводится рыба (2 раза/нед вместо мяса). Кефир или детский йогурт до 200 мл. Хлеб, печенье.',
                items: [
                    { mealOrder: 1, code: 'BREAST_MILK',    portionSizeG: 200, note: 'ГМ / смесь' },
                    { mealOrder: 2, code: 'CEREAL',          portionSizeG: 200, note: 'Каша + фрукт 40 г' },
                    { mealOrder: 3, code: 'VEG_PUREE',       portionSizeG: 150, note: 'Овощи' },
                    { mealOrder: 3, code: 'MEAT',            portionSizeG: 60,  note: 'Мясо / рыба 2×нед' },
                    { mealOrder: 4, code: 'FRUIT_PUREE',     portionSizeG: 80,  note: 'Фрукт / детский йогурт 100 г' },
                    { mealOrder: 5, code: 'DAIRY_1_3Y',      portionSizeG: 200, note: 'Кефир / смесь' },
                ],
            },
            {
                ageMinDays: 366,
                ageMaxDays: 548,
                title: 'Рацион 1–1,5 года',
                description: 'По программе оптимизации питания 1–3 лет. Суточный объём ~1100–1200 г, ~1000–1100 ккал.',
                items: [
                    { mealOrder: 1, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Каша на молоке / кефир + фрукт 50 г' },
                    { mealOrder: 2, code: 'MEAT',            portionSizeG: 80,  note: 'Суп 150 мл + мясо/рыба' },
                    { mealOrder: 2, code: 'VEG_PUREE',       portionSizeG: 150, note: 'Овощной гарнир' },
                    { mealOrder: 3, code: 'DAIRY_1_3Y',     portionSizeG: 180, note: 'Кефир / творог 50 г' },
                    { mealOrder: 3, code: 'FRUIT_PUREE',    portionSizeG: 100, note: 'Фрукты' },
                    { mealOrder: 4, code: 'CEREAL',          portionSizeG: 150, note: 'Каша / тушёные овощи' },
                    { mealOrder: 4, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Молоко / кефир' },
                ],
            },
            {
                ageMinDays: 549,
                ageMaxDays: 730,
                title: 'Рацион 1,5–2 года',
                description: 'Суточный объём ~1200–1300 г, ~1100–1200 ккал. Увеличивается доля мяса, рыбы и злаков.',
                items: [
                    { mealOrder: 1, code: 'CEREAL',          portionSizeG: 200, note: 'Каша / яйцо' },
                    { mealOrder: 1, code: 'DAIRY_1_3Y',     portionSizeG: 150, note: 'Молоко / кефир' },
                    { mealOrder: 2, code: 'MEAT',            portionSizeG: 100, note: 'Мясное блюдо / рыба 2×нед' },
                    { mealOrder: 2, code: 'VEG_PUREE',       portionSizeG: 200, note: 'Суп 200 мл + овощной гарнир' },
                    { mealOrder: 3, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Кефир / йогурт + фрукт' },
                    { mealOrder: 4, code: 'BREAD_PASTA',    portionSizeG: 100, note: 'Хлеб / творог / яйцо' },
                    { mealOrder: 4, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Молоко / кефир' },
                ],
            },
            {
                ageMinDays: 731,
                ageMaxDays: 1095,
                title: 'Рацион 2–3 года',
                description: 'Суточный объём ~1300–1500 г, ~1200–1400 ккал. Приближается к взрослому рациону, 4 приёма пищи.',
                items: [
                    { mealOrder: 1, code: 'CEREAL',          portionSizeG: 200, note: 'Каша / яичное блюдо' },
                    { mealOrder: 1, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Молоко' },
                    { mealOrder: 2, code: 'MEAT',            portionSizeG: 120, note: 'Мясное / рыбное блюдо' },
                    { mealOrder: 2, code: 'VEG_PUREE',       portionSizeG: 250, note: 'Суп 200 мл + гарнир' },
                    { mealOrder: 2, code: 'BREAD_PASTA',    portionSizeG: 20,  note: 'Хлеб' },
                    { mealOrder: 3, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Кефир / молоко + фрукт' },
                    { mealOrder: 4, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Кефир / ряженка' },
                    { mealOrder: 4, code: 'BREAD_PASTA',    portionSizeG: 50,  note: 'Хлеб / печенье' },
                ],
            },
        ];

        for (const tmpl of templates) {
            const existing = await prisma.nutritionFeedingTemplate.findFirst({
                where: { title: tmpl.title },
            });
            if (!existing) {
                const created = await prisma.nutritionFeedingTemplate.create({
                    data: {
                        ageMinDays: tmpl.ageMinDays,
                        ageMaxDays: tmpl.ageMaxDays,
                        title: tmpl.title,
                        description: tmpl.description,
                    },
                });
                for (const item of tmpl.items) {
                    const catId = categoryMap[item.code];
                    if (catId) {
                        await prisma.nutritionFeedingTemplateItem.create({
                            data: {
                                templateId: created.id,
                                mealOrder: item.mealOrder,
                                productCategoryId: catId,
                                portionSizeG: item.portionSizeG,
                                isExample: true,
                                note: item.note || null,
                            },
                        });
                    }
                }
                logger.info(`[DB Init] Created nutrition feeding template: ${tmpl.title}`);
            }
        }

        logger.info('[DB Init] Nutrition reference data seeded successfully');
    } catch (error) {
        logger.error('[DB Init] Failed to seed nutrition data:', error);
        // Non-fatal — app can still run without seed data
    }
}

module.exports = { initializeDatabase, seedNutritionData };
