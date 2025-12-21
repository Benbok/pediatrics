import { VaccineDefinition } from './types';

// Based on the National Vaccination Calendar of the Russian Federation
export const VACCINE_SCHEDULE: VaccineDefinition[] = [
  {
    id: 'hepb-1',
    name: 'Гепатит B (1)',
    disease: 'Гепатит B',
    ageMonthStart: 0,
    description: 'Вводится в первые 24 часа жизни. Критически важна для предотвращения вертикальной передачи вируса. У новорожденных риск хронизации 90%. Для групп риска (мать HBsAg+) вводится с иммуноглобулином.',
    lectureId: 'hepb',
    availableBrands: [
      { name: 'Регевак B', country: 'Россия', description: 'Рекомбинантная дрожжевая вакцина. Стандарт в роддомах.' },
      { name: 'Энджерикс B', country: 'Бельгия', description: 'Высокоочищенная вакцина, золотой стандарт безопасности.' },
      { name: 'Комбиотех', country: 'Россия', description: 'Отечественная рекомбинантная вакцина.' },
      { name: 'Эувакс B', country: 'Южная Корея', description: 'Проверенная временем вакцина.' }
    ]
  },
  {
    id: 'bcg-1',
    name: 'БЦЖ / БЦЖ-М',
    disease: 'БЦЖ',
    ageMonthStart: 0,
    isLive: true,
    description: 'Вводится на 3-7 день жизни. БЦЖ: Здоровые дети в роддоме. БЦЖ-М: Недоношенные (>2000г), не привитые в роддоме, ослабленные. Защищает от смертельных форм ТБ. Интервал 30 дней ДО и ПОСЛЕ любых других прививок.',
    lectureId: 'bcg',
    availableBrands: [
      { name: 'БЦЖ-М', country: 'Россия', description: 'Щадящая вакцина (меньше антигена). Золотой стандарт для большинства.' },
      { name: 'БЦЖ', country: 'Россия', description: 'Полная доза. В очагах туберкулеза.' }
    ]
  },
  {
    id: 'hepb-2',
    name: 'Гепатит B (2)',
    disease: 'Гепатит B',
    ageMonthStart: 1,
    description: 'Вторая доза. Продолжение формирования иммунитета. Интервал от первой дозы не менее 4 недель.',
    lectureId: 'hepb',
    availableBrands: [
      { name: 'Регевак B', country: 'Россия', description: 'Рекомбинантная вакцина.' },
      { name: 'Энджерикс B', country: 'Бельгия', description: 'Импортный аналог.' }
    ]
  },
  {
    id: 'rota-1',
    name: 'Ротавирус (1)',
    disease: 'Ротавирусная инфекция',
    ageMonthStart: 2,
    isLive: true,
    description: 'ВАЖНО: Первая доза строго до 15 недель жизни! Защищает от тяжелой диареи и обезвоживания.',
    lectureId: 'rota',
    availableBrands: [
      { name: 'РотаТек', country: 'США', description: 'Пентавалентная живая вакцина (капли в рот). Курс 3 дозы.' },
      { name: 'Рота-V-Эйд', country: 'Индия/РФ', description: 'Пентавалентная живая вакцина.' }
    ]
  },
  {
    id: 'hepb-risk-3',
    name: 'Гепатит B (3, риск)',
    disease: 'Гепатит B',
    ageMonthStart: 2,
    description: 'Третья доза для групп риска (схема 0-1-2-12). Обеспечивает быструю защиту при контакте с носителем.',
    requiredRiskFactor: 'hepB',
    lectureId: 'hepb',
    availableBrands: [
      { name: 'Регевак B', country: 'Россия', description: 'Рекомбинантная вакцина.' },
      { name: 'Энджерикс B', country: 'Бельгия', description: 'Импортный аналог.' }
    ]
  },
  {
    id: 'pneumo-1',
    name: 'Пневмококк (1)',
    disease: 'Пневмококковая инфекция',
    ageMonthStart: 2,
    description: 'V1. Конъюгированная вакцина (ПКВ13). Защищает от пневмонии, отитов и гнойных менингитов. Совместима с Пентаксимом.',
    lectureId: 'pneumo',
    availableBrands: [
      { name: 'Превенар 13', country: 'США/Россия', description: 'Конъюгированная вакцина, защищает от 13 серотипов. Золотой стандарт.' },
      { name: 'Пневмотекс', country: 'Россия', description: 'Отечественный аналог Превенара 13.' },
      { name: 'Синфлорикс', country: 'Бельгия', description: 'Защищает от 10 штаммов пневмококка и гемофильной инфекции.' }
    ]
  },
  {
    id: 'dtp-1',
    name: 'АКДС / Пентаксим (1)',
    disease: 'Коклюш, Дифтерия, Столбняк',
    ageMonthStart: 3,
    description: 'V1. Базовая вакцинация. Самая важная прививка первого года. Цельноклеточные (АКДС) дают сильный иммунитет, но чаще вызывают температуру. Бесклеточные (Пентаксим) переносятся легче.',
    lectureId: 'dtp',
    availableBrands: [
      { name: 'Пентаксим', country: 'Франция', description: '5-в-1: АКДС(aP) + Полио(ИПВ) + Гемофильная(Hib). Золотой стандарт.' },
      { name: 'Инфанрикс Гекса', country: 'Бельгия', description: '6-в-1: АКДС(aP) + Полио(ИПВ) + Гемофильная(Hib) + Гепатит B.' },
      { name: 'Инфанрикс', country: 'Бельгия', description: 'Трехвалентная АКДС(aP). Только Коклюш-Дифтерия-Столбняк.' },
      { name: 'АКДС', country: 'Россия', description: 'Цельноклеточная (wP). Эффективна, но часто вызывает температуру (до 50%).' },
      { name: 'Бубо-Кок', country: 'Россия', description: 'АКДС(wP) + Гепатит B.' }
    ]
  },
  {
    id: 'polio-1',
    name: 'Полиомиелит (1)',
    disease: 'Полиомиелит',
    ageMonthStart: 3,
    description: 'V1. Инактивированная вакцина (ИПВ). Укол в ножку или плечо. Первая доза в жизни должна быть строго ИПВ для безопасности.',
    lectureId: 'polio',
    availableBrands: [
      { name: 'Полимилекс', country: 'Россия', description: 'Инактивированная (ИПВ). Стандарт качества.' },
      { name: 'Имовакс Полио', country: 'Франция', description: 'Инактивированная (ИПВ).' },
      { name: 'Пентаксим', country: 'Франция', description: 'В составе комбинированной (5-в-1).' },
      { name: 'Инфанрикс Гекса', country: 'Бельгия', description: 'В составе комбинированной (6-в-1).' }
    ]
  },
  {
    id: 'hib-1',
    name: 'Гемофильная (1)',
    disease: 'Гемофильная инфекция типа b',
    ageMonthStart: 3,
    description: 'V1. Первая вакцинация. С 2021 года обязательна для всех детей. Защищает от тяжелых менингитов и эпиглоттита.',
    lectureId: 'hib',
    availableBrands: [
      { name: 'Хиберикс', country: 'Бельгия', description: 'Моновакцина.' },
      { name: 'Акт-ХИБ', country: 'Франция', description: 'Моновакцина.' },
      { name: 'Пентаксим', country: 'Франция', description: 'В составе (флакон с порошком).' },
      { name: 'Инфанрикс Гекса', country: 'Бельгия', description: 'В составе композиции.' }
    ]
  },
  {
    id: 'rota-2',
    name: 'Ротавирус (2)',
    disease: 'Ротавирусная инфекция',
    ageMonthStart: 3, // Usually given around 3-4 months (min 4 weeks after dose 1)
    isLive: true,
    description: 'Вторая доза вакцины.',
    lectureId: 'rota',
    availableBrands: [
      { name: 'РотаТек', country: 'США', description: 'Капли.' },
      { name: 'Рота-V-Эйд', country: 'Индия/РФ', description: 'Капли.' }
    ]
  },
  {
    id: 'pneumo-2',
    name: 'Пневмококк (2)',
    disease: 'Пневмококковая инфекция',
    ageMonthStart: 4.5,
    description: 'V2. Вторая доза. Минимальный интервал от V1 — 8 недель.',
    lectureId: 'pneumo',
    availableBrands: [
      { name: 'Превенар 13', country: 'США/Россия', description: 'Продолжение курса.' },
      { name: 'Пневмотекс', country: 'Россия', description: 'Отечественный аналог.' }
    ]
  },
  {
    id: 'dtp-2',
    name: 'АКДС / Пентаксим (2)',
    disease: 'Коклюш, Дифтерия, Столбняк',
    ageMonthStart: 4.5,
    description: 'Вторая вакцинация.',
    lectureId: 'dtp',
    availableBrands: [
      { name: 'Пентаксим', country: 'Франция', description: 'Комбинированная вакцина 5-в-1.' },
      { name: 'Инфанрикс', country: 'Бельгия', description: 'Бесклеточная АКДС.' },
      { name: 'АКДС', country: 'Россия', description: 'Цельноклеточная.' }
    ]
  },
  {
    id: 'polio-2',
    name: 'Полиомиелит (2)',
    disease: 'Полиомиелит',
    ageMonthStart: 4.5,
    description: 'V2. Вторая доза. Инактивированная вакцина (ИПВ).',
    lectureId: 'polio',
    availableBrands: [
      { name: 'Полимилекс', country: 'Россия', description: 'Инактивированная (ИПВ). Укол.' },
      { name: 'Имовакс Полио', country: 'Франция', description: 'Инактивированная (ИПВ).' }
    ]
  },
  {
    id: 'hib-2',
    name: 'Гемофильная (2)',
    disease: 'Гемофильная инфекция типа b',
    ageMonthStart: 4.5,
    description: 'V2. Вторая доза.',
    lectureId: 'hib',
    availableBrands: [
      { name: 'Хиберикс', country: 'Бельгия', description: 'Моновакцина.' },
      { name: 'Акт-ХИБ', country: 'Франция', description: 'Моновакцина.' },
      { name: 'Пентаксим', country: 'Франция', description: 'В составе.' }
    ]
  },
  {
    id: 'rota-3',
    name: 'Ротавирус (3)',
    disease: 'Ротавирусная инфекция',
    ageMonthStart: 4.5, // Usually given around 4.5-6 months
    isLive: true,
    description: 'Третья доза. ВАЖНО: Курс должен быть завершен строго до 8 месяцев (32 недели)!',
    lectureId: 'rota',
    availableBrands: [
      { name: 'РотаТек', country: 'США', description: 'Капли.' }
    ]
  },
  {
    id: 'hepb-3',
    name: 'Гепатит B (3)',
    disease: 'Гепатит B',
    ageMonthStart: 6,
    description: 'Третья доза. Завершает первичный курс. Формирует иммунитет на 30+ лет.',
    excludedRiskFactor: 'hepB', // Hide if in risk group (they follow 0-1-2-12)
    lectureId: 'hepb',
    availableBrands: [
      { name: 'Регевак B', country: 'Россия', description: 'Стандарт.' },
      { name: 'Энджерикс B', country: 'Бельгия', description: 'Импортный аналог.' }
    ]
  },
  {
    id: 'dtp-3',
    name: 'АКДС / Пентаксим (3)',
    disease: 'Коклюш, Дифтерия, Столбняк',
    ageMonthStart: 6,
    description: 'Третья вакцинация.',
    lectureId: 'dtp',
    availableBrands: [
      { name: 'Пентаксим', country: 'Франция', description: '5-в-1.' },
      { name: 'Инфанрикс', country: 'Бельгия', description: 'Бесклеточная.' },
      { name: 'АКДС', country: 'Россия', description: 'Цельноклеточная.' }
    ]
  },
  {
    id: 'polio-3',
    name: 'Полиомиелит (3)',
    disease: 'Полиомиелит',
    ageMonthStart: 6,
    description: 'V3. Третья доза. Инактивированная вакцина (ИПВ).',
    lectureId: 'polio',
    availableBrands: [
      { name: 'Полимилекс', country: 'Россия', description: 'Инактивированная (ИПВ).' },
      { name: 'Имовакс Полио', country: 'Франция', description: 'Инактивированная (ИПВ).' }
    ]
  },
  {
    id: 'hib-3',
    name: 'Гемофильная (3)',
    disease: 'Гемофильная инфекция типа b',
    ageMonthStart: 6,
    description: 'V3. Третья доза. Завершает первичный цикл для детей до года.',
    lectureId: 'hib',
    availableBrands: [
      { name: 'Хиберикс', country: 'Бельгия', description: 'Моновакцина.' },
      { name: 'Пентаксим', country: 'Франция', description: 'В составе.' }
    ]
  },
  {
    id: 'flu-1',
    name: 'Грипп (осень)',
    disease: 'Грипп',
    ageMonthStart: 6,
    description: 'Проводится ежегодно осенью. Детям, прививающимся впервые до 9 лет, нужны 2 дозы с интервалом 4 недели.',
    lectureId: 'flu',
    availableBrands: [
      { name: 'Ультрикс Квадри', country: 'Россия', description: '4-валентная, без консервантов. Разрешена с 6 мес.' },
      { name: 'Гриппол Квадри', country: 'Россия', description: '4-валентная.' }
    ]
  },
  {
    id: 'hepb-risk-4',
    name: 'Гепатит B (4, риск)',
    disease: 'Гепатит B',
    ageMonthStart: 12,
    description: 'Четвертая доза для групп риска (схема 0-1-2-12). Завершает курс.',
    requiredRiskFactor: 'hepB',
    lectureId: 'hepb',
    availableBrands: [
      { name: 'Регевак B', country: 'Россия', description: 'Стандарт.' },
      { name: 'Энджерикс B', country: 'Бельгия', description: 'Импортный аналог.' }
    ]
  },
  {
    id: 'mmr-1',
    name: 'КПК (1)',
    disease: 'Корь, Краснуха, Паротит',
    ageMonthStart: 12,
    isLive: true,
    description: 'V1. Первая вакцинация в год. ВАЖНО: Возможна отложенная реакция (температура, сыпь) на 5-15 день после прививки. Ребенок не заразен.',
    lectureId: 'mmr',
    availableBrands: [
      { name: 'Вактривир', country: 'Россия', description: 'Отечественная трехкомпонентная вакцина (Корь-Краснуха-Паротит).' },
      { name: 'М-М-Р II', country: 'США/Нидерланды', description: 'Импортная трехкомпонентная вакцина. Хорошо переносится.' },
      { name: 'Дивакцина', country: 'Россия', description: 'Двухкомпонентная (Корь + Паротит). Краснуху нужно делать отдельно.' }
    ]
  },
  {
    id: 'mening-acwy-1',
    name: 'Менингококк ACWY (1)',
    disease: 'Менингококковая инфекция (A,C,W,Y)',
    ageMonthStart: 9,
    isRecommended: true,
    description: 'V1. Конъюгированная вакцина (Менактра). Защищает от 4 самых опасных серогрупп. При начале до 2 лет требуется 2 дозы.',
    lectureId: 'mening',
    availableBrands: [
      { name: 'Менактра', country: 'США', description: 'Золотой стандарт. Разрешена с 9 месяцев. Формирует длительную память.' },
      { name: 'МенКвадфи', country: 'Франция', description: 'Новая конъюгированная вакцина, разрешена с 12 месяцев.' }
    ]
  },
  {
    id: 'mening-acwy-2',
    name: 'Менингококк ACWY (2)',
    disease: 'Менингококковая инфекция (A,C,W,Y)',
    ageMonthStart: 12,
    isRecommended: true,
    description: 'V2. Вторая доза (через 3 месяца после V1). Требуется только если вакцинация начата до 23 месяцев.',
    lectureId: 'mening',
    availableBrands: [
      { name: 'Менактра', country: 'США' },
      { name: 'МенКвадфи', country: 'Франция' }
    ]
  },
  {
    id: 'mening-b-1',
    name: 'Менингококк B (1)',
    disease: 'Менингококковая инфекция (B)',
    ageMonthStart: 2,
    isRecommended: true,
    description: 'V1. Бексеро. Защищает от серогруппы B, которая не входит в Менактру. Рекомендуется для полной защиты.',
    availableBrands: [
      { name: 'Бексеро', country: 'Италия/Великобритания', description: 'Рекомбинантная вакцина против менингита группы B.' }
    ]
  },
  {
    id: 'mening-b-2',
    name: 'Менингококк B (2)',
    disease: 'Менингококковая инфекция (B)',
    ageMonthStart: 4.5,
    isRecommended: true,
    description: 'V2. Вторая доза Бексеро.',
    availableBrands: [
      { name: 'Бексеро', country: 'Италия/Великобритания' }
    ]
  },
  {
    id: 'pneumo-rv',
    name: 'Пневмококк (Рев)',
    disease: 'Пневмококковая инфекция',
    ageMonthStart: 15,
    description: 'RV. Ревакцинация. Не ранее чем через 6 месяцев после последней дозы. При начале вакцинации после 2 лет здоровым детям не требуется (достаточно 1 дозы ПКВ13).',
    lectureId: 'pneumo',
    availableBrands: [
      { name: 'Превенар 13', country: 'США/Россия', description: 'Закрепление иммунитета.' },
      { name: 'Пневмотекс', country: 'Россия', description: 'Отечественный аналог.' }
    ]
  },
  {
    id: 'pneumo-ppv23',
    name: 'Пневмококк ППВ23',
    disease: 'Пневмококковая инфекция',
    ageMonthStart: 24, // 2 years
    description: 'Полисахаридная вакцина (Пневмовакс 23). Вводится ГРУППАМ РИСКА для расширения защиты (через 8 недель после ПКВ13). Минимум в 2 года.',
    lectureId: 'pneumo',
    availableBrands: [
      { name: 'Пневмовакс 23', country: 'США', description: 'Защищает от 23 серотипов. Только для групп риска с 2 лет.' }
    ]
  },
  {
    id: 'polio-rv1',
    name: 'Полиомиелит (Рев-1)',
    disease: 'Полиомиелит',
    ageMonthStart: 18,
    description: 'RV1. Первая ревакцинация. Согласно Приказу 1122н, теперь проводится инактивированной вакциной (ИПВ).',
    lectureId: 'polio',
    availableBrands: [
      { name: 'Полимилекс', country: 'Россия', description: 'Инактивированная (ИПВ).' },
      { name: 'Имовакс Полио', country: 'Франция', description: 'Инактивированная (ИПВ).' },
      { name: 'Пентаксим', country: 'Франция', description: 'В составе комплекса.' }
    ]
  },
  {
    id: 'dtp-rv1',
    name: 'АКДС (Рев-1)',
    disease: 'Коклюш, Дифтерия, Столбняк',
    ageMonthStart: 18,
    description: 'RV1. Первая ревакцинация. Проводится строго через 12 месяцев после V3. Закрепляет иммунитет на несколько лет.',
    lectureId: 'dtp',
    availableBrands: [
      { name: 'Пентаксим', country: 'Франция', description: '5-в-1.' },
      { name: 'Инфанрикс Гекса', country: 'Бельгия', description: '6-в-1.' },
      { name: 'Инфанрикс', country: 'Бельгия', description: 'Трехвалентная АКДС(aP).' },
      { name: 'АКДС', country: 'Россия', description: 'Цельноклеточная (wP).' }
    ]
  },
  {
    id: 'hib-rv1',
    name: 'Гемофильная (Рев)',
    disease: 'Гемофильная инфекция типа b',
    ageMonthStart: 18,
    description: 'RV. Ревакцинация. Обеспечивает длительную защиту.',
    lectureId: 'hib',
    availableBrands: [
      { name: 'Хиберикс', country: 'Бельгия', description: 'Моновакцина.' },
      { name: 'Пентаксим', country: 'Франция', description: 'В составе.' }
    ]
  },
  {
    id: 'polio-rv2',
    name: 'Полиомиелит (Рев-2)',
    disease: 'Полиомиелит',
    ageMonthStart: 20,
    isLive: true, // Becomes live if OPV is used (BiVac)
    description: 'RV2. Вторая ревакцинация. Здоровым детям вводятся живые капли (ОПВ). Детям из группы риска — инактивированный укол (ИПВ).',
    lectureId: 'polio',
    availableBrands: [
      { name: 'БиВак Полио', country: 'Россия', description: 'Оральная (ОПВ) - капли в рот. Создает местный иммунитет.' },
      { name: 'Полимилекс', country: 'Россия', description: 'Инактивированная (ИПВ) - укол. Для групп риска.' }
    ]
  },
  {
    id: 'mmr-rv',
    name: 'КПК (Рев)',
    disease: 'Корь, Краснуха, Паротит',
    ageMonthStart: 72, // 6 years
    isLive: true,
    description: 'RV. Ревакцинация перед школой. Обращайте внимание на реакции на 5-15 день.',
    lectureId: 'mmr',
    availableBrands: [
      { name: 'Вактривир', country: 'Россия', description: 'Комплексная.' },
      { name: 'М-М-Р II', country: 'США', description: 'Комплексная.' }
    ]
  },
  {
    id: 'tuberc-rv',
    name: 'БЦЖ (Ревакцинация)',
    disease: 'Туберкулез',
    ageMonthStart: 84, // 7 years (6-7 years range)
    isLive: true,
    description: 'RV2. Проводится в 6-7 лет (перед школой). ВАЖНО: Только при отрицательной реакции Манту! При положительной или сомнительной пробе вакцинация противопоказана.',
    lectureId: 'bcg',
    availableBrands: [
      { name: 'БЦЖ', country: 'Россия', description: 'Живая вакцина.' }
    ]
  },
  {
    id: 'dtp-rv2',
    name: 'АДС-М (Рев-2)',
    disease: 'Дифтерия, Столбняк',
    ageMonthStart: 84, // 7 years
    description: 'Ревакцинация в 7 лет (без коклюшного компонента).',
    lectureId: 'dtp',
    availableBrands: [
      { name: 'АДС-М', country: 'Россия', description: 'Анатоксин дифтерийно-столбнячный.' },
      { name: 'Адасель', country: 'Канада', description: 'Содержит коклюшный компонент! Рекомендуется для лучшей защиты.' }
    ]
  },
  {
    id: 'polio-rv3',
    name: 'Полиомиелит (Рев-3)',
    disease: 'Полиомиелит',
    ageMonthStart: 72, // 6 years
    isLive: true, // Becomes live if OPV is used
    description: 'RV3. Третья ревакцинация в 6 лет. Здоровым детям ОПВ (капли), группам риска — ИПВ (укол).',
    lectureId: 'polio',
    availableBrands: [
      { name: 'БиВак Полио', country: 'Россия', description: 'Живые капли.' },
      { name: 'Полимилекс', country: 'Россия', description: 'Инактивированная (ИПВ).' }
    ]
  },
  {
    id: 'covid-1',
    name: 'COVID-19 (1)',
    disease: 'Коронавирусная инфекция',
    ageMonthStart: 144, // 12 years
    isRecommended: true,
    description: 'V1. Вакцинация подростков 12-17 лет. Проводится добровольно по заявлению родителей.',
    lectureId: 'covid',
    availableBrands: [
      { name: 'Спутник М', country: 'Россия', description: 'Гам-КОВИД-Вак-М. Ослабленная в 5 раз доза взрослой вакцины.' }
    ]
  },
  {
    id: 'covid-2',
    name: 'COVID-19 (2)',
    disease: 'Коронавирусная инфекция',
    ageMonthStart: 145, // 12 years + 3 weeks
    isRecommended: true,
    description: 'V2. Вторая доза через 21 день.',
    lectureId: 'covid',
    availableBrands: [
      { name: 'Спутник М', country: 'Россия' }
    ]
  },
  {
    id: 'ats-sos',
    name: 'Экстренная профилактика столбняка (ПСС/ПСЧИ)',
    disease: 'Столбняк',
    ageMonthStart: 0,
    isRecommended: true,
    description: 'ЭКСТРЕННАЯ ПРОФИЛАКТИКА (МУ 3.1.2436-09). При травмах, ожогах, обморожениях, укусах животных и родах вне стационара.',
    lectureId: 'ats',
    availableBrands: [
      { name: 'ПСС', country: 'Россия', description: 'Сыворотка противостолбнячная лошадиная очищенная концентрированная.' },
      { name: 'ПСЧИ', country: 'Россия', description: 'Иммуноглобулин противостолбнячный человека.' },
      { name: 'АС-Анатоксин', country: 'Россия', description: 'Столбнячный анатоксин адсорбированный.' }
    ]
  }
];