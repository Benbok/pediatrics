import React from 'react';
import clsx from 'clsx';
import { Input } from '../../../components/ui/Input';
import { DatePicker } from '../../../components/ui/DatePicker';

export interface PatientFormData {
    surname: string;
    name: string;
    patronymic: string;
    birthDate: string;
    gender: 'male' | 'female';
}

interface PatientFormFieldsProps {
    data: PatientFormData;
    onChange: (data: PatientFormData) => void;
}

const formatName = (val: string): string => {
    const cleaned = val.replace(/[^a-zA-Zа-яА-ЯёЁ-]/g, '');
    if (!cleaned) return '';
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
};

export const PatientFormFields: React.FC<PatientFormFieldsProps> = ({ data, onChange }) => {
    const handleNameChange = (field: 'surname' | 'name' | 'patronymic', value: string) => {
        onChange({ ...data, [field]: formatName(value) });
    };

    return (
        <div className="space-y-8">
            {/* Section 1: Basic Info */}
            <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-sm">
                        1
                    </span>
                    Основная информация
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pl-10">
                    <Input
                        label="Фамилия пациента *"
                        required
                        autoFocus
                        value={data.surname}
                        onChange={(e) => handleNameChange('surname', e.target.value)}
                        placeholder="Иванов"
                        className="h-14 bg-slate-50/50 dark:bg-slate-800/50 shadow-none focus:bg-white transition-all"
                    />
                    <Input
                        label="Имя *"
                        required
                        value={data.name}
                        onChange={(e) => handleNameChange('name', e.target.value)}
                        placeholder="Иван"
                        className="h-14 bg-slate-50/50 dark:bg-slate-800/50 shadow-none focus:bg-white transition-all"
                    />
                    <Input
                        label="Отчество"
                        value={data.patronymic}
                        onChange={(e) => handleNameChange('patronymic', e.target.value)}
                        placeholder="Иванович"
                        className="h-14 bg-slate-50/50 dark:bg-slate-800/50 shadow-none focus:bg-white transition-all"
                    />
                </div>
            </div>

            <div className="h-px bg-slate-100 dark:bg-slate-800" />

            {/* Section 2: Birth details */}
            <div className="space-y-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-sm">
                        2
                    </span>
                    Данные о рождении
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pl-10">
                    <DatePicker
                        label="Дата рождения"
                        required
                        value={data.birthDate}
                        onChange={(val) => onChange({ ...data, birthDate: val })}
                        className="h-14 shadow-none bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl focus-within:bg-white transition-all"
                        placement="top"
                    />
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300 ml-1">
                            Пол ребенка *
                        </label>
                        <div className="flex gap-2 h-14 p-1 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => onChange({ ...data, gender: 'male' })}
                                className={clsx(
                                    'flex-1 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2',
                                    data.gender === 'male'
                                        ? 'bg-white dark:bg-slate-900 text-primary-600 shadow-sm border border-slate-100 dark:border-slate-700'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                )}
                            >
                                Мальчик
                            </button>
                            <button
                                type="button"
                                onClick={() => onChange({ ...data, gender: 'female' })}
                                className={clsx(
                                    'flex-1 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2',
                                    data.gender === 'female'
                                        ? 'bg-white dark:bg-slate-900 text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700'
                                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                                )}
                            >
                                Девочка
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
