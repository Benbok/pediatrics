/**
 * Утилиты для расчета антропометрических показателей
 * Используется в модуле Приемы для точного расчета дозировок препаратов
 */
import { WHO_BMI_BOYS, WHO_BMI_GIRLS } from '../data/who-lms-bmi';
import { WHO_HFA_BOYS, WHO_HFA_GIRLS } from '../data/who-lms-hfa';

/**
 * Рассчитывает индекс массы тела (ИМТ)
 * @param weight - вес в килограммах
 * @param height - рост в сантиметрах
 * @returns ИМТ (кг/м²)
 */
export function calculateBMI(weight: number, height: number): number {
  if (weight <= 0 || height <= 0) {
    throw new Error('Вес и рост должны быть положительными числами');
  }
  
  const heightInMeters = height / 100;
  return weight / (heightInMeters * heightInMeters);
}

/**
 * Рассчитывает площадь поверхности тела (ППТ) по формуле Мостеллера
 * Формула: ППТ (м²) = √(вес × рост / 3600)
 * @param weight - вес в килограммах
 * @param height - рост в сантиметрах
 * @returns ППТ в квадратных метрах
 */
export function calculateBSA(weight: number, height: number): number {
  if (weight <= 0 || height <= 0) {
    throw new Error('Вес и рост должны быть положительными числами');
  }
  
  return Math.sqrt((weight * height) / 3600);
}

/**
 * Категории ИМТ по методу ВОЗ (Z-score)
 */
export type BMICategory =
  | 'thinness_severe'
  | 'thinness'
  | 'normal'
  | 'overweight'
  | 'obese'
  | 'obese_severe';

/**
 * Рассчитывает Z-score ИМТ по таблицам ВОЗ (метод Cole & Green, LMS).
 * Формула: Z = ((BMI / M)^L - 1) / (L * S)
 * @param bmi - ИМТ
 * @param ageMonths - возраст в месяцах (0–228)
 * @param gender - пол ('male' | 'female')
 * @returns Z-score или null если возраст вне диапазона
 */
export function calculateBMIZScore(
  bmi: number,
  ageMonths: number,
  gender: 'male' | 'female'
): number | null {
  const table = gender === 'male' ? WHO_BMI_BOYS : WHO_BMI_GIRLS;
  const age = Math.round(ageMonths);
  if (age < 0 || age > 228) return null;

  // Найти ближайшую запись (таблица содержит каждый месяц 0-228)
  const entry = table.find(e => e.age === age) ?? table.reduce((prev, curr) =>
    Math.abs(curr.age - age) < Math.abs(prev.age - age) ? curr : prev
  );

  const { L, M, S } = entry;
  if (Math.abs(L) < 1e-6) {
    // При L ≈ 0 используется логарифмическое приближение
    return Math.log(bmi / M) / S;
  }
  return (Math.pow(bmi / M, L) - 1) / (L * S);
}

/**
 * Определяет категорию ИМТ для детей по официальному методу ВОЗ (LMS Z-score).
 * При известном поле используются таблицы ВОЗ; при неизвестном — упрощённые пороги.
 * @param bmi - ИМТ
 * @param ageMonths - возраст в месяцах
 * @param gender - пол (опционально)
 * @returns категория веса
 */
