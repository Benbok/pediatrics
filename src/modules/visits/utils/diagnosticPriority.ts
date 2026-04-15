import type { DiagnosticRecommendationWithCodes, DiagnosticPlanItem } from '../../../types';

const PRIORITY_WEIGHT: Record<NonNullable<DiagnosticPlanItem['priority']>, number> = {
    high: 3,
    medium: 2,
    low: 1,
};

export function getDiagnosticPriorityWeight(priority: DiagnosticPlanItem['priority'] | null | undefined): number {
    if (!priority) return 0;
    return PRIORITY_WEIGHT[priority] ?? 0;
}

export function sortDiagnosticsByPriority(
    diagnostics: DiagnosticRecommendationWithCodes[]
): DiagnosticRecommendationWithCodes[] {
    return [...diagnostics].sort((a, b) => {
        const priorityDiff = getDiagnosticPriorityWeight(b.item.priority) - getDiagnosticPriorityWeight(a.item.priority);
        if (priorityDiff !== 0) return priorityDiff;

        return String(a.item.test || '').localeCompare(String(b.item.test || ''), 'ru', { sensitivity: 'base' });
    });
}
