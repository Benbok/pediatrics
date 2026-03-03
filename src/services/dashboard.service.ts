import { z } from 'zod';
import { DashboardSummary } from '../types';

const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional();

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
        const validated = DateSchema.parse(date);
        return window.electronAPI.getDashboardSummary(validated);
    },
};
