import React from 'react';
import { Card } from '../../../components/ui/Card';
import { Input } from '../../../components/ui/Input';
import { FileText, Heart, AlertCircle, History } from 'lucide-react';
import { Visit } from '../../../types';

interface AnamnesisSectionProps {
    formData: Partial<Visit>;
    onChange: (field: keyof Visit, value: any) => void;
    errors?: Record<string, string>;
}

export const AnamnesisSection: React.FC<AnamnesisSectionProps> = ({
    formData,
    onChange,
    errors = {},
}) => {
    return (
        <Card className="p-6 space-y-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary-100 dark:bg-primary-900/40 rounded-xl">
                    <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                    Анамнез
                </h3>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Анамнез заболевания */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Heart className="w-4 h-4" />
                        Анамнез заболевания
                    </label>
                    <textarea
                        value={formData.diseaseHistory || ''}
                        onChange={(e) => onChange('diseaseHistory', e.target.value)}
                        placeholder="Начало заболевания, развитие симптомов, предшествующее лечение..."
                        rows={4}
                        className={`
                            w-full px-4 py-3 bg-white dark:bg-slate-900 border rounded-xl text-sm
                            transition-all duration-200 placeholder:text-slate-400
                            focus:outline-none focus:ring-4 focus:ring-offset-0
                            ${errors.diseaseHistory
                                ? 'border-red-300 text-red-900 focus:ring-red-500/10 focus:border-red-500'
                                : 'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-primary-500/10 focus:border-primary-500'
                            }
                        `}
                    />
                    {errors.diseaseHistory && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.diseaseHistory}
                        </p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Опишите начало заболевания, динамику развития симптомов, проведенное ранее лечение
                    </p>
                </div>

                {/* Анамнез жизни */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <History className="w-4 h-4" />
                        Анамнез жизни
                    </label>
                    <textarea
                        value={formData.lifeHistory || ''}
                        onChange={(e) => onChange('lifeHistory', e.target.value)}
                        placeholder="Профессия родителей, вредные привычки родителей, наследственность, особенности развития..."
                        rows={4}
                        className={`
                            w-full px-4 py-3 bg-white dark:bg-slate-900 border rounded-xl text-sm
                            transition-all duration-200 placeholder:text-slate-400
                            focus:outline-none focus:ring-4 focus:ring-offset-0
                            ${errors.lifeHistory
                                ? 'border-red-300 text-red-900 focus:ring-red-500/10 focus:border-red-500'
                                : 'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-primary-500/10 focus:border-primary-500'
                            }
                        `}
                    />
                    {errors.lifeHistory && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.lifeHistory}
                        </p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Семейный анамнез, особенности течения беременности и родов, раннего развития
                    </p>
                </div>

                {/* Аллергологический анамнез */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <AlertCircle className="w-4 h-4" />
                        Аллергологический анамнез
                    </label>
                    <textarea
                        value={formData.allergyHistory || ''}
                        onChange={(e) => onChange('allergyHistory', e.target.value)}
                        placeholder="Уточненные аллергические реакции, пищевые аллергии, лекарственная непереносимость..."
                        rows={3}
                        className={`
                            w-full px-4 py-3 bg-white dark:bg-slate-900 border rounded-xl text-sm
                            transition-all duration-200 placeholder:text-slate-400
                            focus:outline-none focus:ring-4 focus:ring-offset-0
                            ${errors.allergyHistory
                                ? 'border-red-300 text-red-900 focus:ring-red-500/10 focus:border-red-500'
                                : 'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-primary-500/10 focus:border-primary-500'
                            }
                        `}
                    />
                    {errors.allergyHistory && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.allergyHistory}
                        </p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Указываются все известные аллергические реакции и непереносимости
                    </p>
                </div>

                {/* Перенесенные заболевания */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <History className="w-4 h-4" />
                        Перенесенные заболевания
                    </label>
                    <textarea
                        value={formData.previousDiseases || ''}
                        onChange={(e) => onChange('previousDiseases', e.target.value)}
                        placeholder="Хронические заболевания, перенесенные операции, тяжелые инфекционные заболевания..."
                        rows={3}
                        className={`
                            w-full px-4 py-3 bg-white dark:bg-slate-900 border rounded-xl text-sm
                            transition-all duration-200 placeholder:text-slate-400
                            focus:outline-none focus:ring-4 focus:ring-offset-0
                            ${errors.previousDiseases
                                ? 'border-red-300 text-red-900 focus:ring-red-500/10 focus:border-red-500'
                                : 'border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-primary-500/10 focus:border-primary-500'
                            }
                        `}
                    />
                    {errors.previousDiseases && (
                        <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {errors.previousDiseases}
                        </p>
                    )}
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        Указываются все значимые перенесенные заболевания и оперативные вмешательства
                    </p>
                </div>
            </div>
        </Card>
    );
};
