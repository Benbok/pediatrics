import { MMRContraindication } from '../types';

/**
 * Get human-readable label for MMR contraindications
 */
export const getMMRContraindicationLabel = (factor: MMRContraindication): string => {
    switch (factor) {
        case MMRContraindication.EGG_ALLERGY_SEVERE:
            return 'Тяжелая аллергия (анафилаксия) на яичный белок';
        case MMRContraindication.NEOMYCIN_ALLERGY:
            return 'Аллергия на аминогликозиды (неомицин)';
        case MMRContraindication.IMMUNOSUPPRESSION:
            return 'Первичный иммунодефицит или тяжелая иммуносупрессия';
        case MMRContraindication.PREGNANCY:
            return 'Беременность (для пациенток детородного возраста)';
        case MMRContraindication.BLOOD_PRODUCTS_RECENT:
            return 'Недавнее введение препаратов крови или ИГ (менее 3-11 мес)';
        default:
            return factor;
    }
};
