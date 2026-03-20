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
  method: 'zaytseva' | 'volumetric' | 'fixed_energy';
}

/**
 * Maximum recommended daily volume for children under 1 year (ml).
 * Clinical guidelines limit intake to prevent overfeeding.
 */
const MAX_DAILY_VOLUME_ML = 1100;

type LectureInfantProfile = {
  energyKcalPerKg: number;
  volumeFactorMin: number;
  volumeFactorMax: number;
  feedingStage: string;
  mealsPerDay: number;
};

function getLectureInfantProfile(ageDays: number): LectureInfantProfile | null {
  if (ageDays <= 10 || ageDays > 365) return null;

  if (ageDays <= 60) {
    return {
      energyKcalPerKg: 120,
      volumeFactorMin: 0.2,
      volumeFactorMax: 0.2,
      feedingStage: '10d-2m',
      mealsPerDay: 7,
    };
  }

  if (ageDays <= 120) {
    return {
      energyKcalPerKg: ageDays <= 90 ? 120 : 115,
      volumeFactorMin: 1 / 6,
      volumeFactorMax: 1 / 6,
      feedingStage: '2-4m',
      mealsPerDay: 6,
    };
  }

  if (ageDays <= 180) {
    return {
      energyKcalPerKg: 115,
      volumeFactorMin: 1 / 7,
      volumeFactorMax: 1 / 7,
      feedingStage: '4-6m',
      mealsPerDay: 6,
    };
  }

  return {
    energyKcalPerKg: ageDays <= 270 ? 110 : 105,
    volumeFactorMin: 1 / 9,
    volumeFactorMax: 1 / 8,
    feedingStage: '6-12m',
    mealsPerDay: 5,
  };
}

function getLectureToddlerRange(ageDays: number): {
  totalFoodMinG: number;
  totalFoodMaxG: number;
  mealsPerDay: number;
  fixedEnergyKcal: number;
} | null {
  if (ageDays < 366 || ageDays > 1095) return null;

  if (ageDays <= 548) {
    return {
      totalFoodMinG: 1000,
      totalFoodMaxG: 1200,
      mealsPerDay: 5,
      fixedEnergyKcal: 1100,
    };
  }

  return {
    totalFoodMinG: 1200,
    totalFoodMaxG: 1500,
    mealsPerDay: 5,
    fixedEnergyKcal: 1200,
  };
}

function calcZaytsevaDailyVolume(dayOfLife: number, birthWeightG: number): number {
  return 0.02 * birthWeightG * dayOfLife;
}

/**
 * Legacy helper kept for compatibility with earlier tests and docs.
 *
 * For lecture-aligned neonatal calculations, the module now uses the
 * Zaytseva formula directly inside calcBasicNeeds().
 *
 * Zaytseva formula:
 *   volume = 0.02 × birthWeightG × dayOfLife
 *
 * @param dayOfLife      Current day of life (1-based: born on day 1)
 * @param birthWeightG   Birth weight in grams
 */
export function calcTurZaytsevaDailyVolume(dayOfLife: number, birthWeightG: number): number {
  return calcZaytsevaDailyVolume(dayOfLife, birthWeightG);
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
  let feedingStage = norm.feedingStage;
  let totalFoodMinG = norm.totalFoodMinG;
  let totalFoodMaxG = norm.totalFoodMaxG;

  if (ageDays <= 10) {
    // ——— Stage 0-10 days: lecture uses Zaytseva formula ———
    method = 'zaytseva';
    const dayOfLife = ageDays + 1; // day 1 = born today
    const bwG = birthWeightG ?? 3200; // reasonable fallback if not provided
    dailyVolumeNeedMl = Math.min(
      calcZaytsevaDailyVolume(dayOfLife, bwG),
      MAX_DAILY_VOLUME_ML,
    );
    dailyEnergyNeedKcal = weightKg * 120;
    feedingStage = '0-10d';
  } else if (ageDays < 366) {
    // ——— Stage 10d–12m: lecture-based volumetric and caloric tables ———
    method = 'volumetric';
    const lectureProfile = getLectureInfantProfile(ageDays);
    const factorMin = lectureProfile?.volumeFactorMin ?? norm.volumeFactorMin ?? 1 / 6;
    const factorMax = lectureProfile?.volumeFactorMax ?? norm.volumeFactorMax ?? factorMin;
    const factorMid = (factorMin + factorMax) / 2;

    dailyVolumeNeedMl = Math.min(weightKg * factorMid * 1000, MAX_DAILY_VOLUME_ML);
    dailyEnergyNeedKcal = weightKg * (lectureProfile?.energyKcalPerKg ?? norm.energyKcalPerKg ?? 110);
    feedingStage = lectureProfile?.feedingStage ?? norm.feedingStage;
  } else {
    // ——— Stage 12-36m: lecture-based daily food range and 5 meals ———
    method = 'fixed_energy';
    const toddlerRange = getLectureToddlerRange(ageDays);
    dailyEnergyNeedKcal = toddlerRange?.fixedEnergyKcal ?? norm.fixedEnergyKcal ?? 1200;
    dailyVolumeNeedMl = null; // replaced by totalFoodG range
    totalFoodMinG = toddlerRange?.totalFoodMinG ?? norm.totalFoodMinG;
    totalFoodMaxG = toddlerRange?.totalFoodMaxG ?? norm.totalFoodMaxG;
    feedingStage = ageDays <= 548 ? '12-18m' : '18-36m';
  }

  const defaultMealsPerDay = ageDays < 366
    ? getLectureInfantProfile(ageDays)?.mealsPerDay ?? norm.mealsPerDay
    : getLectureToddlerRange(ageDays)?.mealsPerDay ?? norm.mealsPerDay;

  const mealsPerDay = mealsPerDayOverride && mealsPerDayOverride > 0
    ? Math.round(mealsPerDayOverride)
    : defaultMealsPerDay;

  const perMealVolumeMl = dailyVolumeNeedMl !== null && mealsPerDay > 0
    ? Math.round(dailyVolumeNeedMl / mealsPerDay)
    : null;

  return {
    dailyVolumeNeedMl: dailyVolumeNeedMl !== null ? Math.round(dailyVolumeNeedMl) : null,
    dailyEnergyNeedKcal: Math.round(dailyEnergyNeedKcal),
    mealsPerDay,
    totalFoodMinG,
    totalFoodMaxG,
    perMealVolumeMl,
    feedingStage,
    method,
  };
}

/**
 * Volume range for the 10d-12m period (min and max for the UI display).
 * Returns [minMl, maxMl] using the norm's factor range.
 */
export function calcVolumetricRange(
  weightKg: number,
  ageDays: number,
  norm: AgeNorm,
): [number, number] | null {
  const lectureProfile = getLectureInfantProfile(ageDays);
  const factorMin = lectureProfile?.volumeFactorMin ?? norm.volumeFactorMin;
  const factorMax = lectureProfile?.volumeFactorMax ?? norm.volumeFactorMax;
  if (factorMin === null || factorMax === null || factorMin === undefined || factorMax === undefined) return null;
  const minMl = Math.min(Math.round(weightKg * factorMin * 1000), MAX_DAILY_VOLUME_ML);
  const maxMl = Math.min(Math.round(weightKg * factorMax * 1000), MAX_DAILY_VOLUME_ML);
  return [minMl, maxMl];
}
