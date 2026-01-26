import React from 'react';
import { Input } from '../../../../components/ui/Input';
import { Dna } from 'lucide-react';
import { HeredityData } from '../../../../types';

interface HereditySectionProps {
    data: HeredityData | null;
    onChange: (data: HeredityData) => void;
}

export const HereditySection: React.FC<HereditySectionProps> = ({ data, onChange }) => {
    const heredityData: HeredityData = data || {
        tuberculosis: false,
        diabetes: false,
        hypertension: false,
        oncology: false,
        allergies: false,
        other: null,
    };

    const handleCheckboxChange = (field: keyof HeredityData, value: boolean) => {
        onChange({
            ...heredityData,
            [field]: value,
        });
    };

    const handleOtherChange = (value: string) => {
        onChange({
            ...heredityData,
            other: value || null,
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
                <Dna className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Наследственность
                </h4>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                        type="checkbox"
                        checked={heredityData.tuberculosis}
                        onChange={(e) => handleCheckboxChange('tuberculosis', e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Туберкулез</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                        type="checkbox"
                        checked={heredityData.diabetes}
                        onChange={(e) => handleCheckboxChange('diabetes', e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Диабет</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                        type="checkbox"
                        checked={heredityData.hypertension}
                        onChange={(e) => handleCheckboxChange('hypertension', e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Гипертоническая болезнь</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                        type="checkbox"
                        checked={heredityData.oncology}
                        onChange={(e) => handleCheckboxChange('oncology', e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Онкологические заболевания</span>
                </label>

                <label className="flex items-center gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
                    <input
                        type="checkbox"
                        checked={heredityData.allergies}
                        onChange={(e) => handleCheckboxChange('allergies', e.target.checked)}
                        className="w-4 h-4 text-primary-600 rounded border-slate-300 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">Аллергические заболевания</span>
                </label>
            </div>

            <div className="mt-3">
                <Input
                    label="Прочие"
                    value={heredityData.other || ''}
                    onChange={(e) => handleOtherChange(e.target.value)}
                    placeholder="Другие наследственные заболевания..."
                    className="w-full"
                />
            </div>
        </div>
    );
};
