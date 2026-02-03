import { templateRegistry } from '../../registry';
import { VisitForm } from './VisitForm';
import { VisitFormPrintData, isVisitFormPrintData } from './types';
import { PrintTemplate } from '../../types';
import { logger } from '../../../../services/logger';

/**
 * Регистрация шаблона печатной формы приема
 */
const visitFormTemplate: PrintTemplate<VisitFormPrintData> = {
    id: 'visit-form',
    name: 'Форма приёма 025/у-04',
    description: 'Полная форма медицинского приёма с диагнозами, назначениями и рекомендациями',
    category: 'medical',
    component: VisitForm,
    defaultOptions: {
        orientation: 'portrait',
        pageSize: 'A4',
        margins: {
            top: 15,
            right: 15,
            bottom: 15,
            left: 15,
        },
        showHeader: false,
        showFooter: true,
    },
    validateData: isVisitFormPrintData,
    icon: '📋',
};

// Регистрируем шаблон
templateRegistry.register(visitFormTemplate);

logger.info('[Visit Template] Template registered successfully', { templateId: 'visit-form' });

export default visitFormTemplate;
