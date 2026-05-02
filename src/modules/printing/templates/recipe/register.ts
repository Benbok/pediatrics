import { templateRegistry } from '../../registry';
import { Recipe107Form } from './Recipe107Form';
import { isRecipe107PrintData } from './types';
import { recipe107Styles } from './Recipe107Form.styles';
import { PrintTemplate } from '../../types';
import { logger } from '../../../../services/logger';
import type { Recipe107PrintData } from './types';

/**
 * Регистрация шаблона рецептурного бланка 107-1/у
 */
const recipe107Template: PrintTemplate<Recipe107PrintData> = {
    id: 'recipe-107',
    name: 'Рецептурный бланк 107-1/у',
    description: 'Форма рецептурного бланка 107-1/у (Приказ МЗ РФ № 1094н от 24.11.2021). До 3 назначений на странице.',
    category: 'medical',
    component: Recipe107Form,
    styles: recipe107Styles,
    defaultOptions: {
        orientation: 'landscape',
        pageSize: 'A4',
        margins: {
            top: 8,
            right: 10,
            bottom: 10,
            left: 10,
        },
        showHeader: false,
        showFooter: false,
    },
    validateData: isRecipe107PrintData,
    icon: '📝',
};

templateRegistry.register(recipe107Template);

logger.info('[Recipe Template] Template recipe-107 registered successfully');

export default recipe107Template;
