import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Medication, MedicationListItem } from '../../../types';
import { Pill, Beaker, Star } from 'lucide-react';
import { medicationService } from '../services/medicationService';
import { logger } from '../../../services/logger';
import { sanitizeDisplayText } from '../../../utils/textSanitizers';

interface MedicationCardProps {
    medication: Medication | MedicationListItem;
    onSelect: (id: number) => void;
    onFavoriteToggle?: () => void;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({ medication, onSelect, onFavoriteToggle }) => {
    const medicationId = medication.id;

    const medicationName = React.useMemo(() => {
        return sanitizeDisplayText(medication.nameRu);
    }, [medication.nameRu]);

    const handleToggleFavorite = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!medicationId) {
            return;
        }

        try {
            await medicationService.toggleFavorite(medicationId);
            if (onFavoriteToggle) {
                onFavoriteToggle();
            }
        } catch (error) {
            logger.error('[MedicationCard] Failed to toggle favorite', { error, medicationId });
        }
    };

    // Формируем строку с формами выпуска
    const formsDisplay = React.useMemo(() => {
        // Сначала пробуем структурированные данные forms
        if (medication.forms && Array.isArray(medication.forms) && medication.forms.length > 0) {
            return medication.forms
                .slice(0, 3) // Показываем максимум 3 формы
                .map(form => {
                    const typeMap: Record<string, string> = {
                        tablet: 'Таблетки',
                        solution: 'Раствор',
                        syrup: 'Сироп',
                        suspension: 'Суспензия',
                        injection: 'Инъекция',
                        capsule: 'Капсулы',
                        suppository: 'Свечи',
                        powder: 'Порошок',
                        drops: 'Капли',
                        cream: 'Крем',
                        ointment: 'Мазь'
                    };
                    
                    const typeName = typeMap[form.type] || form.type || 'Форма';
                    const concentration = form.concentration ? ` ${form.concentration}` : '';
                    return `${typeName}${concentration}`;
                })
                .join(', ') + (medication.forms.length > 3 ? '...' : '');
        }
        
        // Fallback на текстовое описание packageDescription
        if (medication.packageDescription && medication.packageDescription.trim()) {
            return medication.packageDescription.length > 100 
                ? medication.packageDescription.substring(0, 100) + '...' 
                : medication.packageDescription;
        }
        
        return 'Формы выпуска не указаны';
    }, [medication.forms, medication.packageDescription]);

    const clinicalGroupLabel = React.useMemo(() => {
        return sanitizeDisplayText(medication.clinicalPharmGroup);
    }, [medication.clinicalPharmGroup]);

    return (
        <Card
            className="p-4 hover:border-primary-500 transition-colors cursor-pointer group"
            onClick={() => medicationId && onSelect(medicationId)}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                            {medicationName}
                        </h3>
                        {medication.isFavorite && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                        {medication.isOtc && (
                            <Badge variant="success" size="sm">OTC</Badge>
                        )}
                    </div>

                    {clinicalGroupLabel && (
                        <div className="text-xs text-primary-600 dark:text-primary-400 font-medium mb-1">
                            {clinicalGroupLabel}
                        </div>
                    )}

                    <div className="flex items-center gap-1 text-sm text-slate-500 mb-2">
                        <Beaker className="w-3.5 h-3.5 text-primary-500" />
                        <span className="font-medium">{medication.activeSubstance}</span>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                        {formsDisplay}
                    </div>
                </div>

                <div className="flex flex-col items-center gap-2 ml-4 self-center">
                    <button
                        onClick={handleToggleFavorite}
                        className={`p-2 rounded-lg transition-colors ${
                            medication.isFavorite 
                                ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' 
                                : 'text-slate-400 hover:text-yellow-500 hover:bg-yellow-50/50'
                        }`}
                    >
                        <Star className={`w-5 h-5 ${medication.isFavorite ? 'fill-current' : ''}`} />
                    </button>
                    <div className="p-2.5 bg-secondary-50 dark:bg-secondary-900/20 rounded-xl">
                        <Pill className="w-6 h-6 text-secondary-600 dark:text-secondary-400" />
                    </div>
                </div>
            </div>
        </Card>
    );
};
