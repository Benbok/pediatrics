import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Syringe } from 'lucide-react';
import { ChildProfile } from '../../types';
import { patientService } from '../../services/patient.service';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export const PatientDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [child, setChild] = useState<ChildProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    useEffect(() => {
        if (id) {
            loadChild(Number(id));
        }
    }, [id]);

    const loadChild = async (childId: number) => {
        try {
            const data = await patientService.getChildById(childId);
            setChild(data);
        } catch (error) {
            console.error('Failed to load child:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteChild = async () => {
        if (!child || !child.id) return;

        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteChild = async () => {
        if (!child || !child.id) return;

        try {
            await patientService.deleteChild(child.id);
            navigate('/patients');
        } catch (error) {
            console.error('Failed to delete child:', error);
            alert('Не удалось удалить профиль пациента');
        } finally {
            setIsDeleteConfirmOpen(false);
        }
    };

    const getFullName = (child: ChildProfile) => patientService.getFullName(child);
    const getAge = (birthDate: string) => patientService.getAgeLabel(birthDate);

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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header / Patient Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 flex gap-2">
                    <button
                        onClick={() => navigate(`/patients/${child.id}/edit`)}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Редактировать профиль"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                        </svg>
                    </button>
                    <button
                        onClick={handleDeleteChild}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400"
                        title="Удалить профиль"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                        </svg>
                    </button>
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
                    <div className={clsx(
                        "w-24 h-24 rounded-3xl flex items-center justify-center font-bold text-4xl shadow-lg transition-transform",
                        child.gender === 'male'
                            ? "bg-blue-600 text-white shadow-blue-500/20"
                            : "bg-rose-500 text-white shadow-rose-500/20"
                    )}>
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
                            <Syringe className="w-6 h-6" strokeWidth={1.8} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Вакцинация</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            График прививок, планирование, контроль выполнения и медотводы.
                        </p>
                    </div>

                    {/* Visits / CDSS Card */}
                    <div
                        onClick={() => navigate(`/patients/${child.id}/visits`)}
                        className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 cursor-pointer group hover:shadow-xl hover:border-primary-500 transition-all relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-primary-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                        </div>
                        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 text-primary-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75l3 3m0 0l3-3m-3 3v-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">CDSS Приемы</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Интеллектуальная поддержка: анализ жалоб, подбор диагноза и расчет терапии.
                        </p>
                    </div>

                    {/* Nutrition Card */}
                    <div
                        onClick={() => navigate(`/patients/${child.id}/nutrition`)}
                        className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 cursor-pointer group hover:shadow-xl hover:border-emerald-500 transition-all relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-50 group-hover:opacity-100 transition-opacity">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-emerald-500">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                        </div>
                        <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75c-2.071 0-3.75 1.343-3.75 3s1.679 3 3.75 3 3.75 1.343 3.75 3-1.679 3-3.75 3m0-12c1.655 0 3-1.007 3-2.25S13.655 2.25 12 2.25 9 3.257 9 4.5s1.345 2.25 3 2.25zm0 12c-1.655 0-3 1.007-3 2.25s1.345 2.25 3 2.25 3-1.007 3-2.25-1.345-2.25-3-2.25z" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Питание</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                            Расчёт суточной потребности, прикорм 4-12 мес., рацион 1-3 года и история назначений.
                        </p>
                    </div>
                </div>
            </div>

            <ConfirmDialog
                isOpen={isDeleteConfirmOpen}
                title="Удаление пациента"
                message={`Вы уверены, что хотите полностью удалить карточку пациента "${getFullName(child)}"? Это действие необратимо, все данные о прививках будут потеряны.`}
                confirmText="Удалить"
                cancelText="Отмена"
                variant="danger"
                onConfirm={confirmDeleteChild}
                onCancel={() => setIsDeleteConfirmOpen(false)}
            />
        </div>
    );
};
