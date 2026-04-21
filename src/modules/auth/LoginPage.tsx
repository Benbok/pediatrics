import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { UserCircle, Lock, AlertCircle, Stethoscope, Eye, EyeOff } from 'lucide-react';

interface LoginPageProps {
    initialLogin?: string;
    initialPassword?: string;
}

export const LoginPage: React.FC<LoginPageProps> = ({ initialLogin = 'admin', initialPassword = '' }) => {
    const { login } = useAuth();
    const [loginInput, setLoginInput] = useState(initialLogin);
    const [password, setPassword] = useState(initialPassword);
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);

        try {
            const result = await login(loginInput, password);
            if (!result.success) {
                setError(result.error || 'Неверные учетные данные');
                setPassword(''); // Очищаем пароль после неудачной попытки
                setIsSubmitting(false);
            }
        } catch (err) {
            setError('Произошла непредвиденная ошибка');
            setPassword(''); // Очищаем пароль после ошибки
            setIsSubmitting(false);
        }
    };

    // Show loading indicator during login process
    if (isSubmitting) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin"></div>
                    <span className="text-slate-500 font-medium">Вход в систему...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 transition-colors">
            <div className="max-w-md w-full relative z-10">
                <div className="text-center mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-2xl shadow-lg shadow-primary-600/30 mb-6 transform hover:scale-105 transition-transform duration-300">
                        <Stethoscope className="w-10 h-10 !text-white" strokeWidth={3} />
                    </div>
                    <h1 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                        PediAssist
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                        Медицинская информационная система
                    </p>
                </div>

                <Card className="shadow-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-in fade-in zoom-in-95 duration-500">
                    <h2 className="text-xl font-bold text-center text-slate-900 dark:text-white mb-8">
                        Вход в систему
                    </h2>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-start gap-3 animate-in shake duration-300">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <span className="text-sm text-red-600 dark:text-red-400 font-medium">
                                {error}
                            </span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            label="Логин"
                            type="text"
                            value={loginInput}
                            onChange={(e) => setLoginInput(e.target.value)}
                            placeholder="Введите ваш логин"
                            leftIcon={<UserCircle className="w-5 h-5" />}
                            required
                            autoComplete="username"
                        />

                        <Input
                            label="Пароль"
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            leftIcon={<Lock className="w-5 h-5" />}
                            rightIcon={showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            onRightIconClick={() => setShowPassword(!showPassword)}
                            required
                            autoComplete="current-password"
                        />

                        <Button
                            type="submit"
                            variant="primary"
                            size="lg"
                            className="w-full mt-2 !bg-[#2563eb] !text-white hover:!bg-[#1d4ed8] !opacity-100"
                            isLoading={isSubmitting}
                        >
                            <span className="!text-white">Войти</span>
                        </Button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
                        <p className="text-xs text-slate-500 dark:text-slate-500 leading-relaxed font-medium">
                            Доступ предоставляется администратором<br />
                            Система защищена в соответствии с 152-ФЗ
                        </p>
                    </div>
                </Card>

                <p className="text-center mt-8 text-slate-400 dark:text-slate-600 text-xs font-semibold">
                    &copy; 2026 PediAssist v2.0
                </p>
            </div>
        </div>
    );
};
