const { ipcMain } = require('electron');
const { InformedConsentService } = require('./service.cjs');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit } = require('../../logger.cjs');

/**
 * Сериализация даты для передачи в frontend
 */
function serializeDate(date) {
    if (!date) return null;
    if (typeof date === 'string') return date;
    return date.toISOString();
}

const setupInformedConsentHandlers = () => {
    ipcMain.handle('informed-consent:get-by-id', ensureAuthenticated(async (_, id) => {
        const consent = await InformedConsentService.getById(id);
        if (!consent) return null;
        return {
            ...consent,
            consentDate: serializeDate(consent.consentDate),
            signatureDate: serializeDate(consent.signatureDate),
            createdAt: serializeDate(consent.createdAt),
        };
    }));

    ipcMain.handle('informed-consent:get-by-visit-id', ensureAuthenticated(async (_, visitId) => {
        const consent = await InformedConsentService.getByVisitId(visitId);
        if (!consent) return null;
        return {
            ...consent,
            consentDate: serializeDate(consent.consentDate),
            signatureDate: serializeDate(consent.signatureDate),
            createdAt: serializeDate(consent.createdAt),
        };
    }));

    ipcMain.handle('informed-consent:get-history-for-child', ensureAuthenticated(async (_, childId) => {
        const history = await InformedConsentService.getHistoryForChild(childId);
        return history.map(c => ({
            ...c,
            consentDate: serializeDate(c.consentDate),
            signatureDate: serializeDate(c.signatureDate),
            createdAt: serializeDate(c.createdAt),
            visit: c.visit ? {
                ...c.visit,
                visitDate: serializeDate(c.visit.visitDate)
            } : null
        }));
    }));

    ipcMain.handle('informed-consent:upsert', ensureAuthenticated(async (_, data) => {
        try {
            const result = await InformedConsentService.upsert(data);
            logAudit(data.id ? 'INFORMED_CONSENT_UPDATED' : 'INFORMED_CONSENT_CREATED', {
                consentId: result.id,
                childId: result.childId,
                visitId: result.visitId
            });
            return {
                ...result,
                consentDate: serializeDate(result.consentDate),
                signatureDate: serializeDate(result.signatureDate),
                createdAt: serializeDate(result.createdAt),
            };
        } catch (error) {
            if (error.name === 'ZodError') {
                throw new Error(error.errors.map(e => e.message).join(', '));
            }
            throw error;
        }
    }));

    ipcMain.handle('informed-consent:delete', ensureAuthenticated(async (_, id) => {
        await InformedConsentService.delete(id);
        logAudit('INFORMED_CONSENT_DELETED', { id });
        return true;
    }));

    ipcMain.handle('informed-consent:get-template', ensureAuthenticated(async (_, interventionType) => {
        return InformedConsentService.getTemplateForIntervention(interventionType);
    }));

    ipcMain.handle('informed-consent:needs-new-consent', ensureAuthenticated(async (_, { childId, interventionDescription }) => {
        return await InformedConsentService.needsNewConsent(childId, interventionDescription);
    }));
};

module.exports = { setupInformedConsentHandlers };
