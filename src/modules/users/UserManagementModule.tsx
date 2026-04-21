import React, { useState, useEffect } from 'react';
import { User, UserRoleKey, getFullName } from '../../types';
import { UserPlus, UserCheck, UserX, Shield, Stethoscope, Pencil, Key, Trash2, Users } from 'lucide-react';
import { logger } from '../../services/logger';
import { userService } from '../../services/user.service';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { formatFioOnChange, formatFioOnBlur } from '../../utils/fioFormat';

export const UserManagementModule: React.FC = () => {
    const { currentUser, refreshSession } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editForm, setEditForm] = useState<{ username: string; lastName: string; firstName: string; middleName: string; isActive: boolean; roles: UserRoleKey[] }>({
        username: '',
        lastName: '',
        firstName: '',
        middleName: '',
        isActive: true,
        roles: ['doctor'],
    });
    const [registerForm, setRegisterForm] = useState({ lastName: '', firstName: '', middleName: '' });
    const [resetPasswordValue, setResetPasswordValue] = useState('');
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [notify, setNotify] = useState<{ isOpen: boolean; title: string; message: string; variant: 'info' | 'danger' | 'warning' }>({
        isOpen: false,
        title: 'pediassist',
        message: '',
        variant: 'info',
    });

    const showNotify = (message: string, variant: 'info' | 'danger' | 'warning' = 'info', title = 'pediassist') => {
        setNotify({ isOpen: true, title, message, variant });
    };
    const closeNotify = () => setNotify((s) => ({ ...s, isOpen: false }));

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const allUsers = await userService.getAllUsers();
            setUsers(allUsers);
        } catch (error) {
            logger.error('[UserManagement] Failed to load users', { error });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegisterUser = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const lastName = formatFioOnBlur(registerForm.lastName);
        const firstName = formatFioOnBlur(registerForm.firstName);
        const middleName = formatFioOnBlur(registerForm.middleName);

        const data = {
            username: (formData.get('username') as string) || '',
            password: (formData.get('password') as string) || '',
            lastName,
            firstName,
            middleName,
            isAdmin: formData.get('isAdmin') === 'on',
        };

        try {
            const result = await userService.registerUser(data);
            if (result.success) {
                const name = [lastName, firstName, middleName].filter(Boolean).join(' ');
                showNotify(`Пользователь "${name || data.username}" успешно зарегистрирован!`);
                setIsRegisterModalOpen(false);
                setRegisterForm({ lastName: '', firstName: '', middleName: '' });
                loadUsers();
            } else {
                showNotify(result.error || 'Ошибка при регистрации', 'danger');
            }
        } catch (error) {
            logger.error('[UserManagement] Registration error', { error, username: data.username });
            showNotify('Ошибка при регистрации', 'danger');
        }
    };

    const handleToggleActive = async (userId: number, isActive: boolean) => {
        try {
            const result = isActive
                ? await userService.deactivateUser(userId)
                : await userService.activateUser(userId);

            if (result.success) {
                loadUsers();
            } else {
                showNotify(result.error || 'Ошибка', 'danger');
            }
        } catch (error) {
            logger.error('[UserManagement] Toggle active error', { error, userId, isActive });
        }
    };

    const handleDeleteUser = async () => {
        if (!userToDelete) return;
        try {
            const result = await userService.deleteUser({ userId: userToDelete.id });
            if (result.success) {
                showNotify(`Пользователь "${getFullName(userToDelete)}" удалён`);
                setUserToDelete(null);
                loadUsers();
            } else {
                showNotify(result.error || 'Ошибка при удалении пользователя', 'danger');
                setUserToDelete(null);
            }
        } catch (error) {
            logger.error('[UserManagement] Delete user error', { error, userId: userToDelete.id });
            showNotify('Ошибка при удалении пользователя', 'danger');
            setUserToDelete(null);
        }
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setEditForm({
            username: user.username,
            lastName: user.lastName ?? '',
            firstName: user.firstName ?? '',
            middleName: user.middleName ?? '',
            isActive: user.isActive,
            roles: Array.isArray(user.roles) && user.roles.length > 0 ? user.roles : ['doctor'],
        });
        setResetPasswordValue('');
        setIsEditModalOpen(true);
    };

    const handleSaveUser = async () => {
        if (!editingUser) return;
        try {
            const updateResult = await userService.updateUser({
                userId: editingUser.id,
                username: editForm.username,
                lastName: editForm.lastName,
                firstName: editForm.firstName,
                middleName: editForm.middleName,
                isActive: editForm.isActive,
            });
            if (!updateResult.success) {
                showNotify(updateResult.error || 'Ошибка при обновлении пользователя', 'danger');
                return;
            }

            const rolesResult = await userService.setUserRoles({
                userId: editingUser.id,
                roles: editForm.roles,
            });
            if (!rolesResult.success) {
                showNotify(rolesResult.error || 'Ошибка при обновлении ролей', 'danger');
                return;
            }

            showNotify('Пользователь обновлён');
            setIsEditModalOpen(false);
            setEditingUser(null);
            loadUsers();
            // Если редактировали текущего пользователя — обновляем шапку
            if (editingUser.id === currentUser?.id) {
                await refreshSession();
            }
        } catch (error) {
            logger.error('[UserManagement] Save user error', { error, userId: editingUser.id });
            showNotify('Ошибка при сохранении', 'danger');
        }
    };

    const handleResetPassword = async () => {
        if (!editingUser) return;
        try {
            const result = await userService.resetPassword({
                userId: editingUser.id,
                newPassword: resetPasswordValue,
            });
            if (result.success) {
                showNotify('Пароль успешно сброшен');
                setResetPasswordValue('');
            } else {
                showNotify(result.error || 'Ошибка при сбросе пароля', 'danger');
            }
        } catch (error) {
            logger.error('[UserManagement] Reset password error', { error, userId: editingUser.id });
            showNotify('Ошибка при сбросе пароля', 'danger');
        }
    };

    const renderRoleBadges = (roles: UserRoleKey[]) => {
        const normalized = Array.isArray(roles) ? roles : [];
        return (
            <div className="flex items-center gap-2 flex-wrap">
                {normalized.includes('admin') && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                        <Shield size={14} />
                        Администратор
                    </span>
                )}
                {normalized.includes('doctor') && (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                        <Stethoscope size={14} />
                        Врач
                    </span>
                )}
                {normalized.length === 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">—</span>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Header skeleton */}
                <div className="bg-white dark:bg-slate-900/50 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        <div className="space-y-2">
                            <div className="h-6 w-56 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                            <div className="h-4 w-36 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                        </div>
                    </div>
                </div>
                {/* Table rows skeleton */}
                <div className="bg-white dark:bg-slate-900/50 rounded-[24px] border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="h-12 bg-slate-50 dark:bg-slate-800/50 animate-pulse" />
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="h-20 border-t border-slate-100 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-800/20 animate-pulse" style={{ animationDelay: `${i * 0.05}s` }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/50 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                        <Users className="w-8 h-8 text-slate-700 dark:text-slate-300" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            Управление пользователями
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            {users.length} {users.length === 1 ? 'врач' : 'врачей'} зарегистрировано в системе
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => setIsRegisterModalOpen(true)}
                    className="flex items-center justify-center gap-2 h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 font-semibold whitespace-nowrap"
                >
                    <UserPlus size={20} />
                    <span>Добавить врача</span>
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
                <table className="w-full table-fixed">
                    <colgroup>
                        <col className="w-[30%]" />
                        <col className="w-[12%]" />
                        <col className="w-[18%]" />
                        <col className="w-[14%]" />
                        <col className="w-[14%]" />
                        <col className="w-[12%]" />
                    </colgroup>
                    <thead className="bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 border-b border-slate-200 dark:border-slate-700">
                        <tr>
                            <th className="text-left p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                Пользователь
                            </th>
                            <th className="text-left p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                Логин
                            </th>
                            <th className="text-left p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                Роль
                            </th>
                            <th className="text-left p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                Статус
                            </th>
                            <th className="text-left p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                Дата создания
                            </th>
                            <th className="text-right p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">
                                Действия
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {users.map((user, index) => (
                            <tr 
                                key={user.id} 
                                className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-slate-800/50 dark:hover:to-slate-900/50 transition-all duration-200 border-b-0 last:border-b-0"
                                style={{
                                    animation: `slideIn 0.3s ease-out ${index * 0.05}s both`
                                }}
                            >
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-md ${
                                            user.roles?.includes('admin') 
                                                ? 'bg-gradient-to-br from-purple-500 to-pink-500' 
                                                : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                                        }`}>
                                            {(user.lastName || user.firstName || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white text-sm">
                                                {getFullName(user)}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                                                ID: {user.id}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className="font-mono text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                                        {user.username}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {renderRoleBadges(user.roles)}
                                </td>
                                <td className="p-4">
                                    {user.isActive ? (
                                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-bold uppercase tracking-wide">
                                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                            Активен
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-bold uppercase tracking-wide">
                                            <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                            Деактивирован
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    }) : '—'}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => openEditModal(user)}
                                            className="p-2.5 rounded-lg transition-all text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 active:scale-95"
                                            title="Редактировать"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(user.id, user.isActive)}
                                            disabled={currentUser?.id === user.id}
                                            className={`p-2.5 rounded-lg transition-all hover:scale-110 active:scale-95 ${user.isActive
                                                    ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 dark:text-amber-400'
                                                    : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:text-emerald-400'
                                                } ${currentUser?.id === user.id ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                                            title={currentUser?.id === user.id ? 'Нельзя изменить статус своей учетной записи' : (user.isActive ? 'Деактивировать' : 'Активировать')}
                                        >
                                            {user.isActive ? <UserX size={18} /> : <UserCheck size={18} />}
                                        </button>
                                        <button
                                            onClick={() => setUserToDelete(user)}
                                            disabled={currentUser?.id === user.id}
                                            className={`p-2.5 rounded-lg transition-all text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:scale-110 active:scale-95 ${currentUser?.id === user.id ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                                            title={currentUser?.id === user.id ? 'Нельзя удалить свою учетную запись' : 'Удалить пользователя'}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 && (
                    <div className="text-center py-12">
                        <Users size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                        <p className="text-slate-500 dark:text-slate-400 text-lg">
                            Нет добавленных пользователей
                        </p>
                    </div>
                )}
            </div>

            {/* Register User Modal */}
            {isRegisterModalOpen && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in scale-in-95 fade-in duration-300">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                            ➕ Регистрация нового врача
                        </h2>

                        <form onSubmit={handleRegisterUser} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Фамилия *
                                    </label>
                                    <input
                                        type="text"
                                        name="lastName"
                                        required
                                        value={registerForm.lastName}
                                        onChange={(e) => setRegisterForm((s) => ({ ...s, lastName: formatFioOnChange(e.target.value) }))}
                                        onBlur={(e) => setRegisterForm((s) => ({ ...s, lastName: formatFioOnBlur(e.target.value) }))}
                                        className="w-full p-3 border dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                                        placeholder="Иванов"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Имя
                                    </label>
                                    <input
                                        type="text"
                                        name="firstName"
                                        value={registerForm.firstName}
                                        onChange={(e) => setRegisterForm((s) => ({ ...s, firstName: formatFioOnChange(e.target.value) }))}
                                        onBlur={(e) => setRegisterForm((s) => ({ ...s, firstName: formatFioOnBlur(e.target.value) }))}
                                        className="w-full p-3 border dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                                        placeholder="Иван"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Отчество
                                    </label>
                                    <input
                                        type="text"
                                        name="middleName"
                                        value={registerForm.middleName}
                                        onChange={(e) => setRegisterForm((s) => ({ ...s, middleName: formatFioOnChange(e.target.value) }))}
                                        onBlur={(e) => setRegisterForm((s) => ({ ...s, middleName: formatFioOnBlur(e.target.value) }))}
                                        className="w-full p-3 border dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                                        placeholder="Иванович"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Логин
                                </label>
                                <input
                                    type="text"
                                    name="username"
                                    required
                                    minLength={3}
                                    className="w-full p-3 border dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                                    placeholder="ivanov"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    Пароль
                                </label>
                                <input
                                    type="password"
                                    name="password"
                                    required
                                    minLength={6}
                                    className="w-full p-3 border dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                                    placeholder="Минимум 6 символов"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    name="isAdmin"
                                    id="isAdmin"
                                    className="w-4 h-4 rounded"
                                />
                                <label htmlFor="isAdmin" className="text-sm text-slate-700 dark:text-slate-300">
                                    Сделать администратором
                                </label>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRegisterModalOpen(false);
                                        setRegisterForm({ lastName: '', firstName: '', middleName: '' });
                                    }}
                                    className="flex-1 px-4 py-2 border dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                >
                                    Зарегистрировать
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {isEditModalOpen && editingUser && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-40 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in scale-in-95 fade-in duration-300 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="min-w-0">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white break-words">
                                    ✏️ Редактирование пользователя
                                </h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    ID: {editingUser.id}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setIsEditModalOpen(false);
                                    setEditingUser(null);
                                }}
                                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                Закрыть
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Фамилия *
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.lastName}
                                            onChange={(e) => setEditForm((s) => ({ ...s, lastName: formatFioOnChange(e.target.value) }))}
                                            onBlur={(e) => setEditForm((s) => ({ ...s, lastName: formatFioOnBlur(e.target.value) }))}
                                            className="w-full p-3 border dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Имя
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.firstName}
                                            onChange={(e) => setEditForm((s) => ({ ...s, firstName: formatFioOnChange(e.target.value) }))}
                                            onBlur={(e) => setEditForm((s) => ({ ...s, firstName: formatFioOnBlur(e.target.value) }))}
                                            className="w-full p-3 border dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                            Отчество
                                        </label>
                                        <input
                                            type="text"
                                            value={editForm.middleName}
                                            onChange={(e) => setEditForm((s) => ({ ...s, middleName: formatFioOnChange(e.target.value) }))}
                                            onBlur={(e) => setEditForm((s) => ({ ...s, middleName: formatFioOnBlur(e.target.value) }))}
                                            className="w-full p-3 border dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                        Логин
                                    </label>
                                    <input
                                        type="text"
                                        value={editForm.username}
                                        onChange={(e) => setEditForm((s) => ({ ...s, username: e.target.value }))}
                                        className="w-full p-3 border dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Роли
                                    </label>
                                    <div className="flex items-center gap-4 flex-wrap">
                                        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={editForm.roles.includes('doctor')}
                                                onChange={(e) => {
                                                    setEditForm((s) => {
                                                        const next = new Set<UserRoleKey>(s.roles);
                                                        if (e.target.checked) next.add('doctor');
                                                        else next.delete('doctor');
                                                        if (next.size === 0) next.add('doctor');
                                                        return { ...s, roles: Array.from(next) };
                                                    });
                                                }}
                                                className="w-4 h-4 rounded"
                                            />
                                            Врач
                                        </label>
                                        <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                            <input
                                                type="checkbox"
                                                checked={editForm.roles.includes('admin')}
                                                onChange={(e) => {
                                                    setEditForm((s) => {
                                                        const next = new Set<UserRoleKey>(s.roles);
                                                        if (e.target.checked) next.add('admin');
                                                        else next.delete('admin');
                                                        if (next.size === 0) next.add('doctor');
                                                        return { ...s, roles: Array.from(next) };
                                                    });
                                                }}
                                                className="w-4 h-4 rounded"
                                            />
                                            Администратор
                                        </label>
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                                        Статус
                                    </label>
                                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                        <input
                                            type="checkbox"
                                            checked={editForm.isActive}
                                            disabled={currentUser?.id === editingUser.id}
                                            onChange={(e) => setEditForm((s) => ({ ...s, isActive: e.target.checked }))}
                                            className="w-4 h-4 rounded"
                                        />
                                        Активен
                                    </label>
                                    {currentUser?.id === editingUser.id && (
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                            Нельзя деактивировать свою учетную запись
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
                                <div className="flex items-center gap-2 text-slate-900 dark:text-white font-semibold">
                                    <Key size={18} />
                                    Сброс пароля
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <input
                                        type="password"
                                        value={resetPasswordValue}
                                        onChange={(e) => setResetPasswordValue(e.target.value)}
                                        className="flex-1 p-3 border dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                                        placeholder="Новый пароль (минимум 6 символов)"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleResetPassword}
                                        disabled={resetPasswordValue.length < 6}
                                        className="px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 !text-white font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Сбросить
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsEditModalOpen(false);
                                        setEditingUser(null);
                                    }}
                                    className="flex-1 px-4 py-3 border dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSaveUser}
                                    className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 !text-white font-bold rounded-lg transition-colors"
                                >
                                    Сохранить
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={notify.isOpen}
                title={notify.title}
                message={notify.message}
                variant={notify.variant}
                showCancel={false}
                confirmText="OK"
                onConfirm={closeNotify}
                onCancel={closeNotify}
            />

            <ConfirmDialog
                isOpen={userToDelete != null}
                title="Удалить пользователя?"
                message={userToDelete
                    ? `Пользователь "${getFullName(userToDelete)}" будет удалён без возможности восстановления.`
                    : ''}
                confirmText="Удалить"
                cancelText="Отмена"
                variant="danger"
                onConfirm={handleDeleteUser}
                onCancel={() => setUserToDelete(null)}
            />
        </div>
    );
};
