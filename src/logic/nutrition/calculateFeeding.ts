/**
 * NUTRITION MODULE — Feeding Type Calculation
 *
 * Implements BF (Breastfeeding), MF (Mixed Feeding), FF (Formula Feeding) scenarios.
 *
 * Medical sources:
 *   - Национальная программа оптимизации питания детей РФ (2019)
 *   - МР 2.3.1.0253-21 (2021)
 */

import type { BasicNeedsResult } from './calculateNeeds';

export type FeedingType = 'BF' | 'MF' | 'FF';

export interface FormulaProduct {
  id: number;
  name: string;
  brand?: string | null;
  energyKcalPer100ml: number | null;
}

export interface BFResult {
  type: 'BF';
  mealsPerDay: number;
  dailyVolumeNeedMl: number | null;
  dailyEnergyNeedKcal: number;
  note: string;
}

export interface MFResult {
  type: 'MF';
  mealsPerDay: number;
  dailyVolumeNeedMl: number | null;
  dailyEnergyNeedKcal: number;
  estimatedBreastMilkMl: number;
  formulaDeficitMl: number;
  formulaPerMealMl: number;
  /** true when breast milk is so low that FF is effectively equivalent */
  switchToFFRecommended: boolean;
}

export interface FFResult {
  type: 'FF';
  mealsPerDay: number;
  dailyVolumeNeedMl: number | null;
  dailyEnergyNeedKcal: number;
  dailyFormulaMl: number;
  perMealFormulaMl: number;
  calculationMethod: 'caloric' | 'volumetric';
  formula: FormulaProduct | null;
}

export type FeedingCalcResult = BFResult | MFResult | FFResult;

/**
 * Threshold below which mixed feeding is reclassified as artificial.
 * Source: clinical guidelines (approx. 150-200 ml/day)
 */
const MIN_BREAST_MILK_FOR_MF_ML = 150;

// ——— Breastfeeding ———

export function calcBreastFeeding(needs: BasicNeedsResult): BFResult {
  return {
    type: 'BF',
    mealsPerDay: needs.mealsPerDay,
    dailyVolumeNeedMl: needs.dailyVolumeNeedMl,
    dailyEnergyNeedKcal: needs.dailyEnergyNeedKcal,
    note: 'Грудное молоко по требованию. Ориентировочный суточный объём указан для контроля.',
  };
}

// ——— Mixed Feeding ———

/**
 * @param needs              Result of calcBasicNeeds()
 * @param estimatedBreastMilkMl  Doctor-assessed breast milk volume per day (ml)
 */
export function calcMixedFeeding(
  needs: BasicNeedsResult,
  estimatedBreastMilkMl: number,
): MFResult {
  const totalNeedMl = needs.dailyVolumeNeedMl ?? 0;
  const deficit = Math.max(totalNeedMl - estimatedBreastMilkMl, 0);
  const perMeal = needs.mealsPerDay > 0 ? Math.round(deficit / needs.mealsPerDay) : 0;
  const switchToFF = estimatedBreastMilkMl < MIN_BREAST_MILK_FOR_MF_ML;

  return {
    type: 'MF',
    mealsPerDay: needs.mealsPerDay,
    dailyVolumeNeedMl: needs.dailyVolumeNeedMl,
    dailyEnergyNeedKcal: needs.dailyEnergyNeedKcal,
    estimatedBreastMilkMl,
    formulaDeficitMl: Math.round(deficit),
    formulaPerMealMl: perMeal,
    switchToFFRecommended: switchToFF,
  };
}

// ——— Formula (Artificial) Feeding ———

/**
 * Calculates required formula volume using selected method.
 *
 * - caloric: based on required kcal and selected formula energy density
 * - volumetric: based on age/weight volumetric need
 * - auto: prefer caloric, but keep volumetric as upper bound for safety
 *
 * @param needs    Result of calcBasicNeeds()
 * @param formula  Formula product from DB (may be null when not yet chosen)
 */
export function calcFormulaFeeding(
  needs: BasicNeedsResult,
  formula: FormulaProduct | null,
  preferredMethod?: FFResult['calculationMethod'],
): FFResult {
  let dailyFormulaMl: number;
  let method: FFResult['calculationMethod'] = 'volumetric';

  const canUseCaloric = Boolean(formula?.energyKcalPer100ml && formula.energyKcalPer100ml > 0);
  const forceVolumetric = preferredMethod === 'volumetric';
  const forceCaloric = preferredMethod === 'caloric';

  if ((forceCaloric || !forceVolumetric) && canUseCaloric) {
    // Caloric method: how much formula to reach the required kcal
    const formulaByKcal = (needs.dailyEnergyNeedKcal / formula.energyKcalPer100ml) * 100;
    if (forceCaloric) {
      // Explicit caloric choice should produce a distinct caloric result.
      dailyFormulaMl = Math.round(formulaByKcal);
    } else {
      // Auto mode: prefer caloric, but do not exceed volumetric benchmark.
      const volumetricCap = needs.dailyVolumeNeedMl ?? 1000;
      dailyFormulaMl = Math.round(Math.min(formulaByKcal, volumetricCap));
    }
    method = 'caloric';
  } else {
    // Fallback: pure volumetric
    dailyFormulaMl = Math.round(needs.dailyVolumeNeedMl ?? 800);
    method = 'volumetric';
  }

  const perMeal = needs.mealsPerDay > 0
    ? Math.round(dailyFormulaMl / needs.mealsPerDay)
    : dailyFormulaMl;

  return {
    type: 'FF',
    mealsPerDay: needs.mealsPerDay,
    dailyVolumeNeedMl: needs.dailyVolumeNeedMl,
    dailyEnergyNeedKcal: needs.dailyEnergyNeedKcal,
    dailyFormulaMl,
    perMealFormulaMl: perMeal,
    calculationMethod: method,
    formula,
  };
}

// ——— Complementary Feeding Gate ———

export type ComplementaryFeedingStatus =
  | 'too_early'        // < 4 months
  | 'window_open'      // 4-6 months — recommended introduction window
  | 'overdue'          // > 6 months (should have started by now)
  | 'active';          // > 6 months + already introduced / fully active

/**
 * Determines complementary feeding readiness status.
 * WHO recommends exclusive breastfeeding for 6 months;
 * Russian clinical guidelines allow introduction from 4 months in special cases.
 *
 * @param ageDays    Child's age in days
 * @param isBF       Whether currently on breastfeeding only
 */
export function getComplementaryFeedingStatus(
  ageDays: number,
  isBF: boolean,
): ComplementaryFeedingStatus {
  if (ageDays < 120) return 'too_early';          // < 4 months
  if (ageDays <= 180) return 'window_open';        // 4-6 months
  if (ageDays <= 240 && isBF) return 'overdue';   // 6-8 months BF only (should have started)
  return 'active';                                  // already in complementary feeding phase
}
