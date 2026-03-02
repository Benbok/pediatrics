import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import {
    ArrowLeft,
    Weight,
    AlertCircle,
    Check
} from 'lucide-react';
import { patientService } from '../../services/patient.service';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { DatePicker } from '../../components/ui/DatePicker';

export const CreatePatientPage: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form state
    const [formData, setFormData] = useState({
        surname: '',
        name: '',
        patronymic: '',
        birthDate: '',
        gender: 'male' as 'male' | 'female'
    });

    const formatName = (val: string) => {
        const cleaned = val.replace(/[^a-zA-Zа-яА-ЯёЁ-]/g, '');
        if (!cleaned) return '';
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    };

    const handleNameChange = (field: 'surname' | 'name' | 'patronymic', value: string) => {
        setFormData(prev => ({
            ...prev,
            [field]: formatName(value)
        }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const newChildData = {
            name: formData.name,
            surname: formData.surname,
            patronymic: formData.patronymic || undefined,
            birthDate: formData.birthDate,
            gender: formData.gender,
        };

        try {
            const createdChild = await patientService.createChild(newChildData);
            // Navigate to the new patient's details or back to list
            navigate(`/patients/${createdChild.id}`);
        } catch (err: any) {
            console.error('Failed to create child:', err);
            setError(err.message || 'Произошла ошибка при создании карточки');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
            {/* Header with Back Button */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/patients')}
                    className="h-10 w-10 p-0 rounded-full hover:bg-white dark:hover:bg-slate-800"
                >
                    <ArrowLeft size={24} className="text-slate-400" />
                </Button>
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        Новый пациент
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">
                        Заполните данные для создания медицинской карты
                    </p>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-[32px] p-10 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-800">
                {/* Error Banner */}
                {error && (
                    <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex gap-3 items-center animate-in slide-in-from-top-2">
                        <AlertCircle className="text-red-500 shrink-0" size={20} />
                        <div className="text-red-600 dark:text-red-400 text-sm font-bold">
                            {error}
                        </div>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-10">
                    <div className="space-y-8">
                        {/* Section: Basic Info */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-sm">1</span>
                                Основная информация
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pl-10">
                                <Input
                                    label="Фамилия пациента *"
                                    required
                                    autoFocus
                                    value={formData.surname}
                                    onChange={(e) => handleNameChange('surname', e.target.value)}
                                    placeholder="Иванов"
                                    className="h-14 bg-slate-50/50 dark:bg-slate-800/50 shadow-none focus:bg-white transition-all"
                                />
                                <Input
                                    label="Имя *"
                                    required
                                    value={formData.name}
                                    onChange={(e) => handleNameChange('name', e.target.value)}
                                    placeholder="Иван"
                                    className="h-14 bg-slate-50/50 dark:bg-slate-800/50 shadow-none focus:bg-white transition-all"
                                />
                                <Input
                                    label="Отчество"
                                    value={formData.patronymic}
                                    onChange={(e) => handleNameChange('patronymic', e.target.value)}
                                    placeholder="Иванович"
                                    className="h-14 bg-slate-50/50 dark:bg-slate-800/50 shadow-none focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <div className="h-px bg-slate-100 dark:bg-slate-800" />

                        {/* Section: Details */}
                        <div className="space-y-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <span className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-sm">2</span>
                                Данные о рождении
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pl-10">
                                <DatePicker
                                    label="Дата рождения"
                                    required
                                    value={formData.birthDate}
                                    onChange={(val) => setFormData(prev => ({ ...prev, birthDate: val }))}
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
                                            onClick={() => setFormData(p => ({ ...p, gender: 'male' }))}
                                            className={clsx(
                                                "flex-1 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                                                formData.gender === 'male'
                                                    ? "bg-white dark:bg-slate-900 text-primary-600 shadow-sm border border-slate-100 dark:border-slate-700"
                                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                            )}
                                        >
                                            Мальчик
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, gender: 'female' }))}
                                            className={clsx(
                                                "flex-1 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2",
                                                formData.gender === 'female'
                                                    ? "bg-white dark:bg-slate-900 text-rose-500 shadow-sm border border-slate-100 dark:border-slate-700"
                                                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                                            )}
                                        >
                                            Девочка
                                        </button>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>

                    <div className="pt-6 flex items-center justify-end gap-4 border-t border-slate-100 dark:border-slate-800">
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={() => navigate('/patients')}
                            className="h-12 px-6 font-bold text-slate-500"
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className="h-12 px-8 text-base rounded-2xl shadow-xl shadow-primary-500/20"
                            leftIcon={<Check size={20} className="stroke-[3]" />}
                        >
                            Создать карту
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
