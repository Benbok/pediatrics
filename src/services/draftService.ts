import { logger } from './logger';

/**
 * Структура черновика в localStorage
 */
export interface DraftData<T = unknown> {
    data: T;
    timestamp: number;
    version: number;
}

/**
 * Префикс для ключей черновиков в localStorage
 */
const DRAFT_PREFIX = 'draft_';

/**
 * Версия формата данных (для миграций)
 */
const DRAFT_VERSION = 1;

/**
 * Максимальный возраст черновика по умолчанию (24 часа)
 */
const DEFAULT_MAX_AGE_HOURS = 24;

/**
 * Сервис для работы с черновиками форм в localStorage
 */
export const draftService = {
    /**
     * Сохранение черновика
     * @param key - Уникальный ключ черновика (например, 'visit_123_456')
     * @param data - Данные для сохранения
     */
    saveDraft<T>(key: string, data: T): void {
        try {
            const draftKey = `${DRAFT_PREFIX}${key}`;
            const draft: DraftData<T> = {
                data,
                timestamp: Date.now(),
                version: DRAFT_VERSION
            };
            localStorage.setItem(draftKey, JSON.stringify(draft));
            logger.info('[DraftService] Draft saved', { key, timestamp: draft.timestamp });
        } catch (error) {
            logger.error('[DraftService] Failed to save draft', { key, error });
            // Если localStorage переполнен, пробуем очистить старые черновики
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                this.cleanOldDrafts(1); // Очищаем черновики старше 1 часа
                try {
                    const draftKey = `${DRAFT_PREFIX}${key}`;
                    const draft: DraftData<T> = {
                        data,
                        timestamp: Date.now(),
                        version: DRAFT_VERSION
                    };
                    localStorage.setItem(draftKey, JSON.stringify(draft));
                } catch {
                    logger.error('[DraftService] Failed to save draft after cleanup', { key });
                }
            }
        }
    },

    /**
     * Загрузка черновика
     * @param key - Ключ черновика
     * @param maxAgeHours - Максимальный возраст черновика в часах (по умолчанию 24)
     * @returns Данные черновика или null
     */
    loadDraft<T>(key: string, maxAgeHours: number = DEFAULT_MAX_AGE_HOURS): DraftData<T> | null {
        try {
            const draftKey = `${DRAFT_PREFIX}${key}`;
            const saved = localStorage.getItem(draftKey);
            
            if (!saved) {
                return null;
            }
            
            const draft = JSON.parse(saved) as DraftData<T>;
            
            // Проверяем версию
            if (draft.version !== DRAFT_VERSION) {
                logger.warn('[DraftService] Draft version mismatch, removing', { key, version: draft.version });
                this.removeDraft(key);
                return null;
            }
            
            // Проверяем возраст черновика
            const ageMs = Date.now() - draft.timestamp;
            const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
            
            if (ageMs > maxAgeMs) {
                logger.info('[DraftService] Draft expired, removing', { key, ageHours: ageMs / (60 * 60 * 1000) });
                this.removeDraft(key);
                return null;
            }
            
            logger.info('[DraftService] Draft loaded', { key, timestamp: draft.timestamp });
            return draft;
        } catch (error) {
            logger.error('[DraftService] Failed to load draft', { key, error });
            return null;
        }
    },

    /**
     * Удаление черновика
     * @param key - Ключ черновика
     */
    removeDraft(key: string): void {
        try {
            const draftKey = `${DRAFT_PREFIX}${key}`;
            localStorage.removeItem(draftKey);
            logger.info('[DraftService] Draft removed', { key });
        } catch (error) {
            logger.error('[DraftService] Failed to remove draft', { key, error });
        }
    },

    /**
     * Проверка существования черновика
     * @param key - Ключ черновика
     */
    hasDraft(key: string): boolean {
        const draftKey = `${DRAFT_PREFIX}${key}`;
        return localStorage.getItem(draftKey) !== null;
    },

    /**
     * Получение списка всех черновиков
     * @returns Массив ключей черновиков (без префикса)
     */
    listDrafts(): string[] {
        const drafts: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(DRAFT_PREFIX)) {
                drafts.push(key.substring(DRAFT_PREFIX.length));
            }
        }
        
        return drafts;
    },

    /**
     * Очистка старых черновиков
     * @param maxAgeHours - Максимальный возраст в часах
     * @returns Количество удаленных черновиков
     */
    cleanOldDrafts(maxAgeHours: number = DEFAULT_MAX_AGE_HOURS): number {
        let removed = 0;
        const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
        const now = Date.now();
        
        const keysToRemove: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(DRAFT_PREFIX)) {
                try {
                    const saved = localStorage.getItem(key);
                    if (saved) {
                        const draft = JSON.parse(saved) as DraftData;
                        const ageMs = now - draft.timestamp;
                        
                        if (ageMs > maxAgeMs) {
                            keysToRemove.push(key);
                        }
                    }
                } catch {
                    // Если не удалось распарсить - удаляем
                    keysToRemove.push(key);
                }
            }
        }
        
        // Удаляем найденные ключи
        for (const key of keysToRemove) {
            localStorage.removeItem(key);
            removed++;
        }
        
        if (removed > 0) {
            logger.info('[DraftService] Old drafts cleaned', { removed, maxAgeHours });
        }
        
        return removed;
    },

    /**
     * Очистка всех черновиков
     * @returns Количество удаленных черновиков
     */
    clearAllDrafts(): number {
        let removed = 0;
        const keysToRemove: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(DRAFT_PREFIX)) {
                keysToRemove.push(key);
            }
        }
        
        for (const key of keysToRemove) {
            localStorage.removeItem(key);
            removed++;
        }
        
        logger.info('[DraftService] All drafts cleared', { removed });
        return removed;
    },

    /**
     * Генерация ключа черновика для формы приема
     * @param childId - ID пациента
     * @param visitId - ID приема (null для нового)
     */
    getVisitDraftKey(childId: number, visitId?: number | null): string {
        return visitId ? `visit_${childId}_${visitId}` : `visit_${childId}_new`;
    },

    /**
     * Получение времени последнего изменения черновика
     * @param key - Ключ черновика
     * @returns Timestamp или null
     */
    getDraftTimestamp(key: string): number | null {
        try {
            const draftKey = `${DRAFT_PREFIX}${key}`;
            const saved = localStorage.getItem(draftKey);
            
            if (!saved) {
                return null;
            }
            
            const draft = JSON.parse(saved) as DraftData;
            return draft.timestamp;
        } catch {
            return null;
        }
    },

    /**
     * Форматирование времени черновика для отображения
     * @param timestamp - Timestamp
     */
    formatDraftTime(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - timestamp;
        const diffMinutes = Math.floor(diffMs / (60 * 1000));
        const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
        
        if (diffMinutes < 1) {
            return 'только что';
        } else if (diffMinutes < 60) {
            return `${diffMinutes} мин. назад`;
        } else if (diffHours < 24) {
            return `${diffHours} ч. назад`;
        } else {
            return date.toLocaleDateString('ru-RU', { 
                day: '2-digit', 
                month: '2-digit', 
                hour: '2-digit', 
                minute: '2-digit' 
            });
        }
    }
};
