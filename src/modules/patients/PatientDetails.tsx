import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChildProfile } from '../../types';

export const PatientDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [child, setChild] = useState<ChildProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadChild(Number(id));
        }
    }, [id]);

    const loadChild = async (childId: number) => {
        try {
            const data = await window.electronAPI.getChild(childId);
            setChild(data);
        } catch (error) {
            console.error('Failed to load child:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const getFullName = (child: ChildProfile) => {
        return [child.surname, child.name, child.patronymic].filter(Boolean).join(' ');
    };

    const getAge = (birthDate: string) => {
        const birth = new Date(birthDate);
        const today = new Date();
        const months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();

        if (months < 12) return `${months} мес`;
        const years = Math.floor(months / 12);
        const remainingMonths = months % 12;
        return remainingMonths > 0 ? `${years} г ${remainingMonths} мес` : `${years} лет`;
    };

    if (isLoading) {
        return <div className="flex items-center justify-center p-12 text-slate-500">Загрузка данных...</div>;
    }

    if (!child) {
        return (
            <div className="text-center p-12">
                <h2 className="text-xl font-bold mb-4">Пациент не найден</h2>
                <button onClick={() => navigate('/patients')} className="text-blue-600 hover:underline">
                    Вернуться к списку
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header / Patient Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                    <button
                        onClick={() => navigate('/patients')}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400"
                        title="Назад к списку"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex flex-col md:flex-row gap-6 items-start">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-700 text-white w-24 h-24 rounded-3xl flex items-center justify-center font-bold text-4xl shadow-lg shadow-blue-500/20">
                        {child.surname.charAt(0)}
                    </div>

                    <div className="flex-1 space-y-4">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white leading-tight">
                                {getFullName(child)}
                            </h1>
                            <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 mt-2">
                                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-sm font-medium">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                    </svg>
                                    {new Date(child.birthDate).toLocaleDateString('ru-RU')}
                                </span>
                                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-sm font-medium">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    {getAge(child.birthDate)}
                                </span>
                                <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-sm font-medium">
                                    {child.gender === 'male' ? 'Мальчик' : 'Девочка'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Вес при рождении</div>
                                <div className="font-bold text-slate-900 dark:text-white">{child.birthWeight} г</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modules Grid */}
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    Медицинские модули
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Vaccination Card */}
                    <div
                        onClick={() => navigate(`/vaccination/${child.id}`)}
                        className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 cursor-pointer group hover:shadow-xl hover:border-blue-500 transition-all relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                        </div>
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5h3m-6.75 2.25h10.5a2.25 2.25 0 002.25-2.25v-15a2.25 2.25 0 00-2.25-2.25H6.75A2.25 2.25 0 004.5 4.5v15a2.25 2.25 0 002.25 2.25z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Вакцинация</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            График прививок, планирование, контроль выполнения и медотводы.
                        </p>
                    </div>

                    {/* Placeholder for future modules */}
                    <div className="bg-slate-50 dark:bg-slate-800/20 p-6 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800/50 flex flex-col items-center justify-center text-center opacity-75">
                        <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-400 mb-1">Новый модуль</h3>
                        <p className="text-slate-400 text-xs">Скоро здесь появятся другие разделы</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
