import { ToastModel, ToastSchema, ToastType } from '../validators/toast.validator';
import { TOAST_CONSTANTS } from '../constants';

function generateId(): string {
    return `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getDefaultDurationMs(type: ToastType): number {
    if (type === 'success') return TOAST_CONSTANTS.SUCCESS_DURATION;
    if (type === 'error') return TOAST_CONSTANTS.ERROR_DURATION;
    return TOAST_CONSTANTS.DEFAULT_DURATION;
}

export function createToast(message: string, type: ToastType, durationMs?: number): ToastModel {
    const toast: ToastModel = {
        id: generateId(),
        type,
        message,
        durationMs: durationMs ?? getDefaultDurationMs(type),
    };

    return ToastSchema.parse(toast);
}
