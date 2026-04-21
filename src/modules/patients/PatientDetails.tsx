import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Syringe, UserRound, Pencil, Trash2 } from 'lucide-react';
import { ChildProfile } from '../../types';
import { patientService } from '../../services/patient.service';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { PatientModuleHeader } from '../../components/PatientModuleHeader';
import { logger } from '../../services/logger';

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
            logger.error('[PatientDetails] Failed to load child', { error, childId });
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
            logger.error('[PatientDetails] Failed to delete child', { error, childId: child.id });
            alert('Не удалось удалить профиль пациента');
        } finally {
            setIsDeleteConfirmOpen(false);
        }
    };

    const getFullName = (child: ChildProfile) => patientService.getFullName(child);
    const getAge = (birthDate: string) => patientService.getAgeLabel(birthDate);

    if (isLoading) {
        return (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header skeleton */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm">
                    <div className="flex flex-col md:flex-row gap-6 items-start">
                        <div className="w-24 h-24 rounded-3xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        <div className="flex-1 space-y-3">
                            <div className="h-8 w-64 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
                            <div className="flex gap-2">
                                <div className="h-7 w-28 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-full" />
                                <div className="h-7 w-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-full" />
                                <div className="h-7 w-20 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-full" />
                            </div>
                        </div>
                    </div>
                </div>
                {/* Modules grid skeleton */}
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-44 bg-slate-100 dark:bg-slate-800/50 animate-pulse rounded-3xl" />
                    ))}
                </div>
            </div>
        );
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
            <PatientModuleHeader
                child={child}
                title="Карточка пациента"
                icon={<UserRound className="w-6 h-6 !text-white" strokeWidth={2.5} />}
                iconBgClass={child.gender === 'male' ? 'bg-blue-600' : 'bg-rose-500'}
                iconShadowClass={child.gender === 'male' ? 'shadow-blue-500/25' : 'shadow-rose-500/25'}
                onBack={() => navigate('/patients')}
                badge={
                    <span className="inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
                        {getAge(child.birthDate)}
                    </span>
                }
                actions={
                    <>
                        <button
                            onClick={() => navigate(`/patients/${child.id}/edit`)}
                            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500 hover:text-blue-600"
                            title="Редактировать профиль"
                        >
                            <Pencil className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleDeleteChild}
                            className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition text-slate-500 hover:text-red-600"
                            title="Удалить профиль"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    </>
                }
            />

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
                        style={{ animation: 'slideIn 0.3s ease-out 0s both' }}
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
                        style={{ animation: 'slideIn 0.3s ease-out 0.05s both' }}
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
                        style={{ animation: 'slideIn 0.3s ease-out 0.1s both' }}
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
