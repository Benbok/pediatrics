import { Disease, ClinicalGuideline, GuidelinePlan, CategorizedSymptom, SymptomCategory, SymptomSpecificity, UploadProgress } from '../../../types';
import { dataEvents } from '../../../services/dataEvents';
import { logger } from '../../../services/logger';
import { DiseaseSchema } from '../../../validators/disease.validator';

export interface RejectedUploadFile {
    fileName: string;
    reason: string;
}

const getFileNameFromPath = (filePath: string): string => {
    const normalizedPath = String(filePath || '').replace(/\\/g, '/');
    return normalizedPath.substring(normalizedPath.lastIndexOf('/') + 1);
};

const normalizeFileLikeName = (value: string): string => value.trim().toLowerCase();
const stripExtension = (value: string): string => value.replace(/\.[^/.]+$/, '');

/**
 * Сервис для работы с заболеваниями
 * Использует backend кеширование через IPC
 * Frontend кеширование через DataCacheContext (используется в компонентах)
 * Автоматическая инвалидация кеша через dataEvents
 */
const safeJsonParse = <T>(value: any, fallback: T): T => {
    if (value === null || value === undefined) return fallback;
    if (Array.isArray(value)) return value as T;
    if (typeof value !== 'string') return fallback;
    if (value.trim() === '') return fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
};

export function parseSymptoms(symptoms: any): CategorizedSymptom[] {
    const parsed = Array.isArray(symptoms) ? symptoms : safeJsonParse<any[]>(symptoms, []);
    if (parsed.length === 0) return [];
    if (typeof parsed[0] === 'string') {
        return parsed.map((text: string) => ({
            text: String(text).trim(),
            category: 'other' as SymptomCategory,
            specificity: 'medium' as SymptomSpecificity,
            isPathognomonic: false,
        }));
    }
    return parsed.map((s: any) => ({
        text: (s && s.text) ? String(s.text).trim() : '',
        category: (s && s.category && ['clinical', 'physical', 'laboratory', 'other'].includes(s.category)) ? s.category as SymptomCategory : 'other' as SymptomCategory,
        specificity: (s && s.specificity && ['low', 'medium', 'high'].includes(s.specificity)) ? s.specificity as SymptomSpecificity : 'medium' as SymptomSpecificity,
        isPathognomonic: (s && typeof s.isPathognomonic === 'boolean') ? s.isPathognomonic : false,
    })).filter((s: CategorizedSymptom) => s.text.length > 0);
}

const capitalizeFirstLetter = (value: string): string => {
    const text = String(value || '').trim();
    if (!text) return '';
    return text.charAt(0).toLocaleUpperCase() + text.slice(1);
};

const normalizeSymptomsForSave = (symptoms: any): CategorizedSymptom[] => {
    const parsed = parseSymptoms(symptoms);
    const seen = new Set<string>();
    const normalized: CategorizedSymptom[] = [];

    for (const symptom of parsed) {
        const text = capitalizeFirstLetter(symptom.text);
        if (!text) continue;

        const key = text.toLocaleLowerCase();
        if (seen.has(key)) continue;

        seen.add(key);
        normalized.push({ ...symptom, text });
    }

    return normalized;
};

const normalizeDisease = <T extends Disease>(data: T): T => {
    return {
        ...data,
        icd10Codes: Array.isArray(data.icd10Codes) ? data.icd10Codes : safeJsonParse<string[]>(data.icd10Codes, []),
        symptoms: parseSymptoms(data.symptoms),
        diagnosticPlan: Array.isArray(data.diagnosticPlan) ? data.diagnosticPlan : safeJsonParse<any[]>(data.diagnosticPlan as any, []),
        treatmentPlan: Array.isArray(data.treatmentPlan) ? data.treatmentPlan : safeJsonParse<any[]>(data.treatmentPlan as any, []),
        differentialDiagnosis: Array.isArray(data.differentialDiagnosis) ? data.differentialDiagnosis : safeJsonParse<string[]>(data.differentialDiagnosis as any, []),
        redFlags: Array.isArray(data.redFlags) ? data.redFlags : safeJsonParse<string[]>(data.redFlags as any, [])
    };
};

