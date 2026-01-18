import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { medicationService } from '../services/medicationService';

export const FormTypeFilter: React.FC<{
    onFormTypeSelect: (formType: string | null) => void;
}> = ({ onFormTypeSelect }) => {
    const [formTypes, setFormTypes] = useState<string[]>([]);
    const [selectedFormType, setSelectedFormType] = useState<string | null>(null);

    useEffect(() => {
        loadFormTypes();
    }, []);

    const loadFormTypes = async () => {
        try {
            const result = await medicationService.getFormTypes();
            setFormTypes(result);
        } catch (error) {
            console.error('Failed to load form types:', error);
        }
    };

    const handleSelect = (formType: string) => {
        const newFormType = selectedFormType === formType ? null : formType;
        setSelectedFormType(newFormType);
        onFormTypeSelect(newFormType);
    };

    // Маппинг типов форм на русские названия
    const getFormTypeLabel = (type: string) => {
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
            ointment: 'Мазь',
            gel: 'Гель',
            cream: 'Крем',
            spray: 'Спрей',
            patch: 'Пластырь'
        };
        return typeMap[type] || type;
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-600">
                <Filter className="w-4 h-4" />
                Формы выпуска
            </div>
            
            <div className="flex flex-wrap gap-2">
                {formTypes.map(formType => (
                    <button
                        key={formType}
                        onClick={() => handleSelect(formType)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors border ${
                            selectedFormType === formType
                                ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700'
                        }`}
                    >
                        {getFormTypeLabel(formType)}
                    </button>
                ))}
            </div>
        </div>
    );
};
