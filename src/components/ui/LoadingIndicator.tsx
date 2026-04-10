import React from 'react';
import {
    CheckCircle2,
    Clock,
    Database,
    Zap,
    Shield,
    Loader2,
    Stethoscope,
} from 'lucide-react';

export type LoadingStage =
    | 'idle'
    | 'session'
    | 'database'
    | 'llm'
    | 'license'
    | 'complete';

interface LoadingIndicatorProps {
    /**
     * Текущий этап загрузки
     */
    stage: LoadingStage;

    /**
     * Percentage 0-100
     */
    progress: number;

    /**
     * Текущее сообщение для отображения
     */
    message?: string;

    /**
     * Показывать ли индикатор (для скрытия когда все готово)
     */
    isVisible?: boolean;
}

interface StageInfo {
    id: LoadingStage;
    label: string;
    percentage: number;
    message: string;
    icon: React.ReactNode;
}

const STAGES: StageInfo[] = [
    {
        id: 'session',
        label: 'Проверка сессии',
        percentage: 15,
        message: 'Проверяем учётные данные...',
        icon: <Shield className="w-5 h-5" />,
    },
    {
        id: 'database',
        label: 'Инициализация БД',
        percentage: 40,
        message: 'Запускаем базу данных...',
        icon: <Database className="w-5 h-5" />,
    },
    {
        id: 'llm',
        label: 'Загрузка LLM',
        percentage: 75,
        message: 'Загружаем модель Qwen2.5-7B (может занять 2-3 сек)...',
        icon: <Zap className="w-5 h-5" />,
    },
    {
        id: 'license',
        label: 'Проверка лицензии',
        percentage: 95,
        message: 'Проверяем лицензию...',
        icon: <Clock className="w-5 h-5" />,
    },
    {
        id: 'complete',
        label: 'Готово',
        percentage: 100,
        message: 'Система готова к работе',
        icon: <CheckCircle2 className="w-5 h-5" />,
    },
];

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
    stage,
    progress,
    message,
    isVisible = true,
}) => {
    if (!isVisible) {
        return null;
    }

    const currentStageInfo = STAGES.find((s) => s.id === stage);
    const isLoading = stage !== 'complete' && stage !== 'idle';
    const isComplete = stage === 'complete';

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
            <div className="w-full max-w-md">
                {/* Card container */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-8 space-y-8">
                    {/* Header */}
                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center justify-center w-20 h-20 bg-primary-600 rounded-2xl shadow-lg shadow-primary-600/30 mb-2 transform hover:scale-105 transition-transform duration-300">
                            {isComplete ? (
                                <CheckCircle2 className="w-10 h-10 text-white animate-in zoom-in-50 duration-500" />
                            ) : (
                                <Stethoscope className="w-10 h-10 !text-white" strokeWidth={3} />
                            )}
                        </div>
                        <h2 className="text-3xl font-bold text-slate-800 dark:text-white tracking-tight">
                            PediAssist
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                            {message || currentStageInfo?.message || 'Инициализация системы...'}
                        </p>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                                Прогресс
                            </span>
                            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
                                {progress}%
                            </span>
                        </div>
                        <div className="relative h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${
                                    isComplete
                                        ? 'bg-gradient-to-r from-green-500 to-emerald-500'
                                        : 'bg-gradient-to-r from-primary-500 to-primary-600'
                                }`}
                                style={{
                                    width: `${Math.min(progress, 100)}%`,
                                }}
                            />
                        </div>
                    </div>

                    {/* Stages */}
                    <div className="space-y-3">
                        {STAGES.slice(0, 4).map((stageInfo, idx) => {
                            const isActive = stage === stageInfo.id;
                            const isDone =
                                STAGES.findIndex((s) => s.id === stage) >
                                STAGES.findIndex((s) => s.id === stageInfo.id);
                            const isUpcoming =
                                STAGES.findIndex((s) => s.id === stage) <
                                STAGES.findIndex((s) => s.id === stageInfo.id);

                            return (
                                <div
                                    key={stageInfo.id}
                                    className={`flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 ${
                                        isDone
                                            ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/40'
                                            : isActive
                                            ? 'bg-primary-50 dark:bg-primary-950/20 border border-primary-300 dark:border-primary-900/60 shadow-lg shadow-primary-500/10'
                                            : isUpcoming
                                            ? 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 opacity-60'
                                            : 'bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700'
                                    }`}
                                >
                                    {/* Icon */}
                                    <div
                                        className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 ${
                                            isDone
                                                ? 'bg-green-500 text-white'
                                                : isActive
                                                ? 'bg-primary-500 text-white animate-pulse'
                                                : isUpcoming
                                                ? 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                                                : 'bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400'
                                        }`}
                                    >
                                        {isDone ? (
                                            <CheckCircle2 className="w-5 h-5" />
                                        ) : isActive ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : (
                                            stageInfo.icon
                                        )}
                                    </div>

                                    {/* Label and info */}
                                    <div className="flex-1 min-w-0">
                                        <p
                                            className={`text-sm font-semibold ${
                                                isDone
                                                    ? 'text-green-700 dark:text-green-400'
                                                    : isActive
                                                    ? 'text-primary-700 dark:text-primary-400'
                                                    : 'text-slate-600 dark:text-slate-400'
                                            }`}
                                        >
                                            {stageInfo.label}
                                        </p>
                                        {isActive && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                                                {stageInfo.message}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Footer tip */}
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                        <p className="text-xs text-slate-500 dark:text-slate-500 text-center leading-relaxed">
                            {isComplete
                                ? '✓ Система полностью загружена'
                                : stage === 'llm'
                                ? '💡 Первая загрузка LLM может занять 2-3 секунды. Последующие загрузки будут быстрее.'
                                : 'Пожалуйста, подождите...'}
                        </p>
                    </div>
                </div>

                {/* Branding footer */}
                <p className="text-center mt-8 text-slate-400 dark:text-slate-600 text-xs font-semibold">
                    &copy; 2026 PediAssist v2.0
                </p>
            </div>
        </div>
    );
};
