import React from 'react';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { LlmStatus } from '../../hooks/useLlmStatus';

interface Props {
    status: LlmStatus;
    className?: string;
}

/**
 * Compact status indicator for the local LLM (LM Studio) connection.
 * Drop it into any AI component header to give the user clear feedback.
 *
 * States:
 *  - null  → pulsing grey dot (initial check in progress)
 *  - true  → green dot + "Модель активна"
 *  - false → red dot + "Модель недоступна"
 */
export const LlmStatusBadge: React.FC<Props> = ({ status, className }) => {
    if (status.available === null) {
        return (
            <span className={clsx('inline-flex items-center gap-1 text-xs text-gray-400', className)}>
                <Loader2 className="h-3 w-3 animate-spin" />
                Проверка...
            </span>
        );
    }

    if (!status.available) {
        return (
            <span className={clsx('inline-flex items-center gap-1 text-xs text-red-500 dark:text-red-400', className)}>
                <WifiOff className="h-3 w-3 shrink-0" />
                Модель недоступна
            </span>
        );
    }

    return (
        <span className={clsx('inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400', className)}>
            <Wifi className="h-3 w-3 shrink-0" />
            Модель активна
        </span>
    );
};
