import { describe, it, expect } from 'vitest';

function calculateBSA(weightKg: number, heightCm: number): number {
    if (weightKg <= 0 || heightCm <= 0) {
        throw new Error('Вес и рост должны быть положительными числами');
    }
    return Math.sqrt((weightKg * heightCm) / 3600);
}

function calculateDoseForMedication(medication: any, childWeight: number, childAgeMonths: number, childHeight: number | null = null) {
    const dosingRules = Array.isArray(medication.pediatricDosing) ? medication.pediatricDosing : [];
    const forms = Array.isArray(medication.forms) ? medication.forms : [];

    const rule = dosingRules.find((r: any) => {
        const ageMatch = childAgeMonths >= (r.minAgeMonths || 0) && childAgeMonths <= (r.maxAgeMonths || 999);
        const weightMatch = !r.minWeightKg || childWeight >= r.minWeightKg;
        const weightMaxMatch = !r.maxWeightKg || childWeight <= r.maxWeightKg;
        return ageMatch && weightMatch && weightMaxMatch;
    });

    if (!rule) {
        return {
            canUse: false,
            message: 'Нет данных по дозированию для данного возраста и веса'
        };
    }

    let bsa = null;
    if (childHeight && childWeight) {
        try {
            bsa = calculateBSA(childWeight, childHeight);
        } catch (err) {
            // ignore
        }
    }

    let singleDoseMg = null;
    let dailyDoseMg = null;
    let instruction = '';
    let singleDoseMl = null;
    let selectedForm = null;

    if (rule.dosing) {
        const dosing = rule.dosing;

        if (rule.formId) {
            selectedForm = forms.find((form: any) => form.id === rule.formId) || null;
        }

        if (dosing.type === 'weight_based' && dosing.mgPerKg) {
            singleDoseMg = childWeight * dosing.mgPerKg;
            if (dosing.maxMgPerKg) {
                singleDoseMg = Math.min(singleDoseMg, childWeight * dosing.maxMgPerKg);
            }
        } else if (dosing.type === 'bsa_based' && dosing.mgPerM2 && bsa) {
            singleDoseMg = bsa * dosing.mgPerM2;
        } else if (dosing.type === 'fixed' && dosing.fixedDose) {
            if (dosing.fixedDose.unit === 'ml') {
                singleDoseMl = dosing.fixedDose.min || dosing.fixedDose.max || 0;
                if (selectedForm?.mgPerMl) {
                    singleDoseMg = singleDoseMl * selectedForm.mgPerMl;
                }
            } else {
                singleDoseMg = dosing.fixedDose.min || dosing.fixedDose.max || 0;
            }
        } else if (dosing.type === 'age_based' && dosing.ageBasedDose) {
            singleDoseMg = dosing.ageBasedDose.dose;
        }
    } else if (rule.mgPerKg) {
        singleDoseMg = childWeight * rule.mgPerKg;
    }

    if (singleDoseMg !== null) {
        dailyDoseMg = singleDoseMg * (rule.timesPerDay || 1);

        if (rule.maxSingleDose) {
            singleDoseMg = Math.min(singleDoseMg, rule.maxSingleDose);
        }
        if (rule.maxDailyDose) {
            dailyDoseMg = Math.min(dailyDoseMg, rule.maxDailyDose);
        }

        instruction = rule.instruction ||
            (singleDoseMg ? `По ${Math.round(singleDoseMg)}мг ${rule.timesPerDay || 1} раза в день` : 'См. инструкцию');
    } else {
        instruction = rule.instruction || 'См. инструкцию';
    }

    if (!singleDoseMl && selectedForm?.mgPerMl && singleDoseMg) {
        singleDoseMl = singleDoseMg / selectedForm.mgPerMl;
    }

    const warnings: string[] = [];
    if (rule.maxSingleDose && singleDoseMg && singleDoseMg > rule.maxSingleDose) {
        warnings.push(`Превышена максимальная разовая доза (${rule.maxSingleDose}мг)`);
    }
    if (rule.maxDailyDose && dailyDoseMg && dailyDoseMg > rule.maxDailyDose) {
        warnings.push(`Превышена максимальная суточная доза (${rule.maxDailyDose}мг)`);
    }

    return {
        canUse: true,
        singleDoseMg: singleDoseMg ? Math.round(singleDoseMg * 10) / 10 : null,
        singleDoseMl: singleDoseMl ? Math.round(singleDoseMl * 100) / 100 : null,
        dailyDoseMg: dailyDoseMg ? Math.round(dailyDoseMg * 10) / 10 : null,
        timesPerDay: rule.timesPerDay || 1,
        intervalHours: rule.intervalHours || null,
        maxSingleDose: rule.maxSingleDose || null,
        maxDailyDose: rule.maxDailyDose || null,
        routeOfAdmin: rule.routeOfAdmin || medication.routeOfAdmin || null,
        form: selectedForm,
        instruction,
        warnings: warnings.length > 0 ? warnings : null,
        bsa: bsa ? Math.round(bsa * 100) / 100 : null
    };
}

