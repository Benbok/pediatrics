import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChildProfile } from '../../types';
import { useChild } from '../../context/ChildContext';

/**
 * PATIENTS MODULE
 * 
 * Responsibility: Manage ONLY basic patient information
 * - Name (Имя)
 * - Surname (Фамилия)
 * - Patronymic (Отчество)
 * - Birth Date (Дата рождения)
 * - Gender (Пол)
 * 
 * NO VACCINATION LOGIC HERE - completely isolated from vaccination module.
 * No risk factors, no hepatitis B logic.
 */

export const PatientsModule: React.FC = () => {
    const navigate = useNavigate();
    const { setSelectedChild } = useChild();
    const [children, setChildren] = useState<ChildProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    // Form state for validation
    const [formData, setFormData] = useState({
        surname: '',
        name: '',
        patronymic: '',
        birthDate: '',
        birthWeight: '',
        gender: 'male' as 'male' | 'female'
    });

    const formatName = (val: string) => {
        // Remove spaces and numbers, keep only letters and hyphens
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

    useEffect(() => {
        loadChildren();
    }, []);

    const loadChildren = async () => {
        try {
            const data = await window.electronAPI.getChildren();
            setChildren(data);
        } catch (error) {
            console.error('Failed to load children:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectPatient = (child: ChildProfile) => {
        setSelectedChild(child); // For UI convenience only
        navigate(`/vaccination/${child.id}`); // Module isolation: pass data via URL
    };

    const handleAddChild = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const newChild: ChildProfile = {
            name: formData.name,
            surname: formData.surname,
            patronymic: formData.patronymic,
            birthDate: formData.birthDate,
            birthWeight: parseInt(formData.birthWeight) || 0,
            gender: formData.gender,
        };

        try {
            await window.electronAPI.createChild(newChild);
            setIsAddModalOpen(false);
            setFormData({
                surname: '',
                name: '',
                patronymic: '',
                birthDate: '',
                birthWeight: '',
                gender: 'male'
            });
            loadChildren();
        } catch (error) {
            console.error('Failed to create child:', error);
        }
    };

    const getFullName = (child: ChildProfile) => {
        return [child.surname, child.name, child.patronymic].filter(Boolean).join(' ');
    };

    const getAge = (birthDate: string) => {
        const birth = new Date(birthDate);
        const today = new Date();
        const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();

        if (months < 12) {
            return `${months} мес`;
        }
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        return remainingMonths > 0 ? `${years} г ${remainingMonths} мес` : `${years} лет`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-slate-500 font-medium">Загрузка пациентов...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Пациенты</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Управление картотекой пациентов</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 font-bold flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    Добавить пациента
                </button>
            </div>

            {children.length === 0 ? (
                <div className="text-center p-16 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                    <div className="bg-slate-100 dark:bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-slate-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 font-medium">В базе пока нет ни одного пациента</p>
                    <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="text-blue-600 hover:text-blue-700 font-bold bg-blue-50 dark:bg-blue-900/20 px-4 py-2 rounded-lg transition-colors"
                    >
                        Завести первую карточку
                    </button>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {children.map((child) => (
                        <div
                            key={child.id}
                            onClick={() => handleSelectPatient(child)}
                            className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 cursor-pointer transition-all hover:shadow-xl group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-blue-500">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                                </svg>
                            </div>
                            <div className="flex items-start gap-4">
                                <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform duration-300">
                                    {child.surname.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-slate-900 dark:text-white text-lg truncate mb-1">
                                        {getFullName(child)}
                                    </h3>
                                    <div className="space-y-1.5">
                                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                                </svg>
                                            </div>
                                            {new Date(child.birthDate).toLocaleDateString('ru-RU')} ({getAge(child.birthDate)})
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                                </svg>
                                            </div>
                                            {child.gender === 'male' ? 'Мальчик' : 'Девочка'}
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                                            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0a.75.75 0 01-.75-.75V3.75a.75.75 0 011.5 0v15.75a.75.75 0 01-.75.75z" />
                                                </svg>
                                            </div>
                                            Вес: {child.birthWeight} г
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Patient Modal */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-8 border dark:border-slate-800 animate-in zoom-in-95 duration-300">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Новый пациент</h2>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Заполните базовые данные для картотеки</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleAddChild} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                                    Фамилия *
                                </label>
                                <input
                                    name="surname"
                                    required
                                    type="text"
                                    autoFocus
                                    value={formData.surname}
                                    onChange={(e) => handleNameChange('surname', e.target.value)}
                                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                                    placeholder="Напр: Иванов"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                                        Имя *
                                    </label>
                                    <input
                                        name="name"
                                        required
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => handleNameChange('name', e.target.value)}
                                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Иван"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                                        Отчество
                                    </label>
                                    <input
                                        name="patronymic"
                                        type="text"
                                        value={formData.patronymic}
                                        onChange={(e) => handleNameChange('patronymic', e.target.value)}
                                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                                        placeholder="Иванович"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                                        Дата рождения *
                                    </label>
                                    <input
                                        name="birthDate"
                                        required
                                        type="date"
                                        value={formData.birthDate}
                                        onChange={(e) => setFormData(prev => ({ ...prev, birthDate: e.target.value }))}
                                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                                        Пол *
                                    </label>
                                    <select
                                        name="gender"
                                        required
                                        value={formData.gender}
                                        onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as 'male' | 'female' }))}
                                        className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="male">Мальчик</option>
                                        <option value="female">Девочка</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">
                                    Вес при рождении (граммы) *
                                </label>
                                <input
                                    name="birthWeight"
                                    required
                                    type="number"
                                    min="500"
                                    max="6000"
                                    value={formData.birthWeight}
                                    onChange={(e) => setFormData(prev => ({ ...prev, birthWeight: e.target.value }))}
                                    className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-none dark:text-white rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
                                    placeholder="Напр: 3500"
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                                >
                                    Создать карточку
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsAddModalOpen(false)}
                                    className="px-6 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold py-4 rounded-2xl transition-colors hover:bg-slate-200 dark:hover:bg-slate-700 ml-1"
                                >
                                    Отмена
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
