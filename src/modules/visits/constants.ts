
// Возрастные нормы пульса (ЧСС в покое)
export interface PulseNorm {
    minAgeMonths: number;
    maxAgeMonths: number;
    min: number;
    max: number;
    average: number;
}

export const PULSE_NORMS: PulseNorm[] = [
    { minAgeMonths: 0, maxAgeMonths: 1, min: 100, max: 180, average: 140 },  // 0-1 мес
    { minAgeMonths: 1, maxAgeMonths: 12, min: 94, max: 160, average: 130 }, // 1-12 мес
    { minAgeMonths: 12, maxAgeMonths: 24, min: 94, max: 154, average: 124 }, // 1-2 года
    { minAgeMonths: 24, maxAgeMonths: 48, min: 90, max: 140, average: 116 }, // 2-4 года
    { minAgeMonths: 48, maxAgeMonths: 72, min: 86, max: 126, average: 108 }, // 4-6 лет
    { minAgeMonths: 72, maxAgeMonths: 96, min: 78, max: 118, average: 98 },  // 6-8 лет
    { minAgeMonths: 96, maxAgeMonths: 120, min: 68, max: 108, average: 88 }, // 8-10 лет
    { minAgeMonths: 120, maxAgeMonths: 144, min: 65, max: 100, average: 82 }, // 10-12 лет
    { minAgeMonths: 144, maxAgeMonths: 180, min: 63, max: 95, average: 79 },  // 12-15 лет
    { minAgeMonths: 180, maxAgeMonths: 216, min: 60, max: 90, average: 75 },  // 15-18 лет
];

// Возрастные нормы артериального давления
export interface BPNorm {
    minAgeMonths: number;
    maxAgeMonths: number;
    sysMin: number;
    sysMax: number;
    diaMin: number;
    diaMax: number;
}

export const BP_NORMS: BPNorm[] = [
    { minAgeMonths: 0, maxAgeMonths: 1, sysMin: 60, sysMax: 90, diaMin: 30, diaMax: 60 },     // 0-1 мес
    { minAgeMonths: 1, maxAgeMonths: 12, sysMin: 80, sysMax: 105, diaMin: 40, diaMax: 70 },   // 1-12 мес
    { minAgeMonths: 12, maxAgeMonths: 24, sysMin: 82, sysMax: 115, diaMin: 50, diaMax: 80 },  // 1-2 года
    { minAgeMonths: 24, maxAgeMonths: 36, sysMin: 85, sysMax: 116, diaMin: 55, diaMax: 80 },  // 2-3 года
    { minAgeMonths: 36, maxAgeMonths: 48, sysMin: 90, sysMax: 118, diaMin: 55, diaMax: 80 },  // 3-4 года
    { minAgeMonths: 48, maxAgeMonths: 60, sysMin: 95, sysMax: 120, diaMin: 60, diaMax: 80 },  // 4-5 лет
    { minAgeMonths: 60, maxAgeMonths: 72, sysMin: 100, sysMax: 122, diaMin: 60, diaMax: 82 }, // 5-6 лет
    { minAgeMonths: 72, maxAgeMonths: 84, sysMin: 102, sysMax: 125, diaMin: 62, diaMax: 84 }, // 6-7 лет
    { minAgeMonths: 84, maxAgeMonths: 96, sysMin: 105, sysMax: 127, diaMin: 65, diaMax: 85 }, // 7-8 лет
    { minAgeMonths: 96, maxAgeMonths: 108, sysMin: 108, sysMax: 130, diaMin: 67, diaMax: 87 }, // 8-9 лет
    { minAgeMonths: 108, maxAgeMonths: 120, sysMin: 110, sysMax: 132, diaMin: 68, diaMax: 88 }, // 9-10 лет
    { minAgeMonths: 120, maxAgeMonths: 132, sysMin: 112, sysMax: 135, diaMin: 70, diaMax: 90 }, // 10-11 лет
    { minAgeMonths: 132, maxAgeMonths: 144, sysMin: 115, sysMax: 138, diaMin: 72, diaMax: 91 }, // 11-12 лет
    { minAgeMonths: 144, maxAgeMonths: 156, sysMin: 117, sysMax: 140, diaMin: 74, diaMax: 93 }, // 12-13 лет
    { minAgeMonths: 156, maxAgeMonths: 168, sysMin: 120, sysMax: 142, diaMin: 76, diaMax: 95 }, // 13-14 лет
    { minAgeMonths: 168, maxAgeMonths: 180, sysMin: 122, sysMax: 145, diaMin: 78, diaMax: 97 }, // 14-15 лет
    { minAgeMonths: 180, maxAgeMonths: 192, sysMin: 125, sysMax: 147, diaMin: 80, diaMax: 98 }, // 15-16 лет
    { minAgeMonths: 192, maxAgeMonths: 204, sysMin: 127, sysMax: 150, diaMin: 82, diaMax: 100 }, // 16-17 лет
    { minAgeMonths: 204, maxAgeMonths: 216, sysMin: 130, sysMax: 152, diaMin: 85, diaMax: 102 }, // 17-18 лет
];

