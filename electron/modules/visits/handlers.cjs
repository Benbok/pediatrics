const { ipcMain } = require('electron');
const { VisitService, getExpandedIcdCodes } = require('./service.cjs');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { logAudit, logger } = require('../../logger.cjs');
const { CacheService } = require('../../services/cacheService.cjs');

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
        const session = getSession();
        const currentUser = session?.user;
        if (!currentUser) {
            throw new Error('Unauthorized');
        }

        const deletedVisit = await VisitService.delete(id, currentUser);
        logAudit('VISIT_DELETED', {
            id: deletedVisit.id,
            childId: deletedVisit.childId,
            deletedByUserId: currentUser.id,
        });
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

    ipcMain.handle('visits:get-diagnostics-by-icd-code', ensureAuthenticated(async (_, icdCode) => {
        return await VisitService.getDiagnosticsByIcdCode(icdCode);
    }));

    ipcMain.handle('visits:get-disease-recommendations-by-icd-code', ensureAuthenticated(async (_, icdCode) => {
        return await VisitService.getDiseaseRecommendationsByIcdCode(icdCode);
    }));

    ipcMain.handle('visits:get-all-diagnostic-tests', ensureAuthenticated(async () => {
        const cached = CacheService.get('visits', 'all_diagnostic_tests');
        if (cached) return cached;
        const result = await VisitService.getAllDiagnosticTests();
        CacheService.set('visits', 'all_diagnostic_tests', result);
        return result;
    }));

    ipcMain.handle('visits:get-all-disease-recommendations', ensureAuthenticated(async () => {
        const cached = CacheService.get('visits', 'all_disease_recommendations');
        if (cached) return cached;
        const result = await VisitService.getAllDiseaseRecommendations();
        CacheService.set('visits', 'all_disease_recommendations', result);
        return result;
    }));

    ipcMain.handle('visits:list-by-doctor-and-date', ensureAuthenticated(async (_, dateStr) => {
        const session = getSession();
        const doctorId = session?.user?.id;
        if (!doctorId) throw new Error('Unauthorized');
        const visits = await VisitService.listByDoctorAndDate(doctorId, dateStr);
        return visits.map(v => ({
            ...v,
            visitDate: serializeDateOnly(v.visitDate),
            nextVisitDate: serializeDateOnly(v.nextVisitDate),
            createdAt: serializeDate(v.createdAt),
            updatedAt: serializeDate(v.updatedAt)
        }));
    }));
};

module.exports = { setupVisitHandlers };
