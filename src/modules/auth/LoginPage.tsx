import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC = () => {
    const { login } = useAuth();
    const [loginInput, setLoginInput] = useState('admin');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const result = await login(password, loginInput);
            if (!result.success) {
                setError(result.error || 'Неверные учетные данные');
            }
        } catch (err) {
            setError('Произошла непредвиденная ошибка');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
            <div className="max-w-md w-full">
                <div className="text-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-3xl shadow-xl shadow-blue-500/30 mb-6 group hover:scale-105 transition-transform">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-10 h-10 text-white">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">PediAssist</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Медицинская информационная система</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl p-10 border border-slate-100 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-700">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-8">Вход для специалистов</h2>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl text-red-600 dark:text-red-400 text-sm font-medium animate-in shake duration-500">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Логин</label>
                            <input
                                type="text"
                                value={loginInput}
                                onChange={(e) => setLoginInput(e.target.value)}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-medium"
                                placeholder="Введите логин"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1">Пароль</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white font-medium"
                                placeholder="••••••••"
                                required
                                autoFocus
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Вход...
                                </>
                            ) : (
                                'Войти в систему'
                            )}
                        </button>
                    </form>

                    <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed font-medium">
                            Для получения доступа обратитесь к администратору.<br />
                            Система соответствует требованиям 152-ФЗ.
                        </p>
                    </div>
                </div>

                <p className="text-center mt-8 text-slate-400 dark:text-slate-600 text-sm font-medium">
                    &copy; 2026 PediAssist. Все права защищены.
                </p>
            </div>
        </div>
    );
};
