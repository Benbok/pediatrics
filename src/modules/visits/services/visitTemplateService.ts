import { VisitTemplate } from '../../../types';
import { VisitTemplateSchema } from '../../../validators/template.validator';
import { logger } from '../../../services/logger';
import { Visit } from '../../../types';

export interface VisitTemplateApplyResult {
    mergedData: Partial<Visit>;
    medicationTemplateId?: number | null;
    examTemplateSetId?: number | null;
}

export const visitTemplateService = {
    /**
     * Get visit template by ID
     */
    async getById(id: number): Promise<VisitTemplate | null> {
        try {
            return await window.electronAPI.getVisitTemplate(id);
        } catch (error) {
            logger.error('[VisitTemplateService] Failed to get template', { error, id });
            throw error;
        }
    },

    /**
     * Get all visit templates
     */
    async getAll(): Promise<VisitTemplate[]> {
        try {
            return await window.electronAPI.getAllVisitTemplates();
        } catch (error) {
            logger.error('[VisitTemplateService] Failed to get all templates', { error });
            throw error;
        }
    },

    /**
     * Get visit templates by visit type
     */
    async getByVisitType(visitType: string): Promise<VisitTemplate[]> {
        try {
            return await window.electronAPI.getVisitTemplatesByType(visitType);
        } catch (error) {
            logger.error('[VisitTemplateService] Failed to get templates by type', { error, visitType });
            throw error;
        }
    },

    /**
     * Create or update visit template
     */
    async upsert(data: VisitTemplate): Promise<VisitTemplate> {
        // Validate data using Zod
        const validation = VisitTemplateSchema.safeParse(data);
        if (!validation.success) {
            const errorMsg = validation.error.issues.map(i => i.message).join(', ');
            throw new Error(`Ошибка валидации: ${errorMsg}`);
        }

        try {
            return await window.electronAPI.upsertVisitTemplate(validation.data as VisitTemplate);
        } catch (error: any) {
            logger.error('[VisitTemplateService] Failed to save template', { error, data });
            throw new Error(error.message || 'Ошибка при сохранении шаблона');
        }
    },

    /**
     * Delete visit template
     */
    async delete(id: number): Promise<boolean> {
        try {
            return await window.electronAPI.deleteVisitTemplate(id);
        } catch (error) {
            logger.error('[VisitTemplateService] Failed to delete template', { error, id });
            throw error;
        }
    },

    /**
     * Apply visit template to existing visit data
     */
    async applyTemplate(templateId: number, existingData: Partial<Visit>): Promise<VisitTemplateApplyResult> {
        try {
            return await window.electronAPI.applyVisitTemplate({
                templateId,
                existingData,
            });
        } catch (error) {
            logger.error('[VisitTemplateService] Failed to apply template', { error, templateId });
            throw error;
        }
    },

    /**
     * Prepare template data from visit data
     * Removes fields that shouldn't be in template (ID, dates, statuses)
     */
    prepareTemplateData(visitData: Partial<Visit>): Record<string, any> {
        return {
            complaints: visitData.complaints || '',
            diseaseHistory: visitData.diseaseHistory || null,
            lifeHistory: visitData.lifeHistory || null,
            allergyHistory: visitData.allergyHistory || null,
            previousDiseases: visitData.previousDiseases || null,
            bloodPressureSystolic: visitData.bloodPressureSystolic || null,
            bloodPressureDiastolic: visitData.bloodPressureDiastolic || null,
            pulse: visitData.pulse || null,
            respiratoryRate: visitData.respiratoryRate || null,
            temperature: visitData.temperature || null,
            oxygenSaturation: visitData.oxygenSaturation || null,
            consciousnessLevel: visitData.consciousnessLevel || null,
            generalCondition: visitData.generalCondition || null,
            consciousness: visitData.consciousness || null,
            skinMucosa: visitData.skinMucosa || null,
            lymphNodes: visitData.lymphNodes || null,
            musculoskeletal: visitData.musculoskeletal || null,
            respiratory: visitData.respiratory || null,
            cardiovascular: visitData.cardiovascular || null,
            abdomen: visitData.abdomen || null,
            urogenital: visitData.urogenital || null,
            nervousSystem: visitData.nervousSystem || null,
            physicalExam: visitData.physicalExam || null,
            additionalExaminationPlan: visitData.additionalExaminationPlan || null,
            laboratoryTests: visitData.laboratoryTests || null,
            instrumentalTests: visitData.instrumentalTests || null,
            consultationRequests: visitData.consultationRequests || null,
            physiotherapy: visitData.physiotherapy || null,
            recommendations: visitData.recommendations || null,
        };
    },
};
