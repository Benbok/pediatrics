import { VaxRule } from './rules';

/**
 * Hepatitis B Logic
 * Handles filtering of schedule based on risk factors.
 * (Note: The core filtering happens in the engine orchestrator, 
 * this module can handle specific alerts or HBIG reminders).
 */
export const hepatitisBRules: VaxRule = (vaccine, context) => {
    if (!vaccine.id.startsWith('hepb')) return null;

    const { profile } = context;
    const isRiskGroup = profile.hepBRiskFactors && profile.hepBRiskFactors.length > 0;

    // Logic for filtering is already done via requiredRiskFactor/excludedRiskFactor in constants
    // But we can add specific warnings here if needed

    return null;
};
