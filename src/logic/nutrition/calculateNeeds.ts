/**
 * NUTRITION MODULE — Basic Needs Calculation
 *
 * Pure functions with no side-effects or browser/Electron dependencies.
 * All medical norms are passed in as parameters (fetched from DB).
 *
 * Medical sources:
 *   - Национальная программа оптимизации питания детей РФ (2019)
 *   - МР 2.3.1.0253-21 (2021)
 *   - Формула Тура / Зайцевой для 0-10 суток жизни
 */

export interface AgeNorm {
  feedingStage: string;
  ageMinDays: number;
  ageMaxDays: number;
  energyKcalPerKg: number | null;
  fixedEnergyKcal: number | null;
  volumeFactorMin: number | null;
  volumeFactorMax: number | null;
  totalFoodMinG: number | null;
  totalFoodMaxG: number | null;
  mealsPerDay: number;
}

export interface BasicNeedsResult {
  dailyVolumeNeedMl: number | null; // null for 12-36m (use totalFoodG instead)
  dailyEnergyNeedKcal: number;
  mealsPerDay: number;
  totalFoodMinG: number | null;     // for 12-36m
  totalFoodMaxG: number | null;     // for 12-36m
  perMealVolumeMl: number | null;
  feedingStage: string;
  method: 'tur_zaytseva' | 'volumetric' | 'fixed_energy';
}

/**
 * Maximum recommended daily volume for children under 1 year (ml).
 * Clinical guidelines limit intake to prevent overfeeding.
 */
const MAX_DAILY_VOLUME_ML = 1000;

/**
 * Calculate daily volume for the first 10 days of life using
 * Tur formula and Zaytseva formula, returning the maximum of both.
 *
 * Tur formula:
 *   If birthWeight >= 3200g: volume = 80 × dayOfLife
 *   If birthWeight < 3200g:  volume = 70 × dayOfLife
 *
 * Zaytseva formula:
 *   volume = 0.02 × birthWeightG × dayOfLife
 *
 * @param dayOfLife      Current day of life (1-based: born on day 1)
 * @param birthWeightG   Birth weight in grams
 */
export function calcTurZaytsevaDailyVolume(dayOfLife: number, birthWeightG: number): number {
  const turCoefficient = birthWeightG >= 3200 ? 80 : 70;
  const turVolume = turCoefficient * dayOfLife;
  const zaytseva = 0.02 * birthWeightG * dayOfLife;
  return Math.max(turVolume, zaytseva);
}

/**
 * Calculate basic daily nutritional needs for a child based on age, weight,
 * and the age-appropriate norm from the database.
 *
 * @param ageDays       Age in complete days (0 = born today)
 * @param weightKg      Current weight in kg
 * @param norm          Age norm record from NutritionAgeNorm table
 * @param birthWeightG  Birth weight in grams (required only for ageDays <= 10)
 */
export function calcBasicNeeds(
  ageDays: number,
  weightKg: number,
  norm: AgeNorm,
  birthWeightG?: number,
  mealsPerDayOverride?: number,
): BasicNeedsResult {
  let dailyVolumeNeedMl: number | null = null;
  let dailyEnergyNeedKcal: number;
  let method: BasicNeedsResult['method'];

  if (ageDays <= 10) {
    // ——— Stage 0-10 days: Tur / Zaytseva formulas ———
    method = 'tur_zaytseva';
    const dayOfLife = ageDays + 1; // day 1 = born today
    const bwG = birthWeightG ?? 3200; // reasonable fallback if not provided
    dailyVolumeNeedMl = Math.min(
      calcTurZaytsevaDailyVolume(dayOfLife, bwG),
      MAX_DAILY_VOLUME_ML,
    );
    // Caloric method for 0-10d: use medium factor 100 kcal/kg as transitional estimate
    dailyEnergyNeedKcal = weightKg * 100;
  } else if (ageDays < 366) {
    // ——— Stage 10d–12m: volumetric method ———
    method = 'volumetric';
    // Use the midpoint factor of the range for display; actual range shown separately
    const factorMid = norm.volumeFactorMin !== null && norm.volumeFactorMax !== null
      ? (norm.volumeFactorMin + norm.volumeFactorMax) / 2
      : norm.volumeFactorMax ?? norm.volumeFactorMin ?? 0.167;

    dailyVolumeNeedMl = Math.min(weightKg * factorMid * 1000, MAX_DAILY_VOLUME_ML);

    // Caloric method runs in parallel; doctors may use either
    dailyEnergyNeedKcal = norm.energyKcalPerKg !== null
      ? weightKg * norm.energyKcalPerKg
      : weightKg * 110;
  } else {
    // ——— Stage 12-36m: fixed energy by age ———
    method = 'fixed_energy';
    dailyEnergyNeedKcal = norm.fixedEnergyKcal ?? 1200;
    dailyVolumeNeedMl = null; // replaced by totalFoodG range
  }

  const mealsPerDay = mealsPerDayOverride && mealsPerDayOverride > 0
    ? Math.round(mealsPerDayOverride)
    : norm.mealsPerDay;

  const perMealVolumeMl = dailyVolumeNeedMl !== null && mealsPerDay > 0
    ? Math.round(dailyVolumeNeedMl / mealsPerDay)
    : null;

  return {
    dailyVolumeNeedMl: dailyVolumeNeedMl !== null ? Math.round(dailyVolumeNeedMl) : null,
    dailyEnergyNeedKcal: Math.round(dailyEnergyNeedKcal),
    mealsPerDay,
    totalFoodMinG: norm.totalFoodMinG,
    totalFoodMaxG: norm.totalFoodMaxG,
    perMealVolumeMl,
    feedingStage: norm.feedingStage,
    method,
  };
}

/**
 * Volume range for the 10d-12m period (min and max for the UI display).
 * Returns [minMl, maxMl] using the norm's factor range.
 */
export function calcVolumetricRange(
  weightKg: number,
  norm: AgeNorm,
): [number, number] | null {
  if (norm.volumeFactorMin === null || norm.volumeFactorMax === null) return null;
  const minMl = Math.min(Math.round(weightKg * norm.volumeFactorMin * 1000), MAX_DAILY_VOLUME_ML);
  const maxMl = Math.min(Math.round(weightKg * norm.volumeFactorMax * 1000), MAX_DAILY_VOLUME_ML);
  return [minMl, maxMl];
}