const patients = {
    child3y: { ageMonths: 36, weightKg: 19, heightCm: 110 },
    child4y6m: { ageMonths: 54, weightKg: 22, heightCm: 118 },
    child4m: { ageMonths: 4, weightKg: 7.4, heightCm: 74 }
};

const nurofen = {
    nameRu: 'Нурофен® для детей',
    activeSubstance: 'Ибупрофен',
    forms: [
        {
            id: 'supp_60mg',
            type: 'suppository',
            concentration: '60 мг',
            unit: 'mg',
            strengthMg: 60
        }
    ],
    pediatricDosing: [
        {
            minAgeMonths: 3,
            maxAgeMonths: 9,
            minWeightKg: 6.0,
            maxWeightKg: 8.0,
            formId: 'supp_60mg',
            unit: 'mg',
            dosing: {
                type: 'fixed',
                fixedDose: { min: 60, max: 60, unit: 'mg' }
            },
            routeOfAdmin: 'rectal',
            timesPerDay: 3,
            intervalHours: 6,
            maxSingleDose: 60,
            maxDailyDose: 180,
            instruction: 'Ректально. Детям в возрасте 3-9 месяцев (вес 6-8 кг): по 1 суппозиторию (60 мг) до 3 раз в течение 24 часов. Интервал между приемами 6-8 часов'
        },
        {
            minAgeMonths: 9,
            maxAgeMonths: 24,
            minWeightKg: 8.0,
            maxWeightKg: 12.0,
            formId: 'supp_60mg',
            unit: 'mg',
            dosing: {
                type: 'fixed',
                fixedDose: { min: 60, max: 60, unit: 'mg' }
            },
            routeOfAdmin: 'rectal',
            timesPerDay: 4,
            intervalHours: 6,
            maxSingleDose: 60,
            maxDailyDose: 240,
            instruction: 'Ректально. Детям в возрасте 9 месяцев - 2 года (вес 8-12 кг): по 1 суппозиторию (60 мг) до 4 раз в течение 24 часов. Интервал между приемами не менее 6 часов'
        }
    ]
};

const amikacin = {
    nameRu: 'Амикацин',
    activeSubstance: 'Амикацин',
    forms: [
        {
            id: 'ampoule_500mg_2ml',
            type: 'solution',
            concentration: '250 мг/мл',
            unit: 'ml',
            mgPerMl: 250,
            volumeMl: 2
        }
    ],
    pediatricDosing: [
        {
            minAgeMonths: 0,
            maxAgeMonths: 1,
            formId: 'ampoule_500mg_2ml',
            unit: 'mg',
            dosing: { type: 'weight_based', mgPerKg: 7.5, maxMgPerKg: 10 },
            routeOfAdmin: 'im',
            timesPerDay: 1,
            intervalHours: 24,
            maxSingleDose: null,
            maxDailyDose: 10,
            instruction: 'Недоношенным новорожденным: начальная разовая доза — 10 мг/кг, затем по 7.5 мг/кг каждые 18-24 ч'
        },
        {
            minAgeMonths: 0,
            maxAgeMonths: 72,
            formId: 'ampoule_500mg_2ml',
            unit: 'mg',
            dosing: { type: 'weight_based', mgPerKg: 7.5, maxMgPerKg: 15 },
            routeOfAdmin: 'im',
            timesPerDay: 2,
            intervalHours: 12,
            maxSingleDose: 10,
            maxDailyDose: 15,
            instruction: 'Доношенным новорожденным и детям до 6 лет: начальная доза — 10 мг/кг, затем по 7.5 мг/кг каждые 12 ч'
        },
        {
            minAgeMonths: 72,
            maxAgeMonths: 216,
            formId: 'ampoule_500mg_2ml',
            unit: 'mg',
            dosing: { type: 'weight_based', mgPerKg: 5, maxMgPerKg: 7.5 },
            routeOfAdmin: 'im',
            timesPerDay: 3,
            intervalHours: 8,
            maxSingleDose: null,
            maxDailyDose: 15,
            instruction: 'Детям старше 6 лет: по 5 мг/кг каждые 8 ч или по 7.5 мг/кг каждые 12 ч. Суточная доза не должна превышать 15 мг/кг'
        }
    ]
};