// Вспомогательные функции для получения норм по возрасту
export const getPulseNormByAge = (ageMonths: number | undefined | null): PulseNorm | null => {
    if (ageMonths === undefined || ageMonths === null) return null;
    return PULSE_NORMS.find(norm => ageMonths >= norm.minAgeMonths && ageMonths < norm.maxAgeMonths) || null;
};

export const getBPNormByAge = (ageMonths: number | undefined | null): BPNorm | null => {
    if (ageMonths === undefined || ageMonths === null) return null;
    return BP_NORMS.find(norm => ageMonths >= norm.minAgeMonths && ageMonths < norm.maxAgeMonths) || null;
};

/** Случайное целое в диапазоне [min, max] включительно */
function randomIntInclusive(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Случайное число с одним знаком после запятой в [min, max] */
function randomFloat1(min: number, max: number): number {
    return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

/** Диапазон ЧДД (мин–макс в минуту) по возрасту */
function getRespiratoryRateRange(ageMonths: number): { min: number; max: number } {
    if (ageMonths < 12) return { min: 30, max: 60 };
    if (ageMonths < 24) return { min: 24, max: 40 };
    if (ageMonths < 60) return { min: 22, max: 34 };
    if (ageMonths < 120) return { min: 18, max: 30 };
    return { min: 16, max: 24 };
}

/** Значения показателей жизнедеятельности в норме по возрасту (для подстановки по кнопке "Норма") */
export interface DefaultVitals {
    bloodPressureSystolic: number | null;
    bloodPressureDiastolic: number | null;
    pulse: number | null;
    temperature: number;
    respiratoryRate: number | null;
    oxygenSaturation: number;
}

const TEMP_NORM_MIN = 36.2;
const TEMP_NORM_MAX = 36.9;
const SPO2_NORM_MIN = 96;
const SPO2_NORM_MAX = 100;

/** Средние значения в норме (для обратной совместимости) */
export function getDefaultVitalsForAge(ageMonths: number | undefined | null): DefaultVitals {
    const bpNorm = getBPNormByAge(ageMonths);
    const pulseNorm = getPulseNormByAge(ageMonths);
    const rrRange = ageMonths != null ? getRespiratoryRateRange(ageMonths) : null;

    return {
        bloodPressureSystolic: bpNorm ? Math.round((bpNorm.sysMin + bpNorm.sysMax) / 2) : null,
        bloodPressureDiastolic: bpNorm ? Math.round((bpNorm.diaMin + bpNorm.diaMax) / 2) : null,
        pulse: pulseNorm ? pulseNorm.average : null,
        temperature: (TEMP_NORM_MIN + TEMP_NORM_MAX) / 2,
        respiratoryRate: rrRange ? Math.round((rrRange.min + rrRange.max) / 2) : null,
        oxygenSaturation: Math.round((SPO2_NORM_MIN + SPO2_NORM_MAX) / 2),
    };
}

/** Случайные значения показателей в пределах возрастной нормы (при каждом вызове — новые) */
export function getRandomVitalsInNormForAge(ageMonths: number | undefined | null): DefaultVitals {
    const bpNorm = getBPNormByAge(ageMonths);
    const pulseNorm = getPulseNormByAge(ageMonths);
    const rrRange = ageMonths != null ? getRespiratoryRateRange(ageMonths) : null;

    return {
        bloodPressureSystolic: bpNorm ? randomIntInclusive(bpNorm.sysMin, bpNorm.sysMax) : null,
        bloodPressureDiastolic: bpNorm ? randomIntInclusive(bpNorm.diaMin, bpNorm.diaMax) : null,
        pulse: pulseNorm ? randomIntInclusive(pulseNorm.min, pulseNorm.max) : null,
        temperature: randomFloat1(TEMP_NORM_MIN, TEMP_NORM_MAX),
        respiratoryRate: rrRange ? randomIntInclusive(rrRange.min, rrRange.max) : null,
        oxygenSaturation: randomIntInclusive(SPO2_NORM_MIN, SPO2_NORM_MAX),
    };
}
