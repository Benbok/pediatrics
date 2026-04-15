import React from 'react';
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
                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Пищевая аллергия на
                    </label>
                    <textarea
                        value={allergyData.food || ''}
                        onChange={(e) => handleChange('food', e.target.value)}
                        placeholder="Укажите пищевые аллергены..."
                        rows={3}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm text-slate-800 dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Лекарственная аллергия на
                    </label>
                    <textarea
                        value={allergyData.medication || ''}
                        onChange={(e) => handleChange('medication', e.target.value)}
                        placeholder="Укажите лекарственные препараты..."
                        rows={3}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm text-slate-800 dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Аллергия на материалы
                    </label>
                    <textarea
                        value={allergyData.materials || ''}
                        onChange={(e) => handleChange('materials', e.target.value)}
                        placeholder="Укажите материалы (латекс, металлы и т.д.)..."
                        rows={3}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm text-slate-800 dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Реакции на укусы насекомых
                    </label>
                    <textarea
                        value={allergyData.insectBites || ''}
                        onChange={(e) => handleChange('insectBites', e.target.value)}
                        placeholder="Опишите реакции на укусы..."
                        rows={3}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm text-slate-800 dark:text-white"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Сезонные аллергии
                    </label>
                    <textarea
                        value={allergyData.seasonal || ''}
                        onChange={(e) => handleChange('seasonal', e.target.value)}
                        placeholder="Укажите сезонные аллергены (пыльца, плесень и т.д.)..."
                        rows={3}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm text-slate-800 dark:text-white"
                    />
                </div>
            </div>
        </div>
    );
};
