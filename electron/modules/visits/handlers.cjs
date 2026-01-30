const { ipcMain } = require('electron');
const { VisitService, getExpandedIcdCodes } = require('./service.cjs');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit, logger } = require('../../logger.cjs');

/**
 * Сериализация даты для передачи в frontend
 */
function serializeDate(date) {
    if (!date) return null;
    if (typeof date === 'string') return date;
    return date.toISOString();
}

/**
 * Сериализация даты без времени (только дата)
 */
function serializeDateOnly(date) {
    if (!date) return null;
    if (typeof date === 'string') {
        // Если уже строка формата YYYY-MM-DD, возвращаем как есть
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
        // Иначе пытаемся парсить
        return new Date(date).toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
}

const setupVisitHandlers = () => {
    ipcMain.handle('visits:list-for-child', ensureAuthenticated(async (_, childId) => {
        const visits = await VisitService.listForChild(childId);
        return visits.map(v => ({
            ...v,
            createdAt: serializeDate(v.createdAt),
            updatedAt: serializeDate(v.updatedAt),
            visitDate: serializeDateOnly(v.visitDate),
            nextVisitDate: serializeDateOnly(v.nextVisitDate),
            // JSON поля уже распарсены в сервисе через _parseVisitFields
        }));
    }));

    ipcMain.handle('visits:get-by-id', ensureAuthenticated(async (_, id) => {
        const visit = await VisitService.getById(id);
        if (!visit) return null;
        return {
            ...visit,
            createdAt: serializeDate(visit.createdAt),
            updatedAt: serializeDate(visit.updatedAt),
            visitDate: serializeDateOnly(visit.visitDate),
            nextVisitDate: serializeDateOnly(visit.nextVisitDate),
            // JSON поля уже распарсены в сервисе через _parseVisitFields
        };
    }));

    ipcMain.handle('visits:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const result = await VisitService.upsert(data);
            logAudit(data.id ? 'VISIT_UPDATED' : 'VISIT_CREATED', { visitId: result.id, childId: result.childId });
            // Возвращаем распарсенные данные
            const parsed = VisitService._parseVisitFields(result);
            return {
                ...parsed,
                createdAt: serializeDate(parsed.createdAt),
                updatedAt: serializeDate(parsed.updatedAt),
                visitDate: serializeDateOnly(parsed.visitDate),
                nextVisitDate: serializeDateOnly(parsed.nextVisitDate),
            };
        } catch (error) {
            if (error.name === 'ZodError' && error.errors && Array.isArray(error.errors)) {
                throw new Error(error.errors.map(e => e.message).join(', '));
            }
            // Логируем ошибку для отладки
            logger.error('[VisitHandler] Save error:', { 
                errorName: error?.name, 
                errorMessage: error?.message,
                hasErrors: !!error?.errors,
                error: error 
            });
            throw error;
        }
    }));

    ipcMain.handle('visits:delete', ensureAuthenticated(async (_, id) => {
        await VisitService.delete(id);
        logAudit('VISIT_DELETED', { id });
        return true;
    }));

    ipcMain.handle('visits:analyze', ensureAuthenticated(async (_, visitId) => {
        return await VisitService.analyzeVisit(visitId);
    }));

    ipcMain.handle('visits:get-medications-for-diagnosis', ensureAuthenticated(async (_, { diseaseId, childId }) => {
        return await VisitService.getMedicationsForDiagnosis(diseaseId, childId);
    }));

    ipcMain.handle('visits:get-medications-by-icd-code', ensureAuthenticated(async (_, { icdCode, childId }) => {
        return await VisitService.getMedicationsByIcdCode(icdCode, childId);
    }));

    ipcMain.handle('visits:get-expanded-icd-codes', ensureAuthenticated(async (_, { icdCodes }) => {
        return await getExpandedIcdCodes(icdCodes);
    }));
};

module.exports = { setupVisitHandlers };
