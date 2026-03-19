import { describe, expect, it } from 'vitest';
import { calcBasicNeeds, calcTurZaytsevaDailyVolume, type AgeNorm } from '../src/logic/nutrition/calculateNeeds';
import { calcFormulaFeeding, calcMixedFeeding, getComplementaryFeedingStatus } from '../src/logic/nutrition/calculateFeeding';

const norm0to10d: AgeNorm = {
  feedingStage: '0_10_days',
  ageMinDays: 0,
  ageMaxDays: 10,
  energyKcalPerKg: 100,
  fixedEnergyKcal: null,
  volumeFactorMin: null,
  volumeFactorMax: null,
  totalFoodMinG: null,
  totalFoodMaxG: null,
  mealsPerDay: 8,
};

const norm2to4m: AgeNorm = {
  feedingStage: '2_4_months',
  ageMinDays: 61,
  ageMaxDays: 120,
  energyKcalPerKg: 115,
  fixedEnergyKcal: null,
  volumeFactorMin: 0.143,
  volumeFactorMax: 0.167,
  totalFoodMinG: null,
  totalFoodMaxG: null,
  mealsPerDay: 7,
};

describe('Nutrition calculations', () => {
  it('uses max(Tur, Zaytseva): bw 3000g day 5 => 350 ml', () => {
    const result = calcTurZaytsevaDailyVolume(5, 3000);
    expect(result).toBe(350);
  });

  it('uses max(Tur, Zaytseva): bw 3500g day 5 => 400 ml', () => {
    const result = calcTurZaytsevaDailyVolume(5, 3500);
    expect(result).toBe(400);
  });

  it('calculates volumetric need for 2-4 months by midpoint factor', () => {
    const result = calcBasicNeeds(90, 5, norm2to4m);
    expect(result.dailyVolumeNeedMl).toBe(775);
    expect(result.method).toBe('volumetric');
  });

  it('calculates mixed feeding deficit without FF switch recommendation', () => {
    const needs = {
      dailyVolumeNeedMl: 700,
      dailyEnergyNeedKcal: 600,
      mealsPerDay: 7,
      totalFoodMinG: null,
      totalFoodMaxG: null,
      perMealVolumeMl: 100,
      feedingStage: '2_4_months',
      method: 'volumetric' as const,
    };

    const result = calcMixedFeeding(needs, 400);
    expect(result.formulaDeficitMl).toBe(300);
    expect(result.switchToFFRecommended).toBe(false);
  });

  it('recommends FF switch when breast milk volume below threshold', () => {
    const needs = {
      dailyVolumeNeedMl: 700,
      dailyEnergyNeedKcal: 600,
      mealsPerDay: 7,
      totalFoodMinG: null,
      totalFoodMaxG: null,
      perMealVolumeMl: 100,
      feedingStage: '2_4_months',
      method: 'volumetric' as const,
    };

    const result = calcMixedFeeding(needs, 100);
    expect(result.switchToFFRecommended).toBe(true);
  });

  it('returns complementary feeding status by age window', () => {
    expect(getComplementaryFeedingStatus(90, true)).toBe('too_early');
    expect(getComplementaryFeedingStatus(150, true)).toBe('window_open');
    expect(getComplementaryFeedingStatus(200, false)).toBe('active');
  });

  it('uses Tur/Zaytseva branch for 0-10 days in basic needs', () => {
    const result = calcBasicNeeds(4, 3.5, norm0to10d, 3500);
    expect(result.method).toBe('tur_zaytseva');
    expect(result.dailyVolumeNeedMl).toBe(400);
  });

  it('uses distinct values for explicit caloric vs volumetric formula method', () => {
    const needs = {
      dailyVolumeNeedMl: 750,
      dailyEnergyNeedKcal: 575,
      mealsPerDay: 7,
      totalFoodMinG: null,
      totalFoodMaxG: null,
      perMealVolumeMl: 107,
      feedingStage: '2_4_months',
      method: 'volumetric' as const,
    };

    const formula = {
      id: 1,
      name: 'Test Formula',
      energyKcalPer100ml: 67,
    };

    const caloric = calcFormulaFeeding(needs, formula, 'caloric');
    const volumetric = calcFormulaFeeding(needs, formula, 'volumetric');

    expect(caloric.dailyFormulaMl).toBe(858);
    expect(volumetric.dailyFormulaMl).toBe(750);
    expect(caloric.perMealFormulaMl).toBe(123);
    expect(volumetric.perMealFormulaMl).toBe(107);
    expect(caloric.calculationMethod).toBe('caloric');
    expect(volumetric.calculationMethod).toBe('volumetric');
  });

  it('keeps auto mode capped by volumetric benchmark', () => {
    const needs = {
      dailyVolumeNeedMl: 750,
      dailyEnergyNeedKcal: 575,
      mealsPerDay: 7,
      totalFoodMinG: null,
      totalFoodMaxG: null,
      perMealVolumeMl: 107,
      feedingStage: '2_4_months',
      method: 'volumetric' as const,
    };

    const formula = {
      id: 1,
      name: 'Test Formula',
      energyKcalPer100ml: 67,
    };

    const auto = calcFormulaFeeding(needs, formula);
    expect(auto.dailyFormulaMl).toBe(750);
    expect(auto.calculationMethod).toBe('caloric');
  });
});
