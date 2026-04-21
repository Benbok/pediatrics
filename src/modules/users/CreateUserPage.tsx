import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, UserPlus, AlertCircle, Check, Shield, Stethoscope } from 'lucide-react';
import { userService } from '../../services/user.service';
import { Button } from '../../components/ui/Button';
import { formatFioOnChange, formatFioOnBlur } from '../../utils/fioFormat';
import { logger } from '../../services/logger';

export const CreateUserPage: React.FC = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState({
        lastName: '',
        firstName: '',
        middleName: '',
        username: '',
        password: '',
        isAdmin: false,
    });

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        const lastName = formatFioOnBlur(form.lastName);
        const firstName = formatFioOnBlur(form.firstName);
        const middleName = formatFioOnBlur(form.middleName);

        try {
            const result = await userService.registerUser({
                username: form.username,
                password: form.password,
                lastName,
                firstName,
                middleName,
                isAdmin: form.isAdmin,
            });
            if (result.success) {
                navigate('/users');
            } else {
                setError(result.error || 'Ошибка при регистрации');
            }
        } catch (err: any) {
            logger.error('[CreateUserPage] Registration error', { error: err, username: form.username });
            setError(err.message || 'Ошибка при регистрации');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    onClick={() => navigate('/users')}
                    className="h-10 w-10 p-0 rounded-full hover:bg-white dark:hover:bg-slate-800"
                >
                    <ArrowLeft size={24} className="text-slate-400" />
                </Button>
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                        <UserPlus className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Новый пользователь
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                            Заполните данные для регистрации учётной записи
                        </p>
                    </div>
                </div>
            </div>

            {/* Form card */}
            <div className="bg-white dark:bg-slate-900 rounded-[28px] p-8 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-800">
                {error && (
                    <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl flex gap-3 items-center animate-in slide-in-from-top-2">
                        <AlertCircle className="text-red-500 shrink-0" size={20} />
                        <p className="text-red-600 dark:text-red-400 text-sm font-semibold">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* ФИО */}
                    <div>
                        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                            ФИО врача
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Фамилия *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.lastName}
                                    onChange={(e) => setForm((s) => ({ ...s, lastName: formatFioOnChange(e.target.value) }))}
                                    onBlur={(e) => setForm((s) => ({ ...s, lastName: formatFioOnBlur(e.target.value) }))}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                    placeholder="Иванов"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Имя
                                </label>
                                <input
                                    type="text"
                                    value={form.firstName}
                                    onChange={(e) => setForm((s) => ({ ...s, firstName: formatFioOnChange(e.target.value) }))}
                                    onBlur={(e) => setForm((s) => ({ ...s, firstName: formatFioOnBlur(e.target.value) }))}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                    placeholder="Иван"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Отчество
                                </label>
                                <input
                                    type="text"
                                    value={form.middleName}
                                    onChange={(e) => setForm((s) => ({ ...s, middleName: formatFioOnChange(e.target.value) }))}
                                    onBlur={(e) => setForm((s) => ({ ...s, middleName: formatFioOnBlur(e.target.value) }))}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                    placeholder="Иванович"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Учётные данные */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                            Учётные данные
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Логин *
                                </label>
                                <input
                                    type="text"
                                    required
                                    minLength={3}
                                    value={form.username}
                                    onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                    placeholder="ivanov"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    Пароль *
                                </label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={form.password}
                                    onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                                    className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                                    placeholder="Минимум 6 символов"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Права доступа */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                            Права доступа
                        </h2>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                <input
                                    type="checkbox"
                                    checked
                                    readOnly
                                    className="w-4 h-4 rounded text-blue-600"
                                />
                                <Stethoscope size={18} className="text-blue-500 shrink-0" />
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Врач</div>
                                    <div className="text-xs text-slate-500">Базовый доступ — назначается всем</div>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                <input
                                    type="checkbox"
                                    checked={form.isAdmin}
                                    onChange={(e) => setForm((s) => ({ ...s, isAdmin: e.target.checked }))}
                                    className="w-4 h-4 rounded text-purple-600"
                                />
                                <Shield size={18} className="text-purple-500 shrink-0" />
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Администратор</div>
                                    <div className="text-xs text-slate-500">Полный доступ к управлению системой</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Button
                            variant="ghost"
                            type="button"
                            onClick={() => navigate('/users')}
                            className="h-12 px-6 font-bold text-slate-500"
                        >
                            Отмена
                        </Button>
                        <Button
                            type="submit"
                            isLoading={isLoading}
                            className="h-12 px-8 text-base rounded-2xl shadow-lg shadow-blue-500/20"
                            leftIcon={<Check size={20} className="stroke-[3]" />}
                        >
                            Зарегистрировать
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
