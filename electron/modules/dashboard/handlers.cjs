const { ipcMain } = require('electron');
const { prisma } = require('../../prisma-client.cjs');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { decrypt } = require('../../crypto.cjs');
const { logger } = require('../../logger.cjs');
const { CacheService } = require('../../services/cacheService.cjs');
const { z } = require('zod');

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const VisitAnalyticsRequestSchema = z.object({
    dateFrom: DateSchema,
    dateTo: DateSchema,
}).refine(({ dateFrom, dateTo }) => dateFrom <= dateTo, {
    message: 'dateFrom must be less than or equal to dateTo',
    path: ['dateTo'],
});

/**
 * Get start and end of day for a date string (YYYY-MM-DD)
 */
function dayRange(dateStr) {
    const start = new Date(dateStr + 'T00:00:00.000');
    const end = new Date(dateStr + 'T23:59:59.999');
    return { start, end };
}

/**
 * Get start (Monday 00:00) and end (Sunday 23:59:59) of calendar week containing date
 */
function weekRange(dateStr) {
    const d = new Date(dateStr + 'T12:00:00.000');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { start: monday, end: sunday };
}

/**
 * Serialize a Date or string to YYYY-MM-DD
 */
function serializeDateOnly(date) {
    if (!date) return null;
    if (typeof date === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
        return new Date(date).toISOString().split('T')[0];
    }
    return date.toISOString().split('T')[0];
}

function decryptChild(child) {
    if (!child) return null;

    return {
        id: child.id,
        name: decrypt(child.name),
        surname: decrypt(child.surname),
        birthDate: decrypt(child.birthDate)
    };
}

/**
 * Safely decrypt a text field. Returns null if decryption failed or value is absent.
 */
function safeDecryptField(value) {
    if (value == null) return null;
    const decrypted = decrypt(value);
    if (decrypted === '[DECRYPTION_ERROR]') return null;
    return decrypted;
}

/**
 * Safely decrypt a JSON field. Returns parsed object or null.
 */
function safeDecryptJsonField(value) {
    if (value == null) return null;
    const decrypted = decrypt(value);
    if (decrypted === '[DECRYPTION_ERROR]') return null;
    if (typeof decrypted !== 'string') return decrypted;
    try {
        return JSON.parse(decrypted);
    } catch {
        return null;
    }
}

function buildAnalyticsCacheKey(doctorId, dateFrom, dateTo) {
    return `doctor_${doctorId}_${dateFrom}_${dateTo}`;
}

