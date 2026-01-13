/**
 * Утилиты для расчета антропометрических показателей
 * Используется в модуле Приемы для точного расчета дозировок препаратов
 */

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
 * Определяет категорию ИМТ для детей с учетом возраста
 * Использует упрощенную классификацию (для точной нужны таблицы ВОЗ)
 * @param bmi - индекс массы тела
 * @param ageMonths - возраст в месяцах
 * @returns категория веса
 */
export function getBMICategory(bmi: number, ageMonths: number): 'underweight' | 'normal' | 'overweight' | 'obese' {
  // Упрощенная классификация (для точной нужны перцентильные таблицы ВОЗ)
  // Для детей до 2 лет используются другие критерии
  if (ageMonths < 24) {
    // Для детей до 2 лет
    if (bmi < 14) return 'underweight';
    if (bmi < 18) return 'normal';
    if (bmi < 20) return 'overweight';
    return 'obese';
  }
  
  // Для детей старше 2 лет (упрощенно)
  if (bmi < 16) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/**
 * Получает текстовое описание категории ИМТ на русском
 */
export function getBMICategoryLabel(category: 'underweight' | 'normal' | 'overweight' | 'obese'): string {
  const labels = {
    underweight: 'Недостаток веса',
    normal: 'Норма',
    overweight: 'Избыток веса',
    obese: 'Ожирение'
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
