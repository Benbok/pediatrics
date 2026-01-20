/**
 * Diluent types for medication dilution
 * Single source of truth for diluent options
 */

export type DiluentType = 
    | 'nacl_0_9'      // NaCl 0.9%
    | 'glucose_5'     // Glucose 5%
    | 'glucose_10'    // Glucose 10%
    | 'water_inj';    // Water for injection

/**
 * Human-readable labels for diluent types
 */
export const DILUENT_LABELS: Record<DiluentType, string> = {
    nacl_0_9: 'NaCl 0.9%',
    glucose_5: 'Glucose 5%',
    glucose_10: 'Glucose 10%',
    water_inj: 'Вода для инъекций',
};

/**
 * Get human-readable label for diluent
 */
export function getDiluentLabel(diluent: DiluentType | null | undefined): string {
    if (!diluent) return '';
    return DILUENT_LABELS[diluent] || diluent;
}