const setupDashboardHandlers = () => {
    /**
     * dashboard:get-visits-stats
     * Legacy handler — kept for backward compatibility.
     * Returns day/week/month/year visit counts for the current doctor.
     */
    ipcMain.handle('dashboard:get-visits-stats', ensureAuthenticated(async (_, dateStr) => {
        const session = getSession();
        const doctorId = session?.user?.id;
        if (!doctorId) throw new Error('Unauthorized');

        const baseDate = dateStr ? DateSchema.parse(dateStr) : new Date().toISOString().slice(0, 10);
        const day = dayRange(baseDate);
        const week = weekRange(baseDate);

        const [dayCount, weekCount] = await Promise.all([
            prisma.visit.count({
                where: { doctorId, visitDate: { gte: day.start, lte: day.end } }
            }),
            prisma.visit.count({
                where: { doctorId, visitDate: { gte: week.start, lte: week.end } }
            }),
        ]);

        return { dayCount, weekCount };
    }));

    /**
     * dashboard:get-summary
     * Returns aggregated dashboard data for the current doctor:
     *   - visitsToday: list of today's visits with child info (sorted by visitTime)
     *   - visitsTodayCount: number of today's visits
     *   - patientsTodayCount: number of unique patients today
     *   - weeklyVisitsCount: number of visits this calendar week
     */
    ipcMain.handle('dashboard:get-summary', ensureAuthenticated(async (_, dateStr) => {
        try {
            const session = getSession();
            const doctorId = session?.user?.id;
            if (!doctorId) throw new Error('Unauthorized');

            const baseDate = dateStr ? DateSchema.parse(dateStr) : new Date().toISOString().slice(0, 10);
            const day = dayRange(baseDate);
            const week = weekRange(baseDate);

            const [visitsToday, weeklyVisitsCount] = await Promise.all([
                prisma.visit.findMany({
                    where: {
                        doctorId,
                        visitDate: { gte: day.start, lte: day.end }
                    },
                    include: {
                        child: {
                            select: { id: true, name: true, surname: true, birthDate: true }
                        }
                    },
                    orderBy: [{ visitTime: 'asc' }, { visitDate: 'asc' }]
                }),
                prisma.visit.count({
                    where: {
                        doctorId,
                        visitDate: { gte: week.start, lte: week.end }
                    }
                })
            ]);

            const visitsTodayCount = visitsToday.length;
            const patientsTodayCount = new Set(visitsToday.map(v => v.childId)).size;

            const serializedVisits = visitsToday.map(v => ({
                id: v.id,
                childId: v.childId,
                visitDate: serializeDateOnly(v.visitDate),
                visitTime: v.visitTime ?? null,
                visitType: v.visitType ?? null,
                complaints: safeDecryptField(v.complaints),
                notes: safeDecryptField(v.notes),
                primaryDiagnosis: safeDecryptJsonField(v.primaryDiagnosis),
                child: decryptChild(v.child)
            }));

            return {
                visitsToday: serializedVisits,
                visitsTodayCount,
                patientsTodayCount,
                weeklyVisitsCount
            };
        } catch (error) {
            logger.error('[DashboardHandler] get-summary failed:', error);
            throw error;
        }
    }));

    /**
     * dashboard:get-visit-analytics
     * Returns visit analytics for the current doctor within a custom date range.
     */
    ipcMain.handle('dashboard:get-visit-analytics', ensureAuthenticated(async (_, params) => {
        try {
            const session = getSession();
            const doctorId = session?.user?.id;
            if (!doctorId) throw new Error('Unauthorized');

            const { dateFrom, dateTo } = VisitAnalyticsRequestSchema.parse(params ?? {});
            const cacheKey = buildAnalyticsCacheKey(doctorId, dateFrom, dateTo);
            const cached = CacheService.get('dashboard', cacheKey);
            if (cached) {
                return cached;
            }

            const range = {
                gte: new Date(`${dateFrom}T00:00:00.000`),
                lte: new Date(`${dateTo}T23:59:59.999`),
            };

            const visits = await prisma.visit.findMany({
                where: {
                    doctorId,
                    visitDate: range,
                },
                include: {
                    child: {
                        select: { id: true, name: true, surname: true, birthDate: true }
                    }
                },
                orderBy: [{ visitDate: 'desc' }, { visitTime: 'desc' }]
            });

            const patientsMap = new Map();
            let completedVisitsCount = 0;
            let draftVisitsCount = 0;

            for (const visit of visits) {
                if (visit.status === 'completed') {
                    completedVisitsCount += 1;
                } else {
                    draftVisitsCount += 1;
                }

                const existing = patientsMap.get(visit.childId);
                if (existing) {
                    existing.visitsCount += 1;
                    continue;
                }

                patientsMap.set(visit.childId, {
                    childId: visit.childId,
                    visitsCount: 1,
                    lastVisitId: visit.id,
                    lastVisitDate: serializeDateOnly(visit.visitDate),
                    lastVisitTime: visit.visitTime ?? null,
                    child: decryptChild(visit.child),
                });
            }

            const result = {
                dateFrom,
                dateTo,
                totalVisitsCount: visits.length,
                uniquePatientsCount: patientsMap.size,
                completedVisitsCount,
                draftVisitsCount,
                patients: Array.from(patientsMap.values()),
            };

            CacheService.set('dashboard', cacheKey, result);
            return result;
        } catch (error) {
            logger.error('[DashboardHandler] get-visit-analytics failed:', error);
            throw error;
        }
    }));

    /**
     * dashboard:update-visit-notes
     * Updates notes for a specific visit.
     */
    ipcMain.handle('dashboard:update-visit-notes', ensureAuthenticated(async (_, visitId, notes) => {
        try {
            const session = getSession();
            const doctorId = session?.user?.id;
            if (!doctorId) throw new Error('Unauthorized');

            await prisma.visit.update({
                where: { id: Number(visitId), doctorId },
                data: { notes }
            });

            return true;
        } catch (error) {
            logger.error(`[DashboardHandler] update-visit-notes failed for visit ${visitId}:`, error);
            throw error;
        }
    }));
};

module.exports = { setupDashboardHandlers };
