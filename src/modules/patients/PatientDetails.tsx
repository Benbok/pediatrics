import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { ChildProfile } from '../../types';
import { patientService } from '../../services/patient.service';

export const PatientDetails: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [child, setChild] = useState<ChildProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        surname: '',
        patronymic: '',
        birthDate: '',
        birthWeight: '',
        gender: 'male' as 'male' | 'female'
    });

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

    const handleEditClick = () => {
        if (!child) return;
        setEditForm({
            name: child.name,
            surname: child.surname,
            patronymic: child.patronymic,
            birthDate: child.birthDate,
            birthWeight: String(child.birthWeight),
            gender: child.gender
        });
        setIsEditModalOpen(true);
    };

    const handleUpdateChild = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!child || !child.id) return;

        try {
            await patientService.updateChild(child.id, {
                name: editForm.name,
                surname: editForm.surname,
                patronymic: editForm.patronymic,
                birthDate: editForm.birthDate,
                birthWeight: parseInt(editForm.birthWeight) || 0,
                gender: editForm.gender
            });
            setIsEditModalOpen(false);
            loadChild(child.id);
        } catch (error: any) {
            console.error('Failed to update child:', error);
            alert(error.message || 'Ошибка обновления профиля');
        }
    };

    const handleDeleteChild = async () => {
        if (!child || !child.id) return;

        const fullName = getFullName(child);
        const confirmed = window.confirm(`Вы уверены, что хотите полностью удалить карточку пациента "${fullName}"? Это действие необратимо, все данные о прививках будут потеряны.`);

        if (!confirmed) return;

        try {
            await patientService.deleteChild(child.id);
            navigate('/patients');
        } catch (error) {
            console.error('Failed to delete child:', error);
            alert('Не удалось удалить профиль пациента');
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
        <div className="space-y-6">
            {/* Header / Patient Card */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 flex gap-2">
                    <button
                        onClick={handleEditClick}
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

            {/* Edit Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-xl border dark:border-slate-800">
                        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center">
                            <h2 className="text-xl font-bold dark:text-white">Редактирование профиля</h2>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <form onSubmit={handleUpdateChild} className="p-6 space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Фамилия</label>
                                    <input
                                        required
                                        type="text"
                                        value={editForm.surname}
                                        onChange={e => setEditForm({ ...editForm, surname: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Имя</label>
                                    <input
                                        required
                                        type="text"
                                        value={editForm.name}
                                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Отчество</label>
                                    <input
                                        type="text"
                                        value={editForm.patronymic}
                                        onChange={e => setEditForm({ ...editForm, patronymic: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Дата рождения</label>
                                    <input
                                        required
                                        type="date"
                                        value={editForm.birthDate}
                                        onChange={e => setEditForm({ ...editForm, birthDate: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Вес при рождении (г)</label>
                                    <input
                                        type="number"
                                        value={editForm.birthWeight}
                                        onChange={e => setEditForm({ ...editForm, birthWeight: e.target.value })}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Пол</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="gender"
                                            value="male"
                                            checked={editForm.gender === 'male'}
                                            onChange={() => setEditForm({ ...editForm, gender: 'male' })}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="dark:text-white">Мальчик</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="gender"
                                            value="female"
                                            checked={editForm.gender === 'female'}
                                            onChange={() => setEditForm({ ...editForm, gender: 'female' })}
                                            className="text-pink-600 focus:ring-pink-500"
                                        />
                                        <span className="dark:text-white">Девочка</span>
                                    </label>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-4">
                                <button
                                    type="button"
                                    onClick={handleDeleteChild}
                                    className="px-4 py-2 rounded-lg text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 text-sm font-medium transition-colors"
                                >
                                    Удалить профиль
                                </button>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                                    >
                                        Отмена
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                                    >
                                        Сохранить
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
