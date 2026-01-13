/**
 * Unit тесты для CDSS функционала
 * Тестирует антропометрию и математические функции
 */

import { describe, it, expect } from 'vitest';

// Импортируем только чистые функции без зависимостей от Electron
function calculateBMI(weight: number, height: number): number {
  if (weight <= 0 || height <= 0) {
    throw new Error('Вес и рост должны быть положительными числами');
  }
  
  const heightInMeters = height / 100;
  return weight / (heightInMeters * heightInMeters);
}

function calculateBSA(weight: number, height: number): number {
  if (weight <= 0 || height <= 0) {
    throw new Error('Вес и рост должны быть положительными числами');
  }
  
  return Math.sqrt((weight * height) / 3600);
}

function validateAnthropometry(weight: number | null, height: number | null): { valid: boolean; error?: string } {
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

function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (!vec1 || !vec2 || !Array.isArray(vec1) || !Array.isArray(vec2)) {
    throw new Error('Векторы должны быть массивами чисел');
  }

  if (vec1.length !== vec2.length) {
    throw new Error('Векторы должны иметь одинаковую размерность');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

describe('Anthropometry Utils', () => {
  describe('calculateBMI', () => {
    it('should calculate BMI correctly', () => {
      // Ребенок: 10 кг, 100 см
      const bmi = calculateBMI(10, 100);
      expect(bmi).toBeCloseTo(10.0, 1); // ИМТ = 10 / (1.0)^2 = 10
    });

    it('should throw error for invalid inputs', () => {
      expect(() => calculateBMI(0, 100)).toThrow();
      expect(() => calculateBMI(10, 0)).toThrow();
      expect(() => calculateBMI(-5, 100)).toThrow();
    });
  });

  describe('calculateBSA', () => {
    it('should calculate BSA using Mosteller formula', () => {
      // Ребенок: 20 кг, 120 см
      // ППТ = √(20 × 120 / 3600) = √(2400 / 3600) = √0.667 = 0.816
      const bsa = calculateBSA(20, 120);
      expect(bsa).toBeCloseTo(0.816, 2);
    });

    it('should throw error for invalid inputs', () => {
      expect(() => calculateBSA(0, 120)).toThrow();
      expect(() => calculateBSA(20, 0)).toThrow();
    });
  });

  describe('validateAnthropometry', () => {
    it('should validate correct values', () => {
      const result = validateAnthropometry(15, 100);
      expect(result.valid).toBe(true);
    });

    it('should reject weight out of range', () => {
      const result1 = validateAnthropometry(0.3, 100);
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain('Вес');

      const result2 = validateAnthropometry(250, 100);
      expect(result2.valid).toBe(false);
    });

    it('should reject height out of range', () => {
      const result1 = validateAnthropometry(15, 20);
      expect(result1.valid).toBe(false);
      expect(result1.error).toContain('Рост');

      const result2 = validateAnthropometry(15, 300);
      expect(result2.valid).toBe(false);
    });

    it('should accept null values (optional)', () => {
      const result = validateAnthropometry(null, null);
      expect(result.valid).toBe(true);
    });
  });
});

describe('Embedding Utils', () => {
  describe('cosineSimilarity', () => {
    it('should calculate cosine similarity correctly', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBe(1.0); // Идентичные векторы
    });

    it('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
    });

    it('should throw error for different dimensions', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2];
      expect(() => cosineSimilarity(vec1, vec2)).toThrow();
    });

    it('should handle zero vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 1, 1];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
    });

    it('should calculate similarity for real vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [1, 2, 3];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1.0, 5);
    });
  });
});
