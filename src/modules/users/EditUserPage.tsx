import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertCircle, Check, Loader, Pencil, Key, Shield, Stethoscope, Eye, EyeOff } from 'lucide-react';
import { userService } from '../../services/user.service';
import { User, UserRoleKey } from '../../types';
import { Button } from '../../components/ui/Button';
import { formatFioOnChange, formatFioOnBlur } from '../../utils/fioFormat';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../services/logger';

export const EditUserPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentUser, refreshSession } = useAuth();

    const [isFetching, setIsFetching] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isResettingPassword, setIsResettingPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const [passwordSuccess, setPasswordSuccess] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    const [form, setForm] = useState({
        username: '',
        lastName: '',
        firstName: '',
        middleName: '',
        isActive: true,
        roles: ['doctor'] as UserRoleKey[],
    });
    const [newPassword, setNewPassword] = useState('');
    const [isNewPasswordVisible, setIsNewPasswordVisible] = useState(false);

    useEffect(() => {
        if (!id) return;
        setIsFetching(true);
        userService.getAllUsers()
            .then((users) => {
                const user = users.find((u) => u.id === Number(id));
                if (!user) {
                    setError('Пользователь не найден');
                    return;
                }
                setEditingUser(user);
                setForm({
                    username: user.username,
                    lastName: user.lastName ?? '',
                    firstName: user.firstName ?? '',
                    middleName: user.middleName ?? '',
                    isActive: user.isActive,
                    roles: Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : ['doctor'],
                });
            })
            .catch((err) => {
                logger.error('[EditUserPage] Failed to load user', { error: err, userId: id });
                setError(err.message || 'Не удалось загрузить данные пользователя');
            })
            .finally(() => setIsFetching(false));
    }, [id]);

    const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingUser) return;
        setError(null);
        setIsSaving(true);

        try {
            const updateResult = await userService.updateUser({
                userId: editingUser.id,
                username: form.username,
                lastName: form.lastName,
                firstName: form.firstName,
                middleName: form.middleName,
                isActive: form.isActive,
            });
            if (!updateResult.success) {
                setError(updateResult.error || 'Ошибка при обновлении пользователя');
                return;
            }

            const rolesResult = await userService.setUserRoles({
                userId: editingUser.id,
                roles: form.roles,
            });
            if (!rolesResult.success) {
                setError(rolesResult.error || 'Ошибка при обновлении ролей');
                return;
            }

            if (editingUser.id === currentUser?.id) {
                await refreshSession();
            }
            navigate('/users');
        } catch (err: any) {
            logger.error('[EditUserPage] Save error', { error: err, userId: editingUser.id });
            setError(err.message || 'Ошибка при сохранении');
        } finally {
            setIsSaving(false);
        }
    };

    const handleResetPassword = async () => {
        if (!editingUser || newPassword.length < 6) return;
        setPasswordError(null);
        setPasswordSuccess(false);
        setIsResettingPassword(true);

        try {
            const result = await userService.resetPassword({
                userId: editingUser.id,
                newPassword,
            });
            if (result.success) {
                setPasswordSuccess(true);
                setNewPassword('');
            } else {
                setPasswordError(result.error || 'Ошибка при сбросе пароля');
            }
        } catch (err: any) {
            logger.error('[EditUserPage] Reset password error', { error: err, userId: editingUser.id });
            setPasswordError(err.message || 'Ошибка при сбросе пароля');
        } finally {
            setIsResettingPassword(false);
        }
    };

    const toggleRole = (role: UserRoleKey, checked: boolean) => {
        setForm((s) => {
            const next = new Set<UserRoleKey>(s.roles);
            if (checked) next.add(role);
            else next.delete(role);
            if (next.size === 0) next.add('doctor');
            return { ...s, roles: Array.from(next) };
        });
    };

    if (isFetching) {
        return (
            <div className="flex items-center justify-center p-16 text-slate-400">
                <Loader className="animate-spin" size={28} />
            </div>
        );
    }

    const isSelf = editingUser?.id === currentUser?.id;

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
                    <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                        <Pencil className="w-6 h-6 text-slate-700 dark:text-slate-300" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Редактирование пользователя
                        </h1>
                        {editingUser && (
                            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                                ID: {editingUser.id} · @{editingUser.username}
                            </p>
                        )}
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

                <form onSubmit={handleSave} className="space-y-6">
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
                                />
                            </div>
                        </div>
                    </div>

                    {/* Логин */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                            Учётные данные
                        </h2>
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                Логин
                            </label>
                            <input
                                type="text"
                                value={form.username}
                                onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                                className="w-full px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                            />
                        </div>
                    </div>

                    {/* Роли */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                            Права доступа
                        </h2>
                        <div className="flex flex-col gap-3">
                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                <input
                                    type="checkbox"
                                    checked={form.roles.includes('doctor')}
                                    onChange={(e) => toggleRole('doctor', e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600"
                                />
                                <Stethoscope size={18} className="text-blue-500 shrink-0" />
                                <div>
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white">Врач</div>
                                    <div className="text-xs text-slate-500">Базовый доступ к системе</div>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                                <input
                                    type="checkbox"
                                    checked={form.roles.includes('admin')}
                                    onChange={(e) => toggleRole('admin', e.target.checked)}
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

                    {/* Статус */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                        <h2 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                            Статус учётной записи
                        </h2>
                        <label className={`flex items-center gap-3 p-4 rounded-xl border transition ${isSelf ? 'opacity-50 cursor-not-allowed border-slate-200 dark:border-slate-700' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                            <input
                                type="checkbox"
                                checked={form.isActive}
                                disabled={isSelf}
                                onChange={(e) => setForm((s) => ({ ...s, isActive: e.target.checked }))}
                                className="w-4 h-4 rounded text-emerald-600"
                            />
                            <div>
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">Учётная запись активна</div>
                                {isSelf && (
                                    <div className="text-xs text-slate-500">Нельзя деактивировать свою учётную запись</div>
                                )}
                            </div>
                        </label>
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
                            isLoading={isSaving}
                            className="h-12 px-8 text-base rounded-2xl shadow-lg shadow-blue-500/20"
                            leftIcon={<Check size={20} className="stroke-[3]" />}
                        >
                            Сохранить
                        </Button>
                    </div>
                </form>
            </div>

            {/* Password Reset card */}
            <div className="bg-white dark:bg-slate-900 rounded-[28px] p-8 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
                        <Key className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Сброс пароля</h2>
                </div>

                {passwordError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex gap-3 items-center animate-in slide-in-from-top-2">
                        <AlertCircle className="text-red-500 shrink-0" size={18} />
                        <p className="text-red-600 dark:text-red-400 text-sm font-semibold">{passwordError}</p>
                    </div>
                )}
                {passwordSuccess && (
                    <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex gap-3 items-center animate-in slide-in-from-top-2">
                        <Check className="text-emerald-500 shrink-0" size={18} />
                        <p className="text-emerald-700 dark:text-emerald-300 text-sm font-semibold">Пароль успешно сброшен</p>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <input
                            type={isNewPasswordVisible ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => { setNewPassword(e.target.value); setPasswordSuccess(false); }}
                            className="w-full px-4 py-3 pr-12 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 transition"
                            placeholder="Новый пароль (минимум 6 символов)"
                        />
                        <button
                            type="button"
                            onClick={() => setIsNewPasswordVisible((v) => !v)}
                            className="absolute inset-y-0 right-0 px-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition"
                            aria-label={isNewPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
                        >
                            {isNewPasswordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <button
                        type="button"
                        onClick={handleResetPassword}
                        disabled={newPassword.length < 6 || isResettingPassword}
                        className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {isResettingPassword ? 'Сброс...' : 'Сбросить пароль'}
                    </button>
                </div>
            </div>
        </div>
    );
};
