import { z } from 'zod';
import { DashboardSummary, DashboardVisitAnalytics, DashboardVisitAnalyticsRequest } from '../types';
import {
    DashboardDateSchema,
    DashboardVisitAnalyticsRequestSchema,
    DashboardVisitAnalyticsSchema,
} from '../validators/dashboard.validator';

const OptionalDateSchema = DashboardDateSchema.optional();
const VisitIdSchema = z.number().int().positive();
const NotesSchema = z.string();

/**
 * DASHBOARD SERVICE
 *
 * Thin layer between Dashboard.tsx and the IPC bridge.
 * Responsible for Zod validation and IPC calls only.
 * No business logic.
 */
export const dashboardService = {
    /**
     * Fetch aggregated dashboard summary for the current doctor.
     * @param date - ISO date string YYYY-MM-DD (defaults to today on the backend)
     */
    async getSummary(date?: string): Promise<DashboardSummary> {
        const validatedDate = date ? OptionalDateSchema.parse(date) : undefined;
        return window.electronAPI.getDashboardSummary(validatedDate);
    },

    async getVisitAnalytics(range: DashboardVisitAnalyticsRequest): Promise<DashboardVisitAnalytics> {
        const validatedRange = DashboardVisitAnalyticsRequestSchema.parse(range);
        const response = await window.electronAPI.getDashboardVisitAnalytics(validatedRange);
        return DashboardVisitAnalyticsSchema.parse(response);
    },

    async updateNotes(visitId: number, notes: string): Promise<boolean> {
        return window.electronAPI.updateVisitNotes(VisitIdSchema.parse(visitId), NotesSchema.parse(notes));
    }
};