export const diseaseService = {
    async selectGuidelineFiles(): Promise<string[]> {
        const result = await window.electronAPI.openFile({
            filters: [{ name: 'PDF Documents', extensions: ['pdf'] }],
            properties: ['openFile', 'multiSelections']
        });

        if (result.canceled || !Array.isArray(result.filePaths)) {
            return [];
        }

        return result.filePaths;
    },

    async filterByFileSizeAsync(
        filePaths: string[],
        maxBytes = 10 * 1024 * 1024,
    ): Promise<{ validFilePaths: string[]; rejectedFiles: RejectedUploadFile[] }> {
        const validFilePaths: string[] = [];
        const rejectedFiles: RejectedUploadFile[] = [];
        for (const filePath of filePaths) {
            try {
                const size = await window.electronAPI.getFileSize(filePath);
                const maxMb = Math.round(maxBytes / 1024 / 1024);
                if (size > maxBytes) {
                    const sizeMb = (size / 1024 / 1024).toFixed(1);
                    rejectedFiles.push({
                        fileName: getFileNameFromPath(filePath),
                        reason: `Файл слишком большой: ${sizeMb} МБ (максимум ${maxMb} МБ)`,
                    });
                } else {
                    validFilePaths.push(filePath);
                }
            } catch {
                // Can't stat — backend will reject with a clear error; allow through
                validFilePaths.push(filePath);
            }
        }
        return { validFilePaths, rejectedFiles };
    },

    filterGuidelineUploadCandidates(filePaths: string[], guidelines: ClinicalGuideline[]): { validFilePaths: string[]; rejectedFiles: RejectedUploadFile[] } {
        const selected = filePaths.map(filePath => ({
            filePath,
            fileName: getFileNameFromPath(filePath)
        }));

        const existingNames = new Set(
            guidelines
                .map(g => normalizeFileLikeName(String(g.title || '').replace(/^Клинические рекомендации:\s*/, '')))
                .flatMap(name => [name, stripExtension(name)])
                .filter(Boolean)
        );

        const selectedNameSet = new Set<string>();
        const rejectedFiles: RejectedUploadFile[] = [];
        const validFilePaths: string[] = [];

        for (const item of selected) {
            const normalized = normalizeFileLikeName(item.fileName);
            const stem = stripExtension(normalized);

            if (selectedNameSet.has(normalized)) {
                rejectedFiles.push({
                    fileName: item.fileName,
                    reason: 'Дубликат в текущем выборе (одноименный файл)'
                });
                continue;
            }

            selectedNameSet.add(normalized);

            if (existingNames.has(normalized) || existingNames.has(stem)) {
                rejectedFiles.push({
                    fileName: item.fileName,
                    reason: 'Файл с таким именем уже загружен'
                });
                continue;
            }

            validFilePaths.push(item.filePath);
        }

        return { validFilePaths, rejectedFiles };
    },

    parseGuidelineUploadError(message: string, fallbackFilePaths: string[]): RejectedUploadFile[] {
        const normalizedMessage = message || 'Ошибка проверки загрузки файла';
        const colonIndex = normalizedMessage.indexOf(':');
        const reason = colonIndex >= 0 ? normalizedMessage.slice(0, colonIndex).trim() : normalizedMessage;
        const namesPart = colonIndex >= 0 ? normalizedMessage.slice(colonIndex + 1) : '';
        const parsedNames = namesPart
            .split(',')
            .map(name => name.trim())
            .filter(Boolean);
        const fallbackNames = fallbackFilePaths.map(getFileNameFromPath);
        const names = parsedNames.length > 0 ? parsedNames : fallbackNames;
        return names.map(fileName => ({ fileName, reason }));
    },

    createUploadProgressMap(jobs: Array<{ jobId: string; fileName: string }>): Map<string, UploadProgress> {
        const progressMap = new Map<string, UploadProgress>();
        jobs.forEach(job => {
            progressMap.set(job.jobId, {
                jobId: job.jobId,
                fileName: job.fileName,
                status: 'queued',
                progress: 0
            });
        });
        return progressMap;
    },

    /**
     * Fetch all diseases
     */
    async getDiseases(): Promise<Disease[]> {
        try {
            const data = await window.electronAPI.getDiseases();
            return data.map(disease => normalizeDisease(disease));
        } catch (error) {
            logger.error('[DiseaseService] Failed to fetch diseases', { error });
            throw error;
        }
    },

    /**
     * Fetch a single disease with guidelines
     */
    async getDisease(id: number): Promise<Disease & { guidelines: ClinicalGuideline[] }> {
        try {
            const data = await window.electronAPI.getDisease(id);
            return data ? normalizeDisease(data) : data;
        } catch (error) {
            logger.error('[DiseaseService] Failed to fetch disease details', { error });
            throw error;
        }
    },

    /**
     * Create or update a disease
     */
    async upsertDisease(data: Disease): Promise<Disease> {
        try {
            const normalized = normalizeDisease(data);
            const validated = DiseaseSchema.parse({
                ...normalized,
                symptoms: normalizeSymptomsForSave(normalized.symptoms)
            });
            const result = await window.electronAPI.upsertDisease(validated as unknown as Disease);
            // Уведомляем об изменении для инвалидации кеша
            dataEvents.notifyUpdated('diseases', result.id);
            return result;
        } catch (error) {
            logger.error('[DiseaseService] Failed to save disease', { error });
            throw error;
        }
    },

    /**
     * Delete a disease
     */
    async deleteDisease(id: number): Promise<boolean> {
        try {
            const result = await window.electronAPI.deleteDisease(id);
            // Уведомляем об удалении для инвалидации кеша
            dataEvents.notifyDeleted('diseases', id);
            return result;
        } catch (error) {
            logger.error('[DiseaseService] Failed to delete disease', { error });
            throw error;
        }
    },

    /**
     * Upload and parse a clinical guideline PDF
     */
    async uploadGuideline(diseaseId: number, pdfPath: string): Promise<ClinicalGuideline> {
        try {
            return await window.electronAPI.uploadGuideline(diseaseId, pdfPath);
        } catch (error) {
            logger.error('[DiseaseService] Failed to upload guideline', { error });
            throw error;
        }
    },

    /**
     * Upload multiple guidelines at once
     */
    async uploadGuidelinesBatch(diseaseId: number, pdfPaths: string[]): Promise<{ success: ClinicalGuideline[]; errors: Array<{ path: string; error: string }> | null }> {
        try {
            return await window.electronAPI.uploadGuidelinesBatch(diseaseId, pdfPaths);
        } catch (error) {
            logger.error('[DiseaseService] Failed to upload guidelines batch', { error });
            throw error;
        }
    },

    /**
     * Async upload multiple guidelines (non-blocking)
     */
    async uploadGuidelinesAsync(diseaseId: number, pdfPaths: string[]): Promise<{ batchId: string; jobs: Array<{ jobId: string; fileName: string }> }> {
        try {
            if (!Array.isArray(pdfPaths) || pdfPaths.length === 0) {
                throw new Error('Необходимо выбрать хотя бы один файл');
            }
            return await window.electronAPI.uploadGuidelinesAsync(diseaseId, pdfPaths);
        } catch (error) {
            logger.error('[DiseaseService] Failed to upload guidelines async', { error });
            throw error;
        }
    },

    /**
     * Update a guideline (rename)
     */
    async updateGuideline(guidelineId: number, title: string): Promise<ClinicalGuideline> {
        try {
            return await window.electronAPI.updateGuideline(guidelineId, { title });
        } catch (error) {
            logger.error('[DiseaseService] Failed to update guideline', { error });
            throw error;
        }
    },

    /**
     * Delete a guideline
     */
    async deleteGuideline(guidelineId: number): Promise<boolean> {
        try {
            const result = await window.electronAPI.deleteGuideline(guidelineId);
            // Уведомляем об изменении для инвалидации кеша diseases (guideline - часть disease)
            dataEvents.notifyUpdated('diseases');
            return result;
        } catch (error) {
            logger.error('[DiseaseService] Failed to delete guideline', { error });
            throw error;
        }
    },

    /**
     * Search for diseases based on symptoms
     */
    async searchBySymptoms(symptoms: string[]): Promise<Disease[]> {
        try {
            return await window.electronAPI.searchDiseases(symptoms);
        } catch (error) {
            logger.error('[DiseaseService] Search failed', { error });
            throw error;
        }
    },

    /**
     * Get normalized guideline plan for a disease
     */
    async getGuidelinePlan(diseaseId: number): Promise<GuidelinePlan> {
        try {
            return await window.electronAPI.getGuidelinePlan(diseaseId);
        } catch (error) {
            logger.error('[DiseaseService] Failed to fetch guideline plan', { error });
            throw error;
        }
    },

    /**
     * Import disease from JSON string
     */
    async importFromJson(jsonString: string): Promise<{
        success: boolean;
        data?: Disease;
        validation?: {
            isValid: boolean;
            errors: any[];
            warnings: any[];
            needsReview: boolean;
        };
        error?: string;
    }> {
        try {
            const result = await window.electronAPI.importDiseaseFromJson(jsonString);
            if (result?.data) {
                result.data = normalizeDisease(result.data);
            }
            return result;
        } catch (error: any) {
            logger.error('[DiseaseService] Failed to import from JSON', { error });
            return {
                success: false,
                error: error.message || 'Не удалось импортировать данные из JSON'
            };
        }
    },

    /**
     * Resolve input test name to canonical name from DiagnosticTestCatalog.
     */
    async resolveDiagnosticTestName(inputName: string): Promise<{
        inputName: string;
        resolvedName: string;
        changed: boolean;
    }> {
        try {
            return await window.electronAPI.resolveDiseaseTestName(inputName);
        } catch (error) {
            logger.error('[DiseaseService] Failed to resolve diagnostic test name', { error, inputName });
            return {
                inputName,
                resolvedName: inputName,
                changed: false
            };
        }
    },

    /**
     * Get canonical diagnostic test names from catalog.
     */
    async getDiagnosticCatalogTestNames(): Promise<string[]> {
        try {
            return await window.electronAPI.getDiseaseCatalogTestNames();
        } catch (error) {
            logger.error('[DiseaseService] Failed to fetch diagnostic catalog test names', { error });
            return [];
        }
    },

    /**
     * Register aliasText as an alias of canonicalName in DiagnosticTestCatalog.
     * Returns { canonicalName, aliasAdded }.
     */
    async linkTestAlias(aliasText: string, canonicalName: string): Promise<{
        canonicalName: string;
        aliasAdded: boolean;
    }> {
        try {
            return await window.electronAPI.linkDiseaseTestAlias(aliasText, canonicalName);
        } catch (error) {
            logger.error('[DiseaseService] Failed to link test alias', { error, aliasText, canonicalName });
            throw error;
        }
    },

    async listDiagnosticCatalogEntries(search?: string) {
        try {
            return await window.electronAPI.listDiagnosticCatalogEntries(search);
        } catch (error) {
            logger.error('[DiseaseService] Failed to list catalog entries', { error });
            return [];
        }
    },

    async createDiagnosticCatalogEntry(nameRu: string, type: 'lab' | 'instrumental', aliases: string[]) {
        return await window.electronAPI.createDiagnosticCatalogEntry(nameRu, type, aliases);
    },

    async updateDiagnosticCatalogEntry(id: number, data: { nameRu?: string; type?: 'lab' | 'instrumental'; aliases?: string[] }) {
        return await window.electronAPI.updateDiagnosticCatalogEntry(id, data);
    },

    async deleteDiagnosticCatalogEntry(id: number) {
        return await window.electronAPI.deleteDiagnosticCatalogEntry(id);
    }
};
