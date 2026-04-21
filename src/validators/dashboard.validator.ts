import { z } from 'zod';

export const DashboardDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD');

export const DashboardVisitAnalyticsRequestSchema = z.object({
    dateFrom: DashboardDateSchema,
    dateTo: DashboardDateSchema,
}).refine(({ dateFrom, dateTo }) => dateFrom <= dateTo, {
    message: 'Дата начала не может быть позже даты окончания',
    path: ['dateTo'],
});

export const DashboardVisitAnalyticsPatientSchema = z.object({
    childId: z.number(),
    visitsCount: z.number().int().nonnegative(),
    lastVisitId: z.number().int().positive(),
    lastVisitDate: DashboardDateSchema,
    lastVisitTime: z.string().nullable(),
    child: z.object({
        id: z.number(),
        name: z.string(),
        surname: z.string(),
        birthDate: z.string(),
    }).nullable(),
});

export const DashboardVisitAnalyticsSchema = z.object({
    dateFrom: DashboardDateSchema,
    dateTo: DashboardDateSchema,
    totalVisitsCount: z.number().int().nonnegative(),
    uniquePatientsCount: z.number().int().nonnegative(),
    completedVisitsCount: z.number().int().nonnegative(),
    draftVisitsCount: z.number().int().nonnegative(),
    patients: z.array(DashboardVisitAnalyticsPatientSchema),
});