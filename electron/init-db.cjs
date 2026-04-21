const { prisma } = require('./prisma-client.cjs');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { app } = require('electron');
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
            logger.info('[DB Init] No users found. Checking for first-run setup conditions...');

            const adminLogin = process.env.ADMIN_LOGIN || 'admin';
            const adminPassword = process.env.ADMIN_PASSWORD;

            if (!adminPassword) {
                // In packaged app there is no .env.local — first-run setup wizard handles admin creation.
                logger.warn('[DB Init] ADMIN_PASSWORD not set. Skipping auto admin creation. Use First Run Setup in the app.');
                return { initialized: true, adminCreated: false, needsFirstRun: true };
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
        // Fast path: if all 6 age-norm rows already exist, skip the entire seed
        const existingNormCount = await prisma.nutritionAgeNorm.count();
        const EXPECTED_NORM_COUNT = 6;
        if (existingNormCount >= EXPECTED_NORM_COUNT) {
            logger.info(`[DB Init] Nutrition data already seeded (${existingNormCount} norms), skipping`);
            return;
        }

        logger.info('[DB Init] Seeding nutrition reference data...');

        // ——— Age Norms ———
        const ageNorms = [
            {
                feedingStage: '0-10d',
                ageMinDays: 0,
                ageMaxDays: 10,
                energyKcalPerKg: 120,
                fixedEnergyKcal: null,
                volumeFactorMin: null,
                volumeFactorMax: null,
                totalFoodMinG: null,
                totalFoodMaxG: null,
                mealsPerDay: 7,
                notes: 'Формула Зайцевой: 2% от массы при рождении × день жизни; ориентировочно 10 × n мл на кормление',
            },
            {
                feedingStage: '10d-2m',
                ageMinDays: 11,
                ageMaxDays: 60,
                energyKcalPerKg: 120,
                fixedEnergyKcal: null,
                volumeFactorMin: 0.2,   // 1/5
                volumeFactorMax: 0.2,   // 1/5
                totalFoodMinG: null,
                totalFoodMaxG: null,
                mealsPerDay: 7,
                notes: '10 дней – 2 месяца: 120 ккал/кг/сут; объёмный метод 1/5 массы',
            },
            {
                feedingStage: '2-4m',
                ageMinDays: 61,
                ageMaxDays: 120,
                energyKcalPerKg: 115,
                fixedEnergyKcal: null,
                volumeFactorMin: 0.167, // 1/6
                volumeFactorMax: 0.167, // 1/6
                totalFoodMinG: null,
                totalFoodMaxG: null,
                mealsPerDay: 6,
                notes: '2–4 месяца: объёмный метод 1/6 массы; энергетически 120 ккал/кг до 3 мес и 115 ккал/кг после 3 мес',
            },
            {
                feedingStage: '4-6m',
                ageMinDays: 121,
                ageMaxDays: 180,
                energyKcalPerKg: 115,
                fixedEnergyKcal: null,
                volumeFactorMin: 0.143, // 1/7
                volumeFactorMax: 0.143, // 1/7
                totalFoodMinG: null,
                totalFoodMaxG: null,
                mealsPerDay: 6,
                notes: '4–6 месяцев: 115 ккал/кг/сут; объёмный метод 1/7 массы; окно введения прикорма',
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
                notes: '6–12 месяцев: объёмный метод 1/8–1/9 массы, обычно не более 1000–1100 мл/сут; 110 ккал/кг в III квартале и 105 ккал/кг в IV квартале',
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
                mealsPerDay: 5,
                notes: '1–3 года: суточный объём пищи 1000–1500 г; режим 3 основных приёма пищи + 2 перекуса',
            },
        ];

        // ——— Age Norms (single transaction) ———
        await prisma.$transaction(
            ageNorms.map(norm => prisma.nutritionAgeNorm.upsert({
                where: { feedingStage: norm.feedingStage },
                update: norm,
                create: norm,
            }))
        );
        logger.info(`[DB Init] Upserted ${ageNorms.length} age norms`);

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
            { code: 'CURD',            name: 'Творог',              minAgeDays: 240, maxAgeDays: 1095 },
            { code: 'JUICE',           name: 'Сок',                 minAgeDays: 240, maxAgeDays: 1095 },
            { code: 'DAIRY_1_3Y',      name: 'Молочные продукты',   minAgeDays: 365, maxAgeDays: 1095 },
            { code: 'BREAD_PASTA',     name: 'Хлеб / крупы',        minAgeDays: 365, maxAgeDays: 1095 },
        ];

        await prisma.$transaction(
            categories.map(cat => prisma.nutritionProductCategory.upsert({
                where: { code: cat.code },
                update: { name: cat.name, minAgeDays: cat.minAgeDays, maxAgeDays: cat.maxAgeDays },
                create: cat,
            }))
        );
        logger.info(`[DB Init] Upserted ${categories.length} product categories`);

        // ——— Feeding Templates by National Programme 2019 ———
        const categoryMap = {};
        const allCats = await prisma.nutritionProductCategory.findMany();
        for (const c of allCats) categoryMap[c.code] = c.id;

        const templates = [
            {
                ageMinDays: 121,
                ageMaxDays: 180,
                title: 'Прикорм 4–6 мес',
                description: 'Введение первого прикорма в окно 4–6 мес: овощное пюре или безмолочная каша. Начинать с 5–10 г утром и доводить до 150 г за 7–10 дней.',
                items: [
                    { mealOrder: 1, code: 'BREAST_MILK',    portionSizeG: 180, note: 'ГМ / смесь' },
                    { mealOrder: 2, code: 'VEG_PUREE',      portionSizeG: 150, note: 'Первый выбор при запорах/избытке веса; старт с 5–10 г' },
                    { mealOrder: 2, code: 'CEREAL',         portionSizeG: 150, note: 'Альтернатива первому прикорму при дефиците массы/частом стуле' },
                    { mealOrder: 3, code: 'BREAST_MILK',    portionSizeG: 180, note: 'ГМ / смесь' },
                    { mealOrder: 4, code: 'BREAST_MILK',    portionSizeG: 180, note: 'ГМ / смесь' },
                    { mealOrder: 5, code: 'BREAST_MILK',    portionSizeG: 180, note: 'ГМ / смесь' },
                ],
            },
            {
                ageMinDays: 181,
                ageMaxDays: 212,
                title: 'Рацион 6 мес',
                description: 'Расширение прикорма: второй продукт через 2–3 недели. С 6 месяцев вводится мясное пюре как источник железа и цинка.',
                items: [
                    { mealOrder: 1, code: 'BREAST_MILK',    portionSizeG: 200, note: 'ГМ / смесь' },
                    { mealOrder: 2, code: 'CEREAL',          portionSizeG: 150, note: 'Второй продукт прикорма, если первым были овощи' },
                    { mealOrder: 3, code: 'VEG_PUREE',       portionSizeG: 150, note: 'Если первым вводилась каша' },
                    { mealOrder: 3, code: 'MEAT',            portionSizeG: 30,  note: 'Старт мясного пюре с 6 месяцев' },
                    { mealOrder: 4, code: 'BREAST_MILK',    portionSizeG: 150, note: 'ГМ / смесь' },
                    { mealOrder: 5, code: 'BREAST_MILK',    portionSizeG: 200, note: 'ГМ / смесь' },
                ],
            },
            {
                ageMinDays: 213,
                ageMaxDays: 273,
                title: 'Рацион 7–9 мес',
                description: 'Продолжение прикорма: мясное пюре 50–60 г, желток, постепенное расширение ассортимента. С 8 месяцев можно вводить творог до 50 г и сок до 100 мл.',
                items: [
                    { mealOrder: 1, code: 'BREAST_MILK',    portionSizeG: 200, note: 'ГМ / смесь' },
                    { mealOrder: 2, code: 'CEREAL',          portionSizeG: 180, note: 'Каша молочная + фрукт 30 г' },
                    { mealOrder: 3, code: 'VEG_PUREE',       portionSizeG: 150, note: 'Овощи' },
                    { mealOrder: 3, code: 'MEAT',            portionSizeG: 50,  note: 'Мясное пюре' },
                    { mealOrder: 4, code: 'FRUIT_PUREE',     portionSizeG: 60,  note: 'Фруктовое пюре' },
                    { mealOrder: 4, code: 'CURD',            portionSizeG: 50,  note: 'С 8 месяцев, не более 50 г' },
                    { mealOrder: 4, code: 'JUICE',           portionSizeG: 100, note: 'С 8 месяцев, не более 100 мл' },
                    { mealOrder: 5, code: 'BREAST_MILK',    portionSizeG: 200, note: 'ГМ / смесь / кефир' },
                ],
            },
            {
                ageMinDays: 274,
                ageMaxDays: 365,
                title: 'Рацион 9–12 мес',
                description: 'К 9–12 месяцам рацион расширяется: рыба 2–3 раза в неделю вместо мяса, кисломолочные продукты, хлеб и печенье в возрастных порциях.',
                items: [
                    { mealOrder: 1, code: 'BREAST_MILK',    portionSizeG: 200, note: 'ГМ / смесь' },
                    { mealOrder: 2, code: 'CEREAL',          portionSizeG: 200, note: 'Каша + фрукт 40 г' },
                    { mealOrder: 3, code: 'VEG_PUREE',       portionSizeG: 150, note: 'Овощи' },
                    { mealOrder: 3, code: 'MEAT',            portionSizeG: 60,  note: 'Мясо / рыба 2–3 раза в неделю' },
                    { mealOrder: 4, code: 'FRUIT_PUREE',     portionSizeG: 80,  note: 'Фрукт / фруктовое пюре' },
                    { mealOrder: 4, code: 'CURD',            portionSizeG: 50,  note: 'Творог до 50 г' },
                    { mealOrder: 4, code: 'JUICE',           portionSizeG: 100, note: 'Сок до 100 мл' },
                    { mealOrder: 5, code: 'DAIRY_1_3Y',      portionSizeG: 200, note: 'Кефир / смесь' },
                ],
            },
            {
                ageMinDays: 366,
                ageMaxDays: 548,
                title: 'Рацион 1–1,5 года',
                description: 'Режим 3 основных приёма пищи и 2 перекуса. Суточный объём 1000–1200 г, разовая порция не более 300–350 мл.',
                items: [
                    { mealOrder: 1, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Каша на молоке / кефир + фрукт 50 г' },
                    { mealOrder: 2, code: 'FRUIT_PUREE',    portionSizeG: 100, note: 'Перекус: фрукт / фруктовое пюре' },
                    { mealOrder: 2, code: 'MEAT',            portionSizeG: 80,  note: 'Суп 150 мл + мясо/рыба' },
                    { mealOrder: 2, code: 'VEG_PUREE',       portionSizeG: 150, note: 'Овощной гарнир' },
                    { mealOrder: 3, code: 'DAIRY_1_3Y',     portionSizeG: 180, note: 'Кефир / творог 50 г' },
                    { mealOrder: 4, code: 'CEREAL',          portionSizeG: 150, note: 'Ужин: каша / тушёные овощи' },
                    { mealOrder: 4, code: 'DAIRY_1_3Y',     portionSizeG: 180, note: 'Молочный продукт' },
                    { mealOrder: 5, code: 'DAIRY_1_3Y',     portionSizeG: 180, note: 'Перекус: кефир / йогурт' },
                ],
            },
            {
                ageMinDays: 549,
                ageMaxDays: 730,
                title: 'Рацион 1,5–2 года',
                description: 'Суточный объём 1200–1500 г. Сохраняется 5-разовый режим, расширяется ассортимент продуктов и увеличивается доля плотных блюд.',
                items: [
                    { mealOrder: 1, code: 'CEREAL',          portionSizeG: 200, note: 'Каша / яйцо' },
                    { mealOrder: 1, code: 'DAIRY_1_3Y',     portionSizeG: 150, note: 'Молоко / кефир' },
                    { mealOrder: 2, code: 'FRUIT_PUREE',    portionSizeG: 120, note: 'Перекус: фрукты' },
                    { mealOrder: 2, code: 'MEAT',            portionSizeG: 100, note: 'Мясное блюдо / рыба 2×нед' },
                    { mealOrder: 2, code: 'VEG_PUREE',       portionSizeG: 200, note: 'Суп 200 мл + овощной гарнир' },
                    { mealOrder: 3, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Перекус: кефир / йогурт' },
                    { mealOrder: 4, code: 'BREAD_PASTA',    portionSizeG: 100, note: 'Ужин: крупяное или творожное блюдо' },
                    { mealOrder: 4, code: 'DAIRY_1_3Y',     portionSizeG: 180, note: 'Молочный продукт' },
                    { mealOrder: 5, code: 'FRUIT_PUREE',    portionSizeG: 100, note: 'Поздний перекус: фрукт / кисломолочный напиток' },
                ],
            },
            {
                ageMinDays: 731,
                ageMaxDays: 1095,
                title: 'Рацион 2–3 года',
                description: 'Суточный объём 1200–1500 г. Рацион приближается к общему столу, но сохраняется 5-разовый режим с контролем порций и разнообразия.',
                items: [
                    { mealOrder: 1, code: 'CEREAL',          portionSizeG: 200, note: 'Каша / яичное блюдо' },
                    { mealOrder: 1, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Молоко' },
                    { mealOrder: 2, code: 'FRUIT_PUREE',    portionSizeG: 120, note: 'Перекус: фрукт / овощной перекус' },
                    { mealOrder: 2, code: 'MEAT',            portionSizeG: 120, note: 'Мясное / рыбное блюдо' },
                    { mealOrder: 2, code: 'VEG_PUREE',       portionSizeG: 250, note: 'Суп 200 мл + гарнир' },
                    { mealOrder: 2, code: 'BREAD_PASTA',    portionSizeG: 20,  note: 'Хлеб' },
                    { mealOrder: 3, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Перекус: кефир / молоко + фрукт' },
                    { mealOrder: 4, code: 'DAIRY_1_3Y',     portionSizeG: 200, note: 'Ужин: молочный продукт' },
                    { mealOrder: 4, code: 'BREAD_PASTA',    portionSizeG: 120, note: 'Гарнир / крупяное блюдо' },
                    { mealOrder: 5, code: 'DAIRY_1_3Y',     portionSizeG: 180, note: 'Поздний перекус: кисломолочный напиток' },
                ],
            },
        ];

        for (const tmpl of templates) {
            const existing = await prisma.nutritionFeedingTemplate.findFirst({
                where: { title: tmpl.title },
                select: { id: true },
            });

            const templateRecord = existing
                ? await prisma.nutritionFeedingTemplate.update({
                    where: { id: existing.id },
                    data: {
                        ageMinDays: tmpl.ageMinDays,
                        ageMaxDays: tmpl.ageMaxDays,
                        description: tmpl.description,
                    },
                })
                : await prisma.nutritionFeedingTemplate.create({
                    data: {
                        ageMinDays: tmpl.ageMinDays,
                        ageMaxDays: tmpl.ageMaxDays,
                        title: tmpl.title,
                        description: tmpl.description,
                    },
                });

            const itemsToCreate = tmpl.items
                .filter(item => !!categoryMap[item.code])
                .map(item => ({
                    templateId: templateRecord.id,
                    mealOrder: item.mealOrder,
                    productCategoryId: categoryMap[item.code],
                    portionSizeG: item.portionSizeG,
                    isExample: true,
                    note: item.note || null,
                }));

            await prisma.$transaction([
                prisma.nutritionFeedingTemplateItem.deleteMany({ where: { templateId: templateRecord.id } }),
                prisma.nutritionFeedingTemplateItem.createMany({ data: itemsToCreate }),
            ]);

            if (!existing) {
                logger.info(`[DB Init] Created nutrition feeding template: ${tmpl.title}`);
            }
        }

        logger.info('[DB Init] Nutrition reference data seeded successfully');
    } catch (error) {
        logger.error('[DB Init] Failed to seed nutrition data:', error);
        // Non-fatal — app can still run without seed data
    }
}

/**
 * Seed reference tables (medications, diseases, disease_medications, disease_notes)
 * from the bundled dev.db into the user's pediatrics.db.
 *
 * Only runs in packaged (prod) mode. Skips tables that already have data (idempotent).
 * Uses better-sqlite3 directly to avoid Prisma overhead on raw batch inserts.
 */
async function seedReferenceData() {
    const isDev = !app.isPackaged;
    if (isDev) {
        // In dev mode the app already reads dev.db directly — no seed needed.
        return;
    }

    // Path to the bundled seed source.
    // Files in asarUnpack are at app.asar.unpacked/ next to the asar archive.
    // better-sqlite3 is a native module and cannot open files inside an asar archive,
    // so we must resolve to the physical unpacked path.
    const appPath = app.getAppPath().replace(/app\.asar$/, 'app.asar.unpacked');
    const seedDbPath = path.join(appPath, 'prisma', 'dev.db');

    if (!fs.existsSync(seedDbPath)) {
        logger.warn('[DB Seed] Bundled dev.db not found at:', seedDbPath, '— skipping reference seed');
        return;
    }

    // Path to the user's runtime database
    const userDbPath = path.join(app.getPath('userData'), 'pediatrics.db');

    const TABLES = [
        // ── Независимые справочники ──────────────────────────────────────────
        'medications',
        'diseases',
        'vaccine_catalog_entries',
        'vaccine_plan_templates',
        'diagnostic_test_catalog',
        'organization_profiles',
        // ── Зависят от diseases ──────────────────────────────────────────────
        'clinical_guidelines',       // → diseases
        'guideline_chunks',          // → clinical_guidelines, diseases  (FTS перестраивается при старте ChunkIndexService)
        'disease_medications',       // → diseases, medications
        'disease_notes',             // → diseases, users(id=1)
        // ── Шаблоны (created_by_id=1 в dev → admin id=1 в prod) ─────────────
        'visit_templates',
        'exam_text_templates',
        'medication_templates',
        'recommendation_templates',
        'diagnostic_templates',
        // ── Питание (nutrition_product_categories уже засеяны seedNutritionData) ──
        'nutrition_products',
    ];

    let srcDb;
    let dstDb;
    try {
        srcDb = new Database(seedDbPath, { readonly: true });
        dstDb = new Database(userDbPath);
        dstDb.pragma('journal_mode = WAL');
        dstDb.pragma('busy_timeout = 5000');
        dstDb.pragma('foreign_keys = OFF'); // FK отключены на время seed — пользователь с id=1 создаётся в initializeDatabase до этого вызова

        for (const table of TABLES) {
            // Check if user table already has data — idempotent, never overwrite.
            const existingRow = dstDb.prepare(`SELECT COUNT(*) as cnt FROM "${table}"`).get();
            if (existingRow && existingRow.cnt > 0) {
                logger.info(`[DB Seed] Table "${table}" already has ${existingRow.cnt} rows — skipping`);
                continue;
            }

            // Read all rows from seed source
            const rows = srcDb.prepare(`SELECT * FROM "${table}"`).all();
            if (rows.length === 0) {
                logger.info(`[DB Seed] Table "${table}" is empty in seed source — skipping`);
                continue;
            }

            // Build INSERT statement from column names of the first row
            const columns = Object.keys(rows[0]);
            const placeholders = columns.map(() => '?').join(', ');
            const insertSql = `INSERT OR IGNORE INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
            const insert = dstDb.prepare(insertSql);

            const insertMany = dstDb.transaction((items) => {
                for (const row of items) {
                    insert.run(Object.values(row));
                }
            });

            insertMany(rows);
            logger.info(`[DB Seed] Seeded ${rows.length} rows into "${table}"`);
        }
    } catch (err) {
        logger.error('[DB Seed] Reference seed failed:', err.message);
        // Non-fatal — app can still run without pre-seeded reference data
    } finally {
        if (srcDb) srcDb.close();
        if (dstDb) dstDb.close();
    }
}

module.exports = { initializeDatabase, seedNutritionData, seedReferenceData };
