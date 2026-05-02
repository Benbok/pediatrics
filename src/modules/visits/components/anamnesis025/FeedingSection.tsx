import React from 'react';
import { Input } from '../../../../components/ui/Input';
import { AutoResizeTextarea } from '../../../../components/ui/AutoResizeTextarea';
import { Baby } from 'lucide-react';
import { FeedingData } from '../../../../types';

interface FeedingSectionProps {
    data: FeedingData | null;
    onChange: (data: FeedingData) => void;
}

export const FeedingSection: React.FC<FeedingSectionProps> = ({ data, onChange }) => {
    const feedingData: FeedingData = data || {};

    const handleChange = (field: keyof FeedingData, value: any) => {
        onChange({
            ...feedingData,
            [field]: value === '' ? null : value,
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
                <Baby className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Вскармливание
                </h4>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Грудное вскармливание
                    </label>
                    <div className="grid grid-cols-3 gap-4">
                        <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                            <input
                                type="radio"
                                name="breastfeeding"
                                checked={feedingData.breastfeeding === 'yes'}
                                onChange={() => handleChange('breastfeeding', 'yes')}
                                className="w-4 h-4 text-primary-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Да</span>
                        </label>
                        <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                            <input
                                type="radio"
                                name="breastfeeding"
                                checked={feedingData.breastfeeding === 'no'}
                                onChange={() => handleChange('breastfeeding', 'no')}
                                className="w-4 h-4 text-primary-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Нет</span>
                        </label>
                        <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                            <input
                                type="radio"
                                name="breastfeeding"
                                checked={feedingData.breastfeeding === 'mixed'}
                                onChange={() => handleChange('breastfeeding', 'mixed')}
                                className="w-4 h-4 text-primary-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">Смешанное</span>
                        </label>
                    </div>
                </div>

                {(feedingData.breastfeeding === 'yes' || feedingData.breastfeeding === 'mixed') && (
                    <div className="grid grid-cols-2 gap-4">
                        <Input
                            label="Длительность: с"
                            value={feedingData.breastfeedingFrom || ''}
                            onChange={(e) => handleChange('breastfeedingFrom', e.target.value)}
                            placeholder="Дата или возраст"
                        />

                        <Input
                            label="по"
                            value={feedingData.breastfeedingTo || ''}
                            onChange={(e) => handleChange('breastfeedingTo', e.target.value)}
                            placeholder="Дата или возраст"
                        />
                    </div>
                )}

                {(feedingData.breastfeeding === 'no' || feedingData.breastfeeding === 'mixed') && (
                    <Input
                        label="Молочная смесь"
                        value={feedingData.formulaName || ''}
                        onChange={(e) => handleChange('formulaName', e.target.value)}
                        placeholder="Название молочной смеси"
                    />
                )}

                <Input
                    label="Прикормы введены в возрасте (месяцев)"
                    type="number"
                    value={feedingData.complementaryFoodAge?.toString() || ''}
                    onChange={(e) => handleChange('complementaryFoodAge', e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="6"
                    min={0}
                    max={24}
                />

                <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        Особенности питания
                    </label>
                    <AutoResizeTextarea
                        value={feedingData.nutritionFeatures || ''}
                        onChange={(e) => handleChange('nutritionFeatures', e.target.value)}
                        placeholder="Опишите особенности питания..."
                        rows={3}
                        className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 outline-none focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 transition-all text-sm text-slate-800 dark:text-white"
                    />
                </div>
            </div>
        </div>
    );
};
