import { templateRegistry } from '../../registry';
import { VaccinationCertificate } from './VaccinationCertificate';
import { VaccinationCertificateData, isVaccinationCertificateData } from './types';
import { PrintTemplate } from '../../types';

/**
 * Регистрация шаблона сертификата прививок
 */
const vaccinationCertificateTemplate: PrintTemplate<VaccinationCertificateData> = {
    id: 'vaccination-certificate',
    name: 'Сертификат профилактических прививок',
    description: 'Официальный сертификат профилактических прививок (Форма № 156/У-93) с выполненными и плановыми прививками',
    category: 'medical',
    component: VaccinationCertificate,
    defaultOptions: {
        orientation: 'landscape',
        pageSize: 'A4',
        margins: {
            top: 20,
            right: 15,
            bottom: 20,
            left: 15,
        },
        showHeader: false,
        showFooter: true,
    },
    validateData: isVaccinationCertificateData,
    icon: '💉',
};

// Регистрируем шаблон
templateRegistry.register(vaccinationCertificateTemplate);

console.log('[Vaccination Template] Template registered successfully');

export default vaccinationCertificateTemplate;
