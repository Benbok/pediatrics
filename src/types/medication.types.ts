/**
 * TypeScript типы для структуры препаратов по модели Vidal.ru
 */

/**
 * Статус применения при состоянии (почки/печень/дети)
 * Can — можно, Care — с осторожностью, Not — нельзя, Qwes — под вопросом
 */
export type VidalUsing = 'Can' | 'Care' | 'Not' | 'Qwes';

/**
 * Форма выпуска препарата
 */
export interface MedicationForm {
  type: 'tablet' | 'solution' | 'suppository' | 'suspension' | 'injection' | 'capsule' | 'powder';
  concentration?: string; // "24 mg/ml", "500 mg/tab"
  volume?: string; // "100 ml", "50 ml"
  packaging?: string[]; // ["50 мл", "100 мл"]
  flavors?: string[]; // ["вишневый", "ванильный", "клубничный", "апельсиновый"]
  description?: string; // Полное описание формы
}

/**
 * Правило дозирования для педиатрии
 */
export interface PediatricDosingRule {
  minAgeMonths: number;
  maxAgeMonths: number;
  minWeightKg?: number;
  maxWeightKg?: number;
  
  // Разные способы дозирования
  dosing: {
    type: 'fixed' | 'weight_based' | 'bsa_based';
    
    // Фиксированная доза
    fixedDose?: {
      min: number; // мг
      max?: number; // мг (опционально, если диапазон)
      unit: 'mg' | 'ml';
    };
    
    // По весу
    mgPerKg?: number;
    maxMgPerKg?: number;
    
    // По площади тела
    mgPerM2?: number;
  };
  
  timesPerDay: number;
  maxSingleDose?: number; // мг
  maxDailyDose?: number;  // мг
  
  instruction: string; // Текстовое описание
  form?: string; // Для какой формы выпуска это правило
}

/**
 * Краткое описание правила для выбора в UI
 */
export interface MatchingRuleSummary {
  ruleIndex: number;
  label: string;
}

/**
 * Пошаговый расчёт дозы для отображения пользователю
 */
export interface CalculationBreakdown {
  formulaType: 'weight_based' | 'bsa_based' | 'fixed' | 'age_based';
  steps: string[];
}

export interface CalculatedDoseForm {
  id: string;
  type: string;
  concentration?: string | null;
  unit?: string | null;
  strengthMg?: number | null;
  mgPerMl?: number | null;
  volumeMl?: number | null;
  description?: string | null;
}

/**
 * Результат расчета дозировки
 */
export interface DoseCalculationResult {
  canUse: boolean;
  singleDoseMg?: number | null;
  singleDoseMl?: number | null;
  dailyDoseMg?: number | null;
  timesPerDay: number;
  intervalHours?: number | null;
  maxSingleDose?: number | null;
  maxDailyDose?: number | null;
  minInterval?: number | null; // часы
  maxDosesPerDay?: number | null;
  routeOfAdmin?: string | null;
  form?: CalculatedDoseForm | null;
  infusion?: {
    concentration?: string | null;
    dilution?: string | null;
    rate?: string | null;
    duration?: string | null;
    compatibility?: string[];
    maxConcentration?: string | null;
  } | null;
  instruction: string;
  warnings?: string[] | null;
  bsa?: number | null; // Площадь тела, если использовалась
  message?: string; // Сообщение об ошибке, если canUse = false
  /** Индексы правил в pediatricDosing, подходящих под возраст/вес */
  matchingRuleIndices?: number[];
  /** Индекс правила в pediatricDosing, по которому посчитана доза */
  appliedRuleIndex?: number;
  /** Краткие подписи для выбора правила в модалке */
  matchingRulesSummary?: MatchingRuleSummary[];
  /** Пошаговый расчёт для прозрачности */
  calculationBreakdown?: CalculationBreakdown;
  /** Путь введения, если определён */
  routeOfAdmin?: string | null;
}
