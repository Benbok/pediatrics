import React from 'react';
import { Input } from '../../../../components/ui/Input';
import { AlertTriangle } from 'lucide-react';
import { AllergyStatusData } from '../../../../types';

interface AllergyStatusSectionProps {
    data: AllergyStatusData | null;
    onChange: (data: AllergyStatusData) => void;
}

export const AllergyStatusSection: React.FC<AllergyStatusSectionProps> = ({ data, onChange }) => {
    const allergyData: AllergyStatusData = data || {};

    const handleChange = (field: keyof AllergyStatusData, value: string) => {
        onChange({
            ...allergyData,
            [field]: value || null,
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Аллергический статус
                </h4>
            </div>

            <div className="space-y-4">
                <Input
                    label="Пищевая аллергия на"
                    value={allergyData.food || ''}
                    onChange={(e) => handleChange('food', e.target.value)}
                    placeholder="Укажите пищевые аллергены..."
                />

                <Input
                    label="Лекарственная аллергия на"
                    value={allergyData.medication || ''}
                    onChange={(e) => handleChange('medication', e.target.value)}
                    placeholder="Укажите лекарственные препараты..."
                />

                <Input
                    label="Аллергия на материалы"
                    value={allergyData.materials || ''}
                    onChange={(e) => handleChange('materials', e.target.value)}
                    placeholder="Укажите материалы (латекс, металлы и т.д.)..."
                />

                <Input
                    label="Реакции на укусы насекомых"
                    value={allergyData.insectBites || ''}
                    onChange={(e) => handleChange('insectBites', e.target.value)}
                    placeholder="Опишите реакции на укусы..."
                />

                <Input
                    label="Сезонные аллергии"
                    value={allergyData.seasonal || ''}
                    onChange={(e) => handleChange('seasonal', e.target.value)}
                    placeholder="Укажите сезонные аллергены (пыльца, плесень и т.д.)..."
                />
            </div>
        </div>
    );
};