const oseltamivir = {
    nameRu: 'Осельтамивир-ВЕРТЕКС',
    activeSubstance: 'Осельтамивир',
    forms: [
        {
            id: 'capsule_75mg',
            type: 'capsule',
            concentration: '75 мг',
            unit: 'mg',
            strengthMg: 75
        }
    ],
    pediatricDosing: [
        {
            minAgeMonths: 12,
            maxAgeMonths: 144,
            maxWeightKg: 15,
            formId: 'capsule_75mg',
            unit: 'mg',
            dosing: { type: 'fixed', fixedDose: { min: 30, max: 30, unit: 'mg' } },
            routeOfAdmin: 'oral',
            timesPerDay: 2,
            intervalHours: 12,
            maxSingleDose: 30,
            maxDailyDose: 60,
            instruction: 'Для лечения детей от 1 года с массой тела до 15 кг: по 30 мг 2 раза/сут в течение 5 дней.'
        },
        {
            minAgeMonths: 12,
            maxAgeMonths: 144,
            minWeightKg: 15,
            maxWeightKg: 23,
            formId: 'capsule_75mg',
            unit: 'mg',
            dosing: { type: 'fixed', fixedDose: { min: 45, max: 45, unit: 'mg' } },
            routeOfAdmin: 'oral',
            timesPerDay: 2,
            intervalHours: 12,
            maxSingleDose: 45,
            maxDailyDose: 90,
            instruction: 'Для лечения детей от 1 года с массой тела 15-23 кг: по 45 мг 2 раза/сут в течение 5 дней'
        },
        {
            minAgeMonths: 12,
            maxAgeMonths: 144,
            minWeightKg: 23,
            maxWeightKg: 40,
            formId: 'capsule_75mg',
            unit: 'mg',
            dosing: { type: 'fixed', fixedDose: { min: 60, max: 60, unit: 'mg' } },
            routeOfAdmin: 'oral',
            timesPerDay: 2,
            intervalHours: 12,
            maxSingleDose: 60,
            maxDailyDose: 120,
            instruction: 'Для лечения детей от 1 года с массой тела 23-40 кг: по 60 мг 2 раза/сут в течение 5 дней'
        },
        {
            minAgeMonths: 12,
            maxAgeMonths: 216,
            minWeightKg: 40,
            formId: 'capsule_75mg',
            unit: 'mg',
            dosing: { type: 'fixed', fixedDose: { min: 75, max: 75, unit: 'mg' } },
            routeOfAdmin: 'oral',
            timesPerDay: 2,
            intervalHours: 12,
            maxSingleDose: 75,
            maxDailyDose: 150,
            instruction: 'Для лечения детей с массой тела более 40 кг и подростков: по 75 мг 2 раза/сут в течение 5 дней'
        }
    ]
};

