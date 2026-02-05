/**
 * TypeScript типы для структуры препаратов по модели Vidal.ru
 */

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
 * Правило дозирования для взрослых
 */
export interface AdultDosingRule {
  minWeightKg?: number;
  maxWeightKg?: number;
  
  dosing: {
    type: 'fixed' | 'weight_based' | 'bsa_based';
    fixedDose?: {
      min: number;
      max?: number;
      unit: 'mg' | 'ml';
    };
    mgPerKg?: number;
    mgPerM2?: number;
  };
  
  timesPerDay: number;
  maxSingleDose?: number;
  maxDailyDose?: number;
  instruction: string;
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

/**
 * Результат расчета дозировки
 */
export interface DoseCalculationResult {
  canUse: boolean;
  singleDoseMg?: number | null;
  dailyDoseMg?: number | null;
  timesPerDay: number;
  maxSingleDose?: number | null;
  maxDailyDose?: number | null;
  minInterval?: number | null; // часы
  maxDosesPerDay?: number | null;
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
}
