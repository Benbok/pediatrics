export const getRotavirusRiskFactorLabel = (factor: string): string => {
    switch (factor) {
        case 'rota-intussusception': return 'Инвагинация кишечника в анамнезе (Абсолютное противопоказание)';
        case 'rota-gi-malformation': return 'Пороки развития ЖКТ (Абсолютное противопоказание)';
        case 'rota-scid': return 'Тяжелый комбинированный иммунодефицит (SCID)';
        default: return factor;
    }
};
