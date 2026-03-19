// ─── Static data for JSON import panel ───────────────────────────────────────
// categoryId mapping (from seeded DB):
//   1=BREAST_MILK  2=INFANT_FORMULA  3=VEG_PUREE  4=CEREAL  5=FRUIT_PUREE
//   6=MEAT  7=FISH  8=EGG_YOLK  9=JUICE  10=DAIRY_1_3Y  11=BREAD_PASTA

export const FORMULA_IMPORT_TEMPLATES: Record<string, object[]> = {
  'Смеси 1 ступень (0–6 мес)': [
    { categoryId: 2, brand: 'Nestlé', name: 'NAN Optipro 1', energyKcalPer100ml: 67, energyKcalPer100g: 510, proteinGPer100g: 12.0, fatGPer100g: 27.3, carbsGPer100g: 55.7, minAgeDays: 0, maxAgeDays: 180, formulaType: 'standard' },
    { categoryId: 2, brand: 'Abbott', name: 'Similac Classic 1', energyKcalPer100ml: 67, energyKcalPer100g: 504, proteinGPer100g: 10.8, fatGPer100g: 27.2, carbsGPer100g: 56.7, minAgeDays: 0, maxAgeDays: 180, formulaType: 'standard' },
    { categoryId: 2, brand: 'Danone', name: 'Nutrilon Premium 1', energyKcalPer100ml: 67, energyKcalPer100g: 505, proteinGPer100g: 10.5, fatGPer100g: 27.6, carbsGPer100g: 55.8, minAgeDays: 0, maxAgeDays: 180, formulaType: 'standard' },
    { categoryId: 2, brand: 'Нутритек', name: 'Нутрилак Премиум 1', energyKcalPer100ml: 67, energyKcalPer100g: 510, proteinGPer100g: 11.5, fatGPer100g: 27.0, carbsGPer100g: 56.0, minAgeDays: 0, maxAgeDays: 180, formulaType: 'standard' },
    { categoryId: 2, brand: 'Heinz', name: 'Heinz 1', energyKcalPer100ml: 67, energyKcalPer100g: 510, proteinGPer100g: 11.0, fatGPer100g: 27.5, carbsGPer100g: 56.0, minAgeDays: 0, maxAgeDays: 180, formulaType: 'standard' },
  ],
  'Смеси 2 ступень (6–12 мес)': [
    { categoryId: 2, brand: 'Nestlé', name: 'NAN Optipro 2', energyKcalPer100ml: 68, energyKcalPer100g: 510, proteinGPer100g: 13.5, fatGPer100g: 26.5, carbsGPer100g: 56.0, minAgeDays: 181, maxAgeDays: 365, formulaType: 'standard' },
    { categoryId: 2, brand: 'Abbott', name: 'Similac Classic 2', energyKcalPer100ml: 68, energyKcalPer100g: 510, proteinGPer100g: 13.0, fatGPer100g: 26.8, carbsGPer100g: 56.0, minAgeDays: 181, maxAgeDays: 365, formulaType: 'standard' },
    { categoryId: 2, brand: 'Danone', name: 'Nutrilon Premium 2', energyKcalPer100ml: 68, energyKcalPer100g: 510, proteinGPer100g: 13.5, fatGPer100g: 26.2, carbsGPer100g: 56.5, minAgeDays: 181, maxAgeDays: 365, formulaType: 'standard' },
    { categoryId: 2, brand: 'Нутритек', name: 'Нутрилак Премиум 2', energyKcalPer100ml: 68, energyKcalPer100g: 512, proteinGPer100g: 13.0, fatGPer100g: 27.0, carbsGPer100g: 56.5, minAgeDays: 181, maxAgeDays: 365, formulaType: 'standard' },
  ],
  'Смеси 3 ступень (12–36 мес)': [
    { categoryId: 2, brand: 'Nestlé', name: 'NAN Optipro 3', energyKcalPer100ml: 70, energyKcalPer100g: 530, proteinGPer100g: 15.0, fatGPer100g: 26.0, carbsGPer100g: 55.5, minAgeDays: 366, maxAgeDays: 1095, formulaType: 'standard' },
    { categoryId: 2, brand: 'Danone', name: 'Nutrilon Premium 3', energyKcalPer100ml: 71, energyKcalPer100g: 535, proteinGPer100g: 15.0, fatGPer100g: 26.5, carbsGPer100g: 54.5, minAgeDays: 366, maxAgeDays: 1095, formulaType: 'standard' },
    { categoryId: 2, brand: 'Abbott', name: 'Similac Classic 3', energyKcalPer100ml: 69, energyKcalPer100g: 525, proteinGPer100g: 14.0, fatGPer100g: 26.0, carbsGPer100g: 56.0, minAgeDays: 366, maxAgeDays: 1095, formulaType: 'standard' },
  ],
  'Гипоаллергенные смеси (гидролизат)': [
    { categoryId: 2, brand: 'Nestlé', name: 'NAN ГА 1', energyKcalPer100ml: 67, energyKcalPer100g: 505, proteinGPer100g: 11.0, fatGPer100g: 27.0, carbsGPer100g: 56.3, minAgeDays: 0, maxAgeDays: 180, formulaType: 'hydrolysate' },
    { categoryId: 2, brand: 'Danone', name: 'Nutrilon ГА 1', energyKcalPer100ml: 67, energyKcalPer100g: 505, proteinGPer100g: 11.5, fatGPer100g: 26.8, carbsGPer100g: 55.9, minAgeDays: 0, maxAgeDays: 180, formulaType: 'hydrolysate' },
    { categoryId: 2, brand: 'Hipp', name: 'Hipp HA Combiotic 1', energyKcalPer100ml: 66, energyKcalPer100g: 500, proteinGPer100g: 10.5, fatGPer100g: 27.5, carbsGPer100g: 56.0, minAgeDays: 0, maxAgeDays: 180, formulaType: 'hydrolysate' },
    { categoryId: 2, brand: 'Nestlé', name: 'Alfare', energyKcalPer100ml: 68, energyKcalPer100g: 508, proteinGPer100g: 18.0, fatGPer100g: 28.0, carbsGPer100g: 48.6, minAgeDays: 0, maxAgeDays: 365, formulaType: 'hydrolysate' },
  ],
  'Аминокислотные смеси': [
    { categoryId: 2, brand: 'Nestlé', name: 'Alfamino', energyKcalPer100ml: 68, energyKcalPer100g: 510, proteinGPer100g: 16.9, fatGPer100g: 28.6, carbsGPer100g: 49.4, minAgeDays: 0, maxAgeDays: 365, formulaType: 'amino-acid' },
    { categoryId: 2, brand: 'Danone', name: 'Neocate LCP', energyKcalPer100ml: 68, energyKcalPer100g: 510, proteinGPer100g: 14.5, fatGPer100g: 29.5, carbsGPer100g: 51.0, minAgeDays: 0, maxAgeDays: 365, formulaType: 'amino-acid' },
  ],
  'Соевые смеси': [
    { categoryId: 2, brand: 'Nestlé', name: 'NAN Соя', energyKcalPer100ml: 67, energyKcalPer100g: 505, proteinGPer100g: 13.2, fatGPer100g: 27.0, carbsGPer100g: 54.5, minAgeDays: 180, maxAgeDays: 1095, formulaType: 'soy' },
    { categoryId: 2, brand: 'Danone', name: 'Nutrilon Соя', energyKcalPer100ml: 67, energyKcalPer100g: 505, proteinGPer100g: 13.5, fatGPer100g: 27.5, carbsGPer100g: 53.8, minAgeDays: 180, maxAgeDays: 1095, formulaType: 'soy' },
  ],
  'Антирефлюксные смеси (AR)': [
    { categoryId: 2, brand: 'Nestlé', name: 'NAN AR', energyKcalPer100ml: 67, energyKcalPer100g: 505, proteinGPer100g: 12.3, fatGPer100g: 27.0, carbsGPer100g: 55.7, minAgeDays: 0, maxAgeDays: 365, formulaType: 'AR' },
    { categoryId: 2, brand: 'Danone', name: 'Nutrilon AR', energyKcalPer100ml: 67, energyKcalPer100g: 505, proteinGPer100g: 12.5, fatGPer100g: 27.2, carbsGPer100g: 55.0, minAgeDays: 0, maxAgeDays: 365, formulaType: 'AR' },
  ],
  'Низколактозные смеси (LF)': [
    { categoryId: 2, brand: 'Nestlé', name: 'NAN безлактозный', energyKcalPer100ml: 68, energyKcalPer100g: 510, proteinGPer100g: 13.0, fatGPer100g: 27.0, carbsGPer100g: 55.5, minAgeDays: 0, maxAgeDays: 365, formulaType: 'LF' },
    { categoryId: 2, brand: 'Abbott', name: 'Similac безлактозный', energyKcalPer100ml: 67, energyKcalPer100g: 505, proteinGPer100g: 12.8, fatGPer100g: 27.3, carbsGPer100g: 55.5, minAgeDays: 0, maxAgeDays: 365, formulaType: 'LF' },
  ],
  'Смеси для недоношенных': [
    { categoryId: 2, brand: 'Nestlé', name: 'Pre NAN', energyKcalPer100ml: 80, energyKcalPer100g: 600, proteinGPer100g: 19.0, fatGPer100g: 34.0, carbsGPer100g: 43.0, minAgeDays: 0, maxAgeDays: 90, formulaType: 'premature' },
    { categoryId: 2, brand: 'Abbott', name: 'Similac Neo Sure', energyKcalPer100ml: 73, energyKcalPer100g: 545, proteinGPer100g: 16.3, fatGPer100g: 27.5, carbsGPer100g: 51.5, minAgeDays: 0, maxAgeDays: 120, formulaType: 'premature' },
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
