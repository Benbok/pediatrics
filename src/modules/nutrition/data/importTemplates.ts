// ─── Static data for JSON import panel ───────────────────────────────────────
// categoryId mapping (from seeded DB):
//   1=BREAST_MILK  2=INFANT_FORMULA  3=VEG_PUREE  4=CEREAL  5=FRUIT_PUREE
//   6=MEAT  7=FISH  8=EGG_YOLK  9=JUICE  10=DAIRY_1_3Y  11=BREAD_PASTA

// One minimal example template per category (used as a fill-in guide for bulk import)
export const FORMULA_IMPORT_TEMPLATES: Record<string, object[]> = {
  'Грудное молоко': [
    { categoryId: 1, name: 'Грудное молоко', energyKcalPer100ml: 70, proteinGPer100g: 1.1, fatGPer100g: 4.5, carbsGPer100g: 7.0, minAgeDays: 0, maxAgeDays: 365 },
  ],
  'Молочная смесь': [
    { categoryId: 2, brand: 'Nestlé', name: 'NAN Optipro 1', energyKcalPer100ml: 67, energyKcalPer100g: 510, proteinGPer100g: 12.0, fatGPer100g: 27.3, carbsGPer100g: 55.7, minAgeDays: 0, maxAgeDays: 180, formulaType: 'standard' },
  ],
  'Овощное пюре': [
    { categoryId: 3, name: 'Кабачок', energyKcalPer100g: 27, proteinGPer100g: 0.6, fatGPer100g: 0.3, carbsGPer100g: 5.7, minAgeDays: 150, maxAgeDays: 1095 },
  ],
  'Каша': [
    { categoryId: 4, brand: 'Heinz', name: 'Гречневая каша безмолочная', energyKcalPer100g: 356, proteinGPer100g: 10.5, fatGPer100g: 2.4, carbsGPer100g: 73.0, minAgeDays: 150, maxAgeDays: 1095 },
  ],
  'Фруктовое пюре': [
    { categoryId: 5, name: 'Яблоко', energyKcalPer100g: 46, proteinGPer100g: 0.4, fatGPer100g: 0.4, carbsGPer100g: 9.8, minAgeDays: 120, maxAgeDays: 1095 },
  ],
  'Мясное пюре': [
    { categoryId: 6, name: 'Индейка', energyKcalPer100g: 101, proteinGPer100g: 15.0, fatGPer100g: 4.5, carbsGPer100g: 0.0, minAgeDays: 180, maxAgeDays: 1095 },
  ],
  'Рыба': [
    { categoryId: 7, name: 'Минтай', energyKcalPer100g: 72, proteinGPer100g: 15.9, fatGPer100g: 0.7, carbsGPer100g: 0.0, minAgeDays: 270, maxAgeDays: 1095 },
  ],
  'Желток': [
    { categoryId: 8, name: 'Желток куриного яйца', energyKcalPer100g: 322, proteinGPer100g: 16.2, fatGPer100g: 26.6, carbsGPer100g: 3.6, minAgeDays: 210, maxAgeDays: 1095 },
  ],
  'Сок': [
    { categoryId: 9, name: 'Яблочный сок осветлённый', energyKcalPer100ml: 40, proteinGPer100g: 0.2, fatGPer100g: 0.1, carbsGPer100g: 9.5, minAgeDays: 270, maxAgeDays: 1095 },
  ],
  'Молочные продукты': [
    { categoryId: 10, brand: 'Агуша', name: 'Творог детский 4.5%', energyKcalPer100g: 95, proteinGPer100g: 7.0, fatGPer100g: 4.5, carbsGPer100g: 5.5, minAgeDays: 270, maxAgeDays: 1095 },
  ],
  'Хлеб и крупы': [
    { categoryId: 11, name: 'Пшеничные сухарики', energyKcalPer100g: 330, proteinGPer100g: 8.0, fatGPer100g: 1.0, carbsGPer100g: 72.0, minAgeDays: 210, maxAgeDays: 1095 },
  ],
};

export const PRODUCT_CAT_LABELS: Record<string, string> = {
  '1': 'Грудное молоко',
  '2': 'Молочная смесь',
  '3': 'Овощное пюре',
  '4': 'Каша',
  '5': 'Фруктовое пюре',
  '6': 'Мясное пюре',
  '7': 'Рыба',
  '8': 'Желток',
  '9': 'Сок',
  '10': 'Молочные продукты',
  '11': 'Хлеб / крупы',
};

export const PRODUCT_SCHEMA_HELP = [
  { field: 'categoryId',          required: true,  desc: 'ID категории (см. ниже)' },
  { field: 'name',                required: true,  desc: 'Название продукта/смеси' },
  { field: 'energyKcalPer100ml',  required: false, desc: 'Ккал на 100 мл (обязательно одно из двух)' },
  { field: 'energyKcalPer100g',   required: false, desc: 'Ккал на 100 г (обязательно одно из двух)' },
  { field: 'minAgeDays',          required: true,  desc: 'Минимальный возраст в днях (0 = с рождения)' },
  { field: 'maxAgeDays',          required: true,  desc: 'Максимальный возраст в днях (365=1г, 1095=3г)' },
  { field: 'brand',               required: false, desc: 'Производитель/бренд' },
  { field: 'formulaType',         required: false, desc: 'Тип смеси (см. ниже)' },
  { field: 'proteinGPer100g',     required: false, desc: 'Белки г/100г' },
  { field: 'fatGPer100g',         required: false, desc: 'Жиры г/100г' },
  { field: 'carbsGPer100g',       required: false, desc: 'Углеводы г/100г' },
  { field: 'compositionJson',     required: false, desc: 'Доп. состав (JSON-строка)' },
];
