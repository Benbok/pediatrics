import { VaccineStatus, PertussisContraindication } from '../../types';
import { VaxRule } from './rules';

/**
 * DTP (Diphtheria, Tetanus, Pertussis) Rules
 * Standard: 3m, 4.5m, 6m, 18m (RV1)
 * Catch-up: 4 week intervals.
 * 
 * SPECIAL RULES:
 * 1. RV1 (4th dose) must be >= 12 months after V3.
 * 2. Absolute Contraindications to Pertussis:
 *    - Progressive neuro diseases
 *    - Afebrile seizures
 *    - Post-vax encephalopathy
 *    -> Switch to ADS-M / ADS.
 * 3. Age Restriction: After 4-6 years, use Adacel or ADS-M (no standard DTP).
 */
export const dtpRules: VaxRule = (vaccine, context) => {
    const { ageInMonths, profile, records, today } = context;
    const id = vaccine.id;

    if (!id.startsWith('dtp')) return null;
    if (vaccine.userRecord?.isCompleted) return null;

    const hasContraindication = (profile?.pertussisContraindications?.length ?? 0) > 0;
    const isOver6Years = ageInMonths >= 72; // 6 years threshold

    // Status Downgrade Logic (Absolute Contraindications)
    if (hasContraindication) {
        return {
            alertMessage: "ВНИМАНИЕ: Коклюшный компонент противопоказан (неврология/судороги). Рекомендуется вакцина АДС-М или АДС.",
            // We don't change status to SKIPPED because they still need Diphtheria/Tetanus
        };
    }

    // Age restriction for V1-V3/RV1
    if (isOver6Years && (id === 'dtp-1' || id === 'dtp-2' || id === 'dtp-3' || id === 'dtp-rv1')) {
        return {
            status: VaccineStatus.SKIPPED,
            alertMessage: "Стандартная АКДС после 6 лет не вводится. Используйте Адасель или АДС-М."
        };
    }

    // RV1 Validation (min 12 months after V3)
    if (id === 'dtp-rv1') {
        const v3Record = records.find(r => r.vaccineId === 'dtp-3');
        if (v3Record?.isCompleted && v3Record.completedDate) {
            const v3Date = new Date(v3Record.completedDate);
            const minRV1Date = new Date(v3Date);
            minRV1Date.setFullYear(minRV1Date.getFullYear() + 1);

            if (today < minRV1Date) {
                return {
                    status: VaccineStatus.PLANNED,
                    dueDate: minRV1Date,
                    alertMessage: "Ревакцинация RV1 проводится строго через 12 месяцев после 3-й дозы."
                };
            }
        }
    }

    return null;
};
