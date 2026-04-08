/**
 * Medication dose calculation service
 * Pure functions for calculating dilution parameters
 * Business logic layer - isolated from UI components
 */

export interface DilutionInput {
    singleDoseMg: number; // Desired dose for patient
    drugAmountMg: number; // Amount of drug in vial/ampoule (dry or liquid concentrate)
    diluentType: 'nacl_0_9' | 'glucose_5' | 'glucose_10' | 'water_inj';
    diluentVolumeMl: number;
}

export interface DilutionResult {
    concentrationMgPerMl: number;
    volumeToDrawMl: number; // Final volume to draw from prepared solution
}

export interface DilutionCalculationError {
    message: string;
    field?: string;
}

/**
 * Calculate dilution parameters for medication
 * 
 * New Workflow:
 * 1. Calculate concentration = drugAmountMg / diluentVolumeMl
 * 2. Calculate volume to draw = singleDoseMg / concentrationMgPerMl
 * 
 * @param input - Dilution input parameters
 * @returns Calculated dilution result or error
 */
export function calculateDilution(input: DilutionInput): DilutionResult | DilutionCalculationError {
    // Validation
    if (!input.singleDoseMg || input.singleDoseMg <= 0) {
        return {
            message: 'Разовая доза должна быть положительным числом',
            field: 'singleDoseMg'
        };
    }

    if (!input.drugAmountMg || input.drugAmountMg <= 0) {
        return {
            message: 'Количество сухого вещества должно быть положительным числом',
            field: 'drugAmountMg'
        };
    }

    if (!input.diluentVolumeMl || input.diluentVolumeMl <= 0) {
        return {
            message: 'Объем растворителя должен быть положительным числом',
            field: 'diluentVolumeMl'
        };
    }

    // 1. Calculate concentration (mg / ml)
    const concentrationMgPerMl = input.drugAmountMg / input.diluentVolumeMl;

    // 2. Calculate volume to draw (ml)
    // Formula: Desired dose (mg) / Concentration (mg / ml)
    const volumeToDrawMl = input.singleDoseMg / concentrationMgPerMl;

    return {
        concentrationMgPerMl: Math.round(concentrationMgPerMl * 100) / 100, // Round to 2 decimals
        volumeToDrawMl: Math.round(volumeToDrawMl * 100) / 100
    };
}

/**
 * Validate dilution inputs
 */
export function validateDilutionInput(input: Partial<DilutionInput>): DilutionCalculationError | null {
    if (input.singleDoseMg !== undefined && (input.singleDoseMg <= 0 || isNaN(input.singleDoseMg))) {
        return {
            message: 'Разовая доза должна быть положительным числом',
            field: 'singleDoseMg'
        };
    }

    if (input.drugAmountMg !== undefined && (input.drugAmountMg <= 0 || isNaN(input.drugAmountMg))) {
        return {
            message: 'Количество сухого вещества должно быть положительным числом',
            field: 'drugAmountMg'
        };
    }

    if (input.diluentVolumeMl !== undefined && (input.diluentVolumeMl <= 0 || isNaN(input.diluentVolumeMl))) {
        return {
            message: 'Объем растворителя должен быть положительным числом',
            field: 'diluentVolumeMl'
        };
    }

    return null;
}

// ---- Powder reconstitution ----

export interface PowderDilutionInput {
    /** Amount of dry substance in vial (mg) */
    powderVialMg: number;
    /** Volume of solvent added to reconstitute (ml) */
    reconstitutionVolumeMl: number;
    /** Required single dose for patient (mg) */
    singleDoseMg: number;
}

/**
 * Calculate concentration and volume to draw for powder reconstitution.
 *
 * Workflow:
 * 1. concentrationMgPerMl = powderVialMg / reconstitutionVolumeMl
 * 2. volumeToDrawMl = singleDoseMg / concentrationMgPerMl
 */
export function calculatePowderDilution(input: PowderDilutionInput): DilutionResult | DilutionCalculationError {
    if (!input.powderVialMg || input.powderVialMg <= 0) {
        return { message: 'Укажите количество мг в флаконе', field: 'powderVialMg' };
    }
    if (!input.reconstitutionVolumeMl || input.reconstitutionVolumeMl <= 0) {
        return { message: 'Укажите объём растворителя для разведения', field: 'reconstitutionVolumeMl' };
    }
    if (!input.singleDoseMg || input.singleDoseMg <= 0) {
        return { message: 'Укажите разовую дозу пациента', field: 'singleDoseMg' };
    }

    const concentrationMgPerMl = input.powderVialMg / input.reconstitutionVolumeMl;
    const volumeToDrawMl = input.singleDoseMg / concentrationMgPerMl;

    return {
        concentrationMgPerMl: Math.round(concentrationMgPerMl * 100) / 100,
        volumeToDrawMl: Math.round(volumeToDrawMl * 100) / 100,
    };
}
