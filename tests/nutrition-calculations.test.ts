import { describe, expect, it } from 'vitest';
import { calcBasicNeeds, calcTurZaytsevaDailyVolume, type AgeNorm } from '../src/logic/nutrition/calculateNeeds';
import { calcFormulaFeeding, calcMixedFeeding, getComplementaryFeedingStatus } from '../src/logic/nutrition/calculateFeeding';

const norm0to10d: AgeNorm = {
  feedingStage: '0_10_days',
  ageMinDays: 0,
  ageMaxDays: 10,
  energyKcalPerKg: 120,
  fixedEnergyKcal: null,
  volumeFactorMin: null,
  volumeFactorMax: null,
  totalFoodMinG: null,
  totalFoodMaxG: null,
  mealsPerDay: 8,
};

const norm10dTo2m: AgeNorm = {
  feedingStage: '10d_2m',
  ageMinDays: 11,
  ageMaxDays: 60,
  energyKcalPerKg: 120,
  fixedEnergyKcal: null,
  volumeFactorMin: 0.2,
  volumeFactorMax: 0.2,
  totalFoodMinG: null,
  totalFoodMaxG: null,
  mealsPerDay: 7,
};

const norm2to4m: AgeNorm = {
  feedingStage: '2_4_months',
  ageMinDays: 61,
  ageMaxDays: 120,
  energyKcalPerKg: 115,
  fixedEnergyKcal: null,
  volumeFactorMin: 0.167,
  volumeFactorMax: 0.167,
  totalFoodMinG: null,
  totalFoodMaxG: null,
  mealsPerDay: 6,
};

const norm4to6m: AgeNorm = {
  feedingStage: '4_6_months',
  ageMinDays: 121,
  ageMaxDays: 180,
  energyKcalPerKg: 115,
  fixedEnergyKcal: null,
  volumeFactorMin: 1 / 7,
  volumeFactorMax: 1 / 7,
  totalFoodMinG: null,
  totalFoodMaxG: null,
  mealsPerDay: 6,
};

const norm1to3y: AgeNorm = {
  feedingStage: '12_36_months',
  ageMinDays: 366,
  ageMaxDays: 1095,
  energyKcalPerKg: null,
  fixedEnergyKcal: 1200,
  volumeFactorMin: null,
  volumeFactorMax: null,
  totalFoodMinG: 1000,
  totalFoodMaxG: 1500,
  mealsPerDay: 5,
};

describe('Nutrition calculations', () => {
  it('keeps Zaytseva helper for neonatal daily volume: bw 3000g day 5 => 300 ml', () => {
    const result = calcTurZaytsevaDailyVolume(5, 3000);
    expect(result).toBe(300);
  });

  it('keeps Zaytseva helper for neonatal daily volume: bw 3500g day 5 => 350 ml', () => {
    const result = calcTurZaytsevaDailyVolume(5, 3500);
    expect(result).toBe(350);
  });

  it('uses 1/5 body weight from 10 days to 2 months', () => {
    const result = calcBasicNeeds(30, 4.5, norm10dTo2m);
    expect(result.dailyVolumeNeedMl).toBe(900);
    expect(result.dailyEnergyNeedKcal).toBe(540);
  });

  it('calculates volumetric need for 2-4 months by 1/6 body weight', () => {
    const result = calcBasicNeeds(90, 5, norm2to4m);
    expect(result.dailyVolumeNeedMl).toBe(833);
    expect(result.method).toBe('volumetric');
    expect(result.dailyEnergyNeedKcal).toBe(600);
  });

  it('switches to 115 kcal/kg after 3 months while keeping 1/6 volume rule', () => {
    const result = calcBasicNeeds(100, 5, norm2to4m);
    expect(result.dailyVolumeNeedMl).toBe(833);
    expect(result.dailyEnergyNeedKcal).toBe(575);
  });

  it('uses 1/7 body weight for 4-6 months', () => {
    const result = calcBasicNeeds(150, 7, norm4to6m);
    expect(result.dailyVolumeNeedMl).toBe(1000);
    expect(result.dailyEnergyNeedKcal).toBe(805);
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

  it('uses Zaytseva branch for 0-10 days in basic needs', () => {
    const result = calcBasicNeeds(4, 3.5, norm0to10d, 3500);
    expect(result.method).toBe('zaytseva');
    expect(result.dailyVolumeNeedMl).toBe(350);
    expect(result.dailyEnergyNeedKcal).toBe(420);
  });

  it('uses 5 meals and age-specific total food range for toddlers', () => {
    const result = calcBasicNeeds(400, 11, norm1to3y);
    expect(result.mealsPerDay).toBe(5);
    expect(result.totalFoodMinG).toBe(1000);
    expect(result.totalFoodMaxG).toBe(1200);
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
