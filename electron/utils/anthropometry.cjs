/**
 * Утилиты для расчета антропометрических показателей (CommonJS версия для бэкенда)
 */

/**
 * Рассчитывает индекс массы тела (ИМТ)
 */
function calculateBMI(weight, height) {
  if (weight <= 0 || height <= 0) {
    throw new Error('Вес и рост должны быть положительными числами');
  }
  
  const heightInMeters = height / 100;
  return weight / (heightInMeters * heightInMeters);
}

/**
 * Рассчитывает площадь поверхности тела (ППТ) по формуле Мостеллера
 */
function calculateBSA(weight, height) {
  if (weight <= 0 || height <= 0) {
    throw new Error('Вес и рост должны быть положительными числами');
  }
  
  return Math.sqrt((weight * height) / 3600);
}

/**
 * Определяет категорию ИМТ для детей
 */
function getBMICategory(bmi, ageMonths) {
  if (ageMonths < 24) {
    if (bmi < 14) return 'underweight';
    if (bmi < 18) return 'normal';
    if (bmi < 20) return 'overweight';
    return 'obese';
  }
  
  if (bmi < 16) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/**
 * Валидирует значения роста и веса
 */
function validateAnthropometry(weight, height) {
  if (weight === null && height === null) {
    return { valid: true };
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

module.exports = {
  calculateBMI,
  calculateBSA,
  getBMICategory,
  validateAnthropometry
};
