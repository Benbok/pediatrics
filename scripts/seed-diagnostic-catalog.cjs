/**
 * Seed DiagnosticTestCatalog with canonical test names and their aliases.
 * Run: node scripts/seed-diagnostic-catalog.cjs
 *
 * Aliases are alternative names/abbreviations that will be resolved to the
 * canonical nameRu during normalization (3-tier lookup in diseaseNormalization.cjs).
 */

const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const dbPath = path.join(__dirname, '../prisma/dev.db');
const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

const CATALOG = [
    // ─── Лабораторные ───────────────────────────────────────────────────────
    {
        nameRu: 'Общий анализ крови',
        type: 'lab',
        aliases: ['ОАК', 'ОБА', 'Общий клинический анализ крови', 'Клинический анализ крови', 'Анализ крови', 'Гемограмма'],
    },
    {
        nameRu: 'Общий анализ мочи',
        type: 'lab',
        aliases: ['ОАМ', 'Общий клинический анализ мочи', 'Клинический анализ мочи', 'Анализ мочи'],
    },
    {
        nameRu: 'Биохимический анализ крови',
        type: 'lab',
        aliases: ['Биохимия', 'Биохимия крови', 'БАК', 'Биохимический анализ', 'Биохимия сыворотки крови'],
    },
    {
        nameRu: 'Анализ кала',
        type: 'lab',
        aliases: ['Копрограмма', 'Общий анализ кала', 'Кал общий'],
    },
    {
        nameRu: 'Анализ кала на яйца гельминтов',
        type: 'lab',
        aliases: ['Кал на яйца глист', 'Кал на гельминты', 'Яйца гельминтов', 'Анализ кала на глисты'],
    },
    {
        nameRu: 'Анализ кала на дисбактериоз',
        type: 'lab',
        aliases: ['Дисбактериоз кишечника', 'Посев кала на дисбактериоз', 'Микробиота кишечника'],
    },
    {
        nameRu: 'Коагулограмма',
        type: 'lab',
        aliases: ['Гемостазиограмма', 'Свертываемость крови', 'МНО', 'Протромбин', 'АЧТВ'],
    },
    {
        nameRu: 'С-реактивный белок',
        type: 'lab',
        aliases: ['СРБ', 'CRP', 'C-реактивный белок'],
    },
    {
        nameRu: 'Прокальцитонин',
        type: 'lab',
        aliases: ['PCT', 'Прокальцитониновый тест'],
    },
    {
        nameRu: 'Скорость оседания эритроцитов',
        type: 'lab',
        aliases: ['СОЭ', 'РОЭ', 'ESR'],
    },
    {
        nameRu: 'Глюкоза крови',
        type: 'lab',
        aliases: ['Сахар крови', 'Гликемия', 'Глюкоза', 'Анализ крови на глюкозу', 'Анализ на сахар'],
    },
    {
        nameRu: 'Гликированный гемоглобин',
        type: 'lab',
        aliases: ['HbA1c', 'Гликозилированный гемоглобин', 'ГГ', 'Гемоглобин A1c'],
    },
    {
        nameRu: 'Тиреотропный гормон',
        type: 'lab',
        aliases: ['ТТГ', 'TSH', 'Гормон щитовидной железы'],
    },
    {
        nameRu: 'Свободный тироксин',
        type: 'lab',
        aliases: ['Т4 свободный', 'fT4', 'Тироксин свободный'],
    },
    {
        nameRu: 'Общий IgE',
        type: 'lab',
        aliases: ['Иммуноглобулин E', 'IgE', 'Общий иммуноглобулин E'],
    },
    {
        nameRu: 'Аллергопанель',
        type: 'lab',
        aliases: ['Специфические IgE', 'RAST-тест', 'Аллергологическое обследование', 'Аллергическая панель'],
    },
    {
        nameRu: 'Анализ крови на антитела к гельминтам',
        type: 'lab',
        aliases: ['Серология на гельминтозы', 'Антитела к аскаридам', 'Антитела к токсокаре'],
    },
    {
        nameRu: 'Посев крови на стерильность',
        type: 'lab',
        aliases: ['Гемокультура', 'Посев крови', 'Бакпосев крови', 'Кровь на стерильность'],
    },
    {
        nameRu: 'Посев мочи на флору',
        type: 'lab',
        aliases: ['Бакпосев мочи', 'Посев мочи', 'Бактериовый посев мочи', 'Микробиологическое исследование мочи'],
    },
    {
        nameRu: 'Посев мазка из зева',
        type: 'lab',
        aliases: ['Бакпосев из зева', 'Мазок из зева', 'Посев из зева', 'Мазок из горла'],
    },
    {
        nameRu: 'Посев мазка из носа',
        type: 'lab',
        aliases: ['Бакпосев из носа', 'Мазок из носа', 'Посев из носа'],
    },
    {
        nameRu: 'ПЦР на вирусные инфекции',
        type: 'lab',
        aliases: ['ПЦР', 'PCR', 'Полимеразная цепная реакция'],
    },
    {
        nameRu: 'Анализ на TORCH-инфекции',
        type: 'lab',
        aliases: ['TORCH', 'Анализ TORCH', 'Исследование TORCH'],
    },
    {
        nameRu: 'Анализ на вирусные гепатиты',
        type: 'lab',
        aliases: ['Маркеры гепатита', 'HBsAg', 'Anti-HCV', 'Гепатиты B и C', 'Маркеры гепатитов B и C'],
    },
    {
        nameRu: 'Анализ мочи по Нечипоренко',
        type: 'lab',
        aliases: ['Нечипоренко', 'ОАМ по Нечипоренко', 'Анализ по Нечипоренко'],
    },
    {
        nameRu: 'Проба Зимницкого',
        type: 'lab',
        aliases: ['Зимницкий', 'Анализ по Зимницкому'],
    },
    {
        nameRu: 'Суточная протеинурия',
        type: 'lab',
        aliases: ['Белок в суточной моче', 'Суточный белок мочи', 'Протеинурия суточная'],
    },
    {
        nameRu: 'Спинномозговая жидкость',
        type: 'lab',
        aliases: ['Ликвор', 'ЦСЖ', 'Анализ ликвора', 'Исследование спинномозговой жидкости', 'CSF'],
    },
    // ─── Инструментальные ────────────────────────────────────────────────────
    {
        nameRu: 'Рентгенография легких',
        type: 'instrumental',
        aliases: ['Рентген легких', 'РГ легких', 'Рентген ОГК', 'Рентгеноскопия легких', 'Рентгенография грудной клетки', 'Рентген грудной клетки', 'Флюорография'],
    },
    {
        nameRu: 'Рентгенография придаточных пазух носа',
        type: 'instrumental',
        aliases: ['Рентген пазух носа', 'Рентген ППН', 'Рентген синусов', 'Рентгенография синусов'],
    },
    {
        nameRu: 'Рентгенография костей',
        type: 'instrumental',
        aliases: ['Рентген костей', 'Рентгенография скелета', 'Рентген суставов'],
    },
    {
        nameRu: 'ЭКГ',
        type: 'instrumental',
        aliases: ['Электрокардиография', 'Кардиограмма', 'Электрокардиограмма', 'ЭКГ-исследование'],
    },
    {
        nameRu: 'ЭхоКГ',
        type: 'instrumental',
        aliases: ['Эхокардиография', 'УЗИ сердца', 'Эхокардиограмма', 'ЭхоКардиография'],
    },
    {
        nameRu: 'УЗИ органов брюшной полости',
        type: 'instrumental',
        aliases: ['УЗИ брюшной полости', 'УЗИ ОБП', 'УЗИ живота', 'Ультразвук живота', 'УЗИ органов брюшины'],
    },
    {
        nameRu: 'УЗИ почек',
        type: 'instrumental',
        aliases: ['Ультразвук почек', 'УЗИ почек и мочевого пузыря', 'УЗИ мочевыделительной системы'],
    },
    {
        nameRu: 'УЗИ щитовидной железы',
        type: 'instrumental',
        aliases: ['УЗИ ЩЖ', 'Ультразвук щитовидной железы'],
    },
    {
        nameRu: 'УЗИ тимуса',
        type: 'instrumental',
        aliases: ['Ультразвук тимуса', 'УЗИ вилочковой железы'],
    },
    {
        nameRu: 'НСГ',
        type: 'instrumental',
        aliases: ['Нейросонография', 'УЗИ головного мозга', 'Ультразвук головного мозга'],
    },
    {
        nameRu: 'КТ головного мозга',
        type: 'instrumental',
        aliases: ['Компьютерная томография мозга', 'КТ мозга', 'Томография головного мозга'],
    },
    {
        nameRu: 'МРТ головного мозга',
        type: 'instrumental',
        aliases: ['Магнитно-резонансная томография мозга', 'МРТ мозга'],
    },
    {
        nameRu: 'ЭЭГ',
        type: 'instrumental',
        aliases: ['Электроэнцефалография', 'Электроэнцефалограмма'],
    },
    {
        nameRu: 'Спирометрия',
        type: 'instrumental',
        aliases: ['ФВД', 'Функция внешнего дыхания', 'Пикфлоуметрия', 'Исследование ФВД'],
    },
    {
        nameRu: 'Бронхоскопия',
        type: 'instrumental',
        aliases: ['Фибробронхоскопия', 'ФБС', 'Трахеобронхоскопия'],
    },
    {
        nameRu: 'ФГДС',
        type: 'instrumental',
        aliases: ['Фиброгастродуоденоскопия', 'Гастроскопия', 'ЭГДС', 'Эзофагогастродуоденоскопия', 'Видеогастроскопия'],
    },
    {
        nameRu: 'Колоноскопия',
        type: 'instrumental',
        aliases: ['Фиброколоноскопия', 'ФКС', 'Ректоколоноскопия'],
    },
    {
        nameRu: 'Люмбальная пункция',
        type: 'instrumental',
        aliases: ['Спинномозговая пункция', 'Пункция спинного мозга', 'LP'],
    },
];

async function main() {
    console.log(`Seeding DiagnosticTestCatalog (${CATALOG.length} entries)...\n`);
    let created = 0;
    let updated = 0;

    for (const entry of CATALOG) {
        const existing = await prisma.diagnosticTestCatalog.findUnique({
            where: { nameRu: entry.nameRu },
        });

        if (existing) {
            await prisma.diagnosticTestCatalog.update({
                where: { nameRu: entry.nameRu },
                data: {
                    type: entry.type,
                    aliases: JSON.stringify(entry.aliases),
                    isStandard: true,
                },
            });
            console.log(`  ~ updated: ${entry.nameRu}`);
            updated++;
        } else {
            await prisma.diagnosticTestCatalog.create({
                data: {
                    nameRu: entry.nameRu,
                    type: entry.type,
                    aliases: JSON.stringify(entry.aliases),
                    isStandard: true,
                },
            });
            console.log(`  + created: ${entry.nameRu}`);
            created++;
        }
    }

    console.log(`\nDone. Created: ${created}, Updated: ${updated}`);
    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
});