export function getBMICategory(
  bmi: number,
  ageMonths: number,
  gender?: 'male' | 'female'
): BMICategory {
  if (gender) {
    const z = calculateBMIZScore(bmi, ageMonths, gender);
    if (z !== null) {
      if (z < -3) return 'thinness_severe';
      if (z < -2) return 'thinness';
      if (z <= 1) return 'normal';
      if (z <= 2) return 'overweight';
      if (z <= 3) return 'obese';
      return 'obese_severe';
    }
  }

  // Fallback (пол неизвестен или возраст вне диапазона ВОЗ)
  if (ageMonths < 24) {
    if (bmi < 14) return 'thinness';
    if (bmi < 18) return 'normal';
    if (bmi < 20) return 'overweight';
    return 'obese';
  }
  if (bmi < 16) return 'thinness';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/**
 * Получает текстовое описание категории ИМТ на русском
 */
export function getBMICategoryLabel(category: BMICategory): string {
  const labels: Record<BMICategory, string> = {
    thinness_severe: 'Выраженный дефицит массы',
    thinness: 'Дефицит массы',
    normal: 'Норма',
    overweight: 'Избыточный вес',
    obese: 'Ожирение',
    obese_severe: 'Ожирение (тяжёлое)',
  };
  return labels[category];
}

/**
 * Категории роста по методу ВОЗ (Z-score)
 */
export type HeightCategory =
  | 'severely_stunted'
  | 'stunted'
  | 'normal'
  | 'tall';

/**
 * Рассчитывает Z-score роста/длины для возраста по таблицам ВОЗ (LMS).
 * @param height - рост/длина в сантиметрах
 * @param ageMonths - возраст в месяцах (0–228)
 * @param gender - пол ('male' | 'female')
 * @returns Z-score или null если возраст вне диапазона
 */
export function calculateHeightZScore(
  height: number,
  ageMonths: number,
  gender: 'male' | 'female'
): number | null {
  const table = gender === 'male' ? WHO_HFA_BOYS : WHO_HFA_GIRLS;
  const age = Math.round(ageMonths);
  if (age < 0 || age > 228) return null;

  const entry = table.find(e => e.age === age) ?? table.reduce((prev, curr) =>
    Math.abs(curr.age - age) < Math.abs(prev.age - age) ? curr : prev
  );

  const { L, M, S } = entry;
  if (Math.abs(L) < 1e-6) {
    return Math.log(height / M) / S;
  }
  return (Math.pow(height / M, L) - 1) / (L * S);
}

/**
 * Определяет категорию роста для возраста по методу ВОЗ.
 * @param height - рост в сантиметрах
 * @param ageMonths - возраст в месяцах
 * @param gender - пол
 * @returns категория роста
 */
export function getHeightCategory(
  height: number,
  ageMonths: number,
  gender: 'male' | 'female'
): HeightCategory {
  const z = calculateHeightZScore(height, ageMonths, gender);
  if (z === null) return 'normal';
  if (z < -3) return 'severely_stunted';
  if (z < -2) return 'stunted';
  if (z > 3) return 'tall';
  return 'normal';
}

/**
 * Получает текстовое описание категории роста на русском
 */
export function getHeightCategoryLabel(category: HeightCategory): string {
  const labels: Record<HeightCategory, string> = {
    severely_stunted: 'Выраженная задержка роста',
    stunted: 'Задержка роста',
    normal: 'Норма',
    tall: 'Высокий рост',
  };
  return labels[category];
}

/**
 * Валидирует значения роста и веса
 * @param weight - вес в килограммах
 * @param height - рост в сантиметрах
 * @returns объект с валидностью и сообщением об ошибке
 */
export function validateAnthropometry(weight: number | null, height: number | null): { valid: boolean; error?: string } {
  if (weight === null && height === null) {
    return { valid: true }; // Оба значения опциональны
  }
  
  if (weight !== null) {
    if (weight < 0.5 || weight > 200) {
      return { valid: false, error: 'Вес должен быть от 0.5 до 200 кг' };
    }
  }
  
  if (height !== null) {
    if (height < 30 || height > 250) {
      return { valid: false, error: 'Рост должен быть от 30 до 250 см' };
    }
  }
  
  return { valid: true };
}

/**
 * Форматирует значение веса для отображения
 */
export function formatWeight(weight: number | null): string {
  if (weight === null) return '—';
  return `${weight.toFixed(1)} кг`;
}

/**
 * Форматирует значение роста для отображения
 */
export function formatHeight(height: number | null): string {
  if (height === null) return '—';
  return `${height.toFixed(0)} см`;
}

/**
 * Форматирует значение ИМТ для отображения
 */
export function formatBMI(bmi: number | null): string {
  if (bmi === null) return '—';
  return bmi.toFixed(1);
}

/**
 * Форматирует значение ППТ для отображения
 */
export function formatBSA(bsa: number | null): string {
  if (bsa === null) return '—';
  return `${bsa.toFixed(2)} м²`;
}
