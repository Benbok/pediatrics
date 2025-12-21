import { PertussisContraindication, VaccinationProfile } from '../types';

/**
 * Get human-readable label for Pertussis contraindications
 */
export const getPertussisContraindicationLabel = (factor: PertussisContraindication): string => {
    switch (factor) {
        case PertussisContraindication.PROGRESSIVE_NEURO:
            return 'Прогрессирующие заболевания нервной системы (эпилепсия и др.)';
        case PertussisContraindication.AFEBRILE_SEIZURES:
            return 'Афебрильные судороги (без температуры) в анамнезе';
        case PertussisContraindication.ENCEPHALOPATHY:
            return 'Энцефалопатия после предыдущей дозы АКДС';
        default:
            return factor;
    }
};

/**
 * Returns specific instructions for DTP vaccination if contraindications exist
 */
export const getPertussisSpecificInstructions = (profile?: VaccinationProfile): string | null => {
    if (!profile?.pertussisContraindications || profile.pertussisContraindications.length === 0) return null;
    return 'ВНИМАНИЕ: У ребенка выявлены противопоказания к коклюшному компоненту. Вместо АКДС следует использовать вакцину без коклюша (АДС или АДС-М).';
};
