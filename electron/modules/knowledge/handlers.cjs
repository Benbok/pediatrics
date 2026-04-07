'use strict';

const { ipcMain } = require('electron');
const { z } = require('zod');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { logger } = require('../../logger.cjs');
const { queryKnowledge } = require('../../services/knowledgeQueryService.cjs');
const { CacheService } = require('../../services/cacheService.cjs');

const KnowledgeQuerySchema = z.object({
    query: z
        .string({ required_error: 'Вопрос обязателен' })
        .min(3, 'Вопрос должен содержать минимум 3 символа')
        .max(500, 'Вопрос не должен превышать 500 символов')
        .transform(s => s.trim()),
});

function register() {
    const getCacheKey = () => {
        const userId = getSession()?.user?.id;
        return `latest_user_${userId || 'unknown'}`;
    };

    ipcMain.handle('knowledge:query', ensureAuthenticated(async (_, params) => {
        try {
            const { query } = KnowledgeQuerySchema.parse(params);
            logger.info('[KnowledgeHandlers] Query:', query.slice(0, 80));
            const result = await queryKnowledge(query);

            CacheService.set('knowledge', getCacheKey(), {
                query,
                response: { success: true, ...result },
                cachedAt: new Date().toISOString(),
            });

            return { success: true, ...result };
        } catch (err) {
            if (err.name === 'ZodError') {
                const message = err.errors.map(e => e.message).join(', ');
                logger.warn('[KnowledgeHandlers] Validation error:', message);
                return { success: false, error: message };
            }
            logger.error('[KnowledgeHandlers] Unexpected error:', err);
            return { success: false, error: 'Внутренняя ошибка сервера' };
        }
    }));

    ipcMain.handle('knowledge:get-last-query', ensureAuthenticated(async () => {
        try {
            const cached = CacheService.get('knowledge', getCacheKey());
            return cached || null;
        } catch (err) {
            logger.warn('[KnowledgeHandlers] Failed to read cached query:', err.message);
            return null;
        }
    }));
}

module.exports = { register };
