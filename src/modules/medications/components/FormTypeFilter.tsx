import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { medicationService } from '../services/medicationService';
import { logger } from '../../../services/logger';
import { PrettySelect, type SelectOption } from '../../vaccination/components/PrettySelect';

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
            logger.error('[FormTypeFilter] Failed to load form types', { error });
        }
    };

    const handleSelect = (formType: string) => {
        const normalized = formType || null;
        setSelectedFormType(normalized);
        onFormTypeSelect(normalized);
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

    const selectOptions: Array<SelectOption<string>> = [
        { value: '', label: 'Все формы' },
        ...formTypes.map((formType) => ({
            value: formType,
            label: getFormTypeLabel(formType),
        })),
    ];

    return (
        <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 text-xs font-semibold text-slate-500 shrink-0">
                <Filter className="w-3.5 h-3.5" />
                Форма
            </div>

            <div className="min-w-[220px]">
                <PrettySelect
                    value={selectedFormType ?? ''}
                    onChange={handleSelect}
                    options={selectOptions}
                    buttonClassName="h-10 rounded-xl"
                    panelClassName="max-h-72"
                />
            </div>
        </div>
    );
};
