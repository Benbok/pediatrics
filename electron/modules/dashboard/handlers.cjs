const { ipcMain } = require('electron');
const { prisma } = require('../../prisma-client.cjs');
const { ensureAuthenticated, getSession } = require('../../auth.cjs');
const { decrypt } = require('../../crypto.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

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
                complaints: v.complaints ?? null,
                primaryDiagnosis: v.primaryDiagnosis ? (typeof v.primaryDiagnosis === 'string' ? JSON.parse(v.primaryDiagnosis) : v.primaryDiagnosis) : null,
                child: v.child
                    ? {
                        id: v.child.id,
                        name: decrypt(v.child.name),
                        surname: decrypt(v.child.surname),
                        birthDate: decrypt(v.child.birthDate)
                    }
                    : null
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
};

module.exports = { setupDashboardHandlers };