describe('Golden dose tests (medication dosing)', () => {
    it('Nurofen: child 4 months 7.4kg', () => {
        const result = calculateDoseForMedication(nurofen, patients.child4m.weightKg, patients.child4m.ageMonths, patients.child4m.heightCm);
        expect(result).toMatchObject({
            canUse: true,
            singleDoseMg: 60,
            dailyDoseMg: 180,
            timesPerDay: 3,
            intervalHours: 6,
            routeOfAdmin: 'rectal'
        });
    });

    it('Nurofen: child 3y and 4.5y should be unsupported', () => {
        const resultA = calculateDoseForMedication(nurofen, patients.child3y.weightKg, patients.child3y.ageMonths, patients.child3y.heightCm);
        const resultB = calculateDoseForMedication(nurofen, patients.child4y6m.weightKg, patients.child4y6m.ageMonths, patients.child4y6m.heightCm);
        expect(resultA.canUse).toBe(false);
        expect(resultB.canUse).toBe(false);
    });

    it('Amikacin: child 4 months 7.4kg', () => {
        const result = calculateDoseForMedication(amikacin, patients.child4m.weightKg, patients.child4m.ageMonths, patients.child4m.heightCm);
        expect(result).toMatchObject({
            canUse: true,
            singleDoseMg: 10,
            singleDoseMl: 0.04,
            dailyDoseMg: 15,
            timesPerDay: 2,
            intervalHours: 12
        });
        expect(result.warnings).toBeNull();
    });

    it('Amikacin: child 3y 19kg', () => {
        const result = calculateDoseForMedication(amikacin, patients.child3y.weightKg, patients.child3y.ageMonths, patients.child3y.heightCm);
        expect(result).toMatchObject({
            canUse: true,
            singleDoseMg: 10,
            singleDoseMl: 0.04,
            dailyDoseMg: 15,
            timesPerDay: 2,
            intervalHours: 12
        });
        expect(result.warnings).toBeNull();
    });

    it('Amikacin: child 4.5y 22kg', () => {
        const result = calculateDoseForMedication(amikacin, patients.child4y6m.weightKg, patients.child4y6m.ageMonths, patients.child4y6m.heightCm);
        expect(result).toMatchObject({
            canUse: true,
            singleDoseMg: 10,
            singleDoseMl: 0.04,
            dailyDoseMg: 15,
            timesPerDay: 2,
            intervalHours: 12
        });
        expect(result.warnings).toBeNull();
    });

    it('Oseltamivir: child 3y 19kg', () => {
        const result = calculateDoseForMedication(oseltamivir, patients.child3y.weightKg, patients.child3y.ageMonths, patients.child3y.heightCm);
        expect(result).toMatchObject({
            canUse: true,
            singleDoseMg: 45,
            dailyDoseMg: 90,
            timesPerDay: 2,
            intervalHours: 12,
            routeOfAdmin: 'oral'
        });
    });

    it('Oseltamivir: child 4.5y 22kg', () => {
        const result = calculateDoseForMedication(oseltamivir, patients.child4y6m.weightKg, patients.child4y6m.ageMonths, patients.child4y6m.heightCm);
        expect(result).toMatchObject({
            canUse: true,
            singleDoseMg: 45,
            dailyDoseMg: 90,
            timesPerDay: 2,
            intervalHours: 12,
            routeOfAdmin: 'oral'
        });
    });

    it('Oseltamivir: child 4 months should be unsupported', () => {
        const result = calculateDoseForMedication(oseltamivir, patients.child4m.weightKg, patients.child4m.ageMonths, patients.child4m.heightCm);
        expect(result.canUse).toBe(false);
    });

    it('when multiple rules match, first rule in array is applied (backend returns matchingRuleIndices and supports ruleIndex)', () => {
        const medicationTwoMatchingRules = {
            nameRu: 'Test',
            pediatricDosing: [
                {
                    minAgeMonths: 12,
                    maxAgeMonths: 144,
                    dosing: { type: 'weight_based' as const, mgPerKg: 10 },
                    timesPerDay: 2,
                    instruction: 'First rule 10 mg/kg'
                },
                {
                    minAgeMonths: 12,
                    maxAgeMonths: 144,
                    dosing: { type: 'weight_based' as const, mgPerKg: 12 },
                    timesPerDay: 2,
                    instruction: 'Second rule 12 mg/kg'
                }
            ]
        };
        const weight = 20;
        const ageMonths = 36;
        const result = calculateDoseForMedication(medicationTwoMatchingRules, weight, ageMonths, null);
        expect(result.canUse).toBe(true);
        expect(result.singleDoseMg).toBe(200);
        expect(result.instruction).toContain('First rule');
    });
});
