import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { UserPlus, UserCheck, UserX, Key, Trash2 } from 'lucide-react';
import { logger } from '../../services/logger';

export const UserManagementModule: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        try {
            const allUsers = await window.electronAPI.getAllUsers();
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

        const data = {
            username: formData.get('username') as string,
            password: formData.get('password') as string,
            fullName: formData.get('fullName') as string,
            isAdmin: formData.get('isAdmin') === 'on',
        };

        try {
            const result = await window.electronAPI.registerUser(data);
            if (result.success) {
                alert(`Пользователь "${data.fullName}" успешно зарегистрирован!`);
                setIsRegisterModalOpen(false);
                loadUsers();
            } else {
                alert(result.error || 'Ошибка при регистрации');
            }
        } catch (error) {
            logger.error('[UserManagement] Registration error', { error, username: data.username });
            alert('Ошибка при регистрации');
        }
    };

    const handleToggleActive = async (userId: number, isActive: boolean) => {
        try {
            const result = isActive
                ? await window.electronAPI.deactivateUser(userId)
                : await window.electronAPI.activateUser(userId);

            if (result.success) {
                loadUsers();
            } else {
                alert(result.error || 'Ошибка');
            }
        } catch (error) {
            logger.error('[UserManagement] Toggle active error', { error, userId, isActive });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-slate-500">Загрузка пользователей...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Управление пользователями</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Зарегистрировано врачей: {users.length}
                    </p>
                </div>
                <button
                    onClick={() => setIsRegisterModalOpen(true)}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30"
                >
                    <UserPlus size={20} />
                    <span className="font-medium">Добавить врача</span>
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border dark:border-slate-800 overflow-hidden shadow-sm">
                <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b dark:border-slate-700">
                        <tr>
                            <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Пользователь
                            </th>
                            <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Логин
                            </th>
                            <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Роль
                            </th>
                            <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Статус
                            </th>
                            <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Дата создания
                            </th>
                            <th className="text-right p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                                Действия
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y dark:divide-slate-800">
                        {users.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold">
                                            {user.fullName.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="font-semibold text-slate-900 dark:text-white">
                                                {user.fullName}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                ID: {user.id}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-slate-700 dark:text-slate-300">
                                    {user.username}
                                </td>
                                <td className="p-4">
                                    {user.isAdmin ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-xs font-medium">
                                            👑 Администратор
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                                            👨‍⚕️ Врач
                                        </span>
                                    )}
                                </td>
                                <td className="p-4">
                                    {user.isActive ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-medium">
                                            <UserCheck size={14} />
                                            Активен
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full text-xs font-medium">
                                            <UserX size={14} />
                                            Деактивирован
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('ru-RU') : '-'}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleToggleActive(user.id, user.isActive)}
                                            className={`p-2 rounded-lg transition-colors ${user.isActive
                                                    ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                                                    : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                                                }`}
                                            title={user.isActive ? 'Деактивировать' : 'Активировать'}
                                        >
                                            {user.isActive ? <UserX size={18} /> : <UserCheck size={18} />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Register User Modal */}
            {isRegisterModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                            Регистрация нового врача
                        </h2>

                        <form onSubmit={handleRegisterUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                    ФИО
                                </label>
                                <input
                                    type="text"
                                    name="fullName"
                                    required
                                    className="w-full p-3 border dark:border-slate-700 rounded-lg dark:bg-slate-800 dark:text-white"
                                    placeholder="Иванов Иван Иванович"
                                />
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
                                    onClick={() => setIsRegisterModalOpen(false)}
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
        </div>
    );
};
