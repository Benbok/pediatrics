import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Medication } from '../../../types';
import { Pill, Beaker, Star } from 'lucide-react';
import { medicationService } from '../services/medicationService';

interface MedicationCardProps {
    medication: Medication;
    onSelect: (id: number) => void;
    onFavoriteToggle?: () => void;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({ medication, onSelect, onFavoriteToggle }) => {
    const handleToggleFavorite = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (medication.id) {
            try {
                await medicationService.toggleFavorite(medication.id);
                if (onFavoriteToggle) {
                    onFavoriteToggle();
                }
            } catch (error) {
                console.error('Failed to toggle favorite:', error);
            }
        }
    };

    // Формируем строку с формами выпуска
    const formsDisplay = React.useMemo(() => {
        if (!medication.forms || !Array.isArray(medication.forms) || medication.forms.length === 0) {
            return 'Формы выпуска не указаны';
        }
        
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
                    drops: 'Капли'
                };
                
                const typeName = typeMap[form.type] || form.type || 'Форма';
                const concentration = form.concentration ? ` ${form.concentration}` : '';
                return `${typeName}${concentration}`;
            })
            .join(', ') + (medication.forms.length > 3 ? '...' : '');
    }, [medication.forms]);

    return (
        <Card
            className="p-4 hover:border-primary-500 transition-colors cursor-pointer group"
            onClick={() => medication.id && onSelect(medication.id)}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors">
                            {medication.nameRu}
                        </h3>
                        {medication.isFavorite && (
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        )}
                    </div>

                    {medication.clinicalPharmGroup && (
                        <div className="text-xs text-primary-600 dark:text-primary-400 font-medium mb-1">
                            {medication.clinicalPharmGroup}
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
