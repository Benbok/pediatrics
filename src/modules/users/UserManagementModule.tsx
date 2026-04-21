import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserRoleKey, getFullName } from '../../types';
import { UserPlus, UserCheck, UserX, Shield, Stethoscope, Pencil, Trash2, Users } from 'lucide-react';
import { logger } from '../../services/logger';
import { userService } from '../../services/user.service';
import { useAuth } from '../../context/AuthContext';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';

export const UserManagementModule: React.FC = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
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

    const handleToggleActive = async (userId: number, isActive: boolean) => {
        try {
            const result = isActive ? await userService.deactivateUser(userId) : await userService.activateUser(userId);
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
                showNotify(`Пользователь "${getFullName(userToDelete)}" удален`);
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
                    <span className="text-xs text-slate-500 dark:text-slate-400">-</span>
                )}
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white dark:bg-slate-900/50 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                        <div className="space-y-2">
                            <div className="h-6 w-56 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                            <div className="h-4 w-36 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-lg" />
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-slate-900/50 rounded-[24px] border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="h-12 bg-slate-50 dark:bg-slate-800/50 animate-pulse" />
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="h-20 border-t border-slate-100 dark:border-slate-800 bg-slate-100/40 dark:bg-slate-800/20 animate-pulse" style={{ animationDelay: `${i * 0.05}s` }} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900/50 p-6 rounded-[24px] border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                        <Users className="w-8 h-8 text-slate-700 dark:text-slate-300" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Управление пользователями</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            {users.length} {users.length === 1 ? 'врач' : 'врачей'} зарегистрировано в системе
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/users/new')}
                    className="flex items-center justify-center gap-2 h-12 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 font-semibold whitespace-nowrap"
                >
                    <UserPlus size={20} />
                    <span>Добавить врача</span>
                </button>
            </div>

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
                            <th className="text-left p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Пользователь</th>
                            <th className="text-left p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Логин</th>
                            <th className="text-left p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Роль</th>
                            <th className="text-left p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Статус</th>
                            <th className="text-left p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Дата создания</th>
                            <th className="text-right p-4 text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Действия</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {users.map((user, index) => (
                            <tr
                                key={user.id}
                                className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-indigo-50/50 dark:hover:from-slate-800/50 dark:hover:to-slate-900/50 transition-all duration-200 border-b-0 last:border-b-0"
                                style={{ animation: `slideIn 0.3s ease-out ${index * 0.05}s both` }}
                            >
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white text-lg shadow-md ${
                                            user.roles?.includes('admin') ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-indigo-500'
                                        }`}>
                                            {(user.lastName || user.firstName || '?').charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="font-bold text-slate-900 dark:text-white text-sm">{getFullName(user)}</div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">ID: {user.id}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4">
                                    <span className="font-mono text-sm text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">{user.username}</span>
                                </td>
                                <td className="p-4">{renderRoleBadges(user.roles)}</td>
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
                                    {user.createdAt
                                        ? new Date(user.createdAt).toLocaleDateString('ru-RU', { year: 'numeric', month: 'short', day: 'numeric' })
                                        : '-'}
                                </td>
                                <td className="p-4">
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            onClick={() => navigate(`/users/${user.id}/edit`)}
                                            className="p-2.5 rounded-lg transition-all text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 hover:scale-110 active:scale-95"
                                            title="Редактировать"
                                        >
                                            <Pencil size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleToggleActive(user.id, user.isActive)}
                                            disabled={currentUser?.id === user.id}
                                            className={`p-2.5 rounded-lg transition-all hover:scale-110 active:scale-95 ${
                                                user.isActive
                                                    ? 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 dark:text-amber-400'
                                                    : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:text-emerald-400'
                                            } ${currentUser?.id === user.id ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                                            title={currentUser?.id === user.id ? 'Нельзя изменить статус своей учетной записи' : user.isActive ? 'Деактивировать' : 'Активировать'}
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
                        <p className="text-slate-500 dark:text-slate-400 text-lg">Нет добавленных пользователей</p>
                    </div>
                )}
            </div>

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
                message={userToDelete ? `Пользователь "${getFullName(userToDelete)}" будет удален без возможности восстановления.` : ''}
                confirmText="Удалить"
                cancelText="Отмена"
                variant="danger"
                onConfirm={handleDeleteUser}
                onCancel={() => setUserToDelete(null)}
            />
        </div>
    );
};
