const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow } = require('electron');
const util = require('util');
const execPromise = util.promisify(exec);
const { generateEmbedding, cosineSimilarity, getCachedSearch, cacheSearch } = require('../../services/embeddingService.cjs');
const { normalizeSymptoms } = require('../../utils/cdssVocabulary.cjs');
const { normalizeDiseaseData } = require('../../utils/diseaseNormalization.cjs');

// Upload job queue
const uploadQueue = {
    jobs: new Map(), // jobId -> { status, diseaseId, fileName, progress, error }
    processing: false
};

let jobIdCounter = 0;

function generateJobId() {
    return `upload-${Date.now()}-${++jobIdCounter}`;
}

function sendProgressEvent(jobId, data) {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
        mainWindow.webContents.send('guideline:upload-progress', { jobId, ...data });
    }
}

function safeJsonParse(value, defaultValue = []) {
    if (!value || value === null) return defaultValue;
    if (typeof value !== 'string') return defaultValue;
    if (value.trim() === '') return defaultValue;

    try {
        return JSON.parse(value);
    } catch (error) {
        logger.warn('[DiseaseService] Failed to parse JSON, using default:', error.message);
        return defaultValue;
    }
}

const DiagnosticPlanItemSchema = z.object({
    type: z.enum(['lab', 'instrumental']),
    test: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
    rationale: z.string().optional().nullable(),
});

const TreatmentPlanItemSchema = z.object({
    category: z.enum(['symptomatic', 'etiologic', 'supportive', 'other']),
    description: z.string().min(1),
    priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
});

function getGuidelineText(value) {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function buildGuidelinePlan(disease, guideline) {
    const diagnosticPlan = safeJsonParse(disease.diagnosticPlan, []);
    const treatmentPlan = safeJsonParse(disease.treatmentPlan, []);
    const differentialDiagnosis = safeJsonParse(disease.differentialDiagnosis, []);
    const redFlags = safeJsonParse(disease.redFlags, []);

    const hasStructured = diagnosticPlan.length > 0 || treatmentPlan.length > 0 || differentialDiagnosis.length > 0 || redFlags.length > 0;
    if (hasStructured) {
        return {
            diseaseId: disease.id,
            diagnosticPlan,
            treatmentPlan,
            differentialDiagnosis,
            redFlags,
            source: 'disease_structured',
            needsReview: false,
            raw: null
        };
    }

    if (!guideline) {
        return {
            diseaseId: disease.id,
            diagnosticPlan: [],
            treatmentPlan: [],
            differentialDiagnosis: [],
            redFlags: [],
            source: 'none',
            needsReview: true,
            raw: null
        };
    }

    const rawLab = getGuidelineText(guideline.labDiagnostics);
    const rawInstrumental = getGuidelineText(guideline.instrumental);
    const rawTreatment = getGuidelineText(guideline.treatment);
    const rawMedications = getGuidelineText(guideline.medications);

    const fallbackDiagnosticPlan = [];
    if (rawLab) {
        fallbackDiagnosticPlan.push({
            type: 'lab',
            test: rawLab,
            priority: 'medium',
            rationale: 'Из клинических рекомендаций'
        });
    }
    if (rawInstrumental) {
        fallbackDiagnosticPlan.push({
            type: 'instrumental',
            test: rawInstrumental,
            priority: 'medium',
            rationale: 'Из клинических рекомендаций'
        });
    }

    const fallbackTreatmentPlan = [];
    if (rawTreatment) {
        fallbackTreatmentPlan.push({
            category: 'other',
            description: rawTreatment,
            priority: 'medium'
        });
    }
    if (rawMedications) {
        fallbackTreatmentPlan.push({
            category: 'other',
            description: `Препараты: ${rawMedications}`,
            priority: 'medium'
        });
    }

    return {
        diseaseId: disease.id,
        diagnosticPlan: fallbackDiagnosticPlan,
        treatmentPlan: fallbackTreatmentPlan,
        differentialDiagnosis: [],
        redFlags: [],
        source: 'guideline_raw',
        needsReview: true,
        raw: {
            labDiagnostics: rawLab,
            instrumental: rawInstrumental,
            treatment: rawTreatment,
            medications: rawMedications
        }
    };
}

// Disease Validation Schema
const DiseaseSchema = z.object({
    id: z.number().optional(),
    icd10Code: z.string().min(3).max(10),
    icd10Codes: z.array(z.string()).default([]),
    nameRu: z.string().min(2),
    nameEn: z.string().optional().nullable(),
    description: z.string(),
    symptoms: z.array(z.string()).default([]),
    diagnosticPlan: z.array(DiagnosticPlanItemSchema).optional().default([]),
    treatmentPlan: z.array(TreatmentPlanItemSchema).optional().default([]),
    differentialDiagnosis: z.array(z.string()).optional().default([]),
    redFlags: z.array(z.string()).optional().default([]),
});

const DiseaseService = {
    /**
     * Get all diseases
     */
    async list() {
        return await prisma.disease.findMany({
            orderBy: { icd10Code: 'asc' },
        });
    },

    /**
     * Get disease by ID with its guidelines
     */
    async getById(id) {
        const disease = await prisma.disease.findUnique({
            where: { id: Number(id) },
            include: {
                guidelines: true,
            },
        });

        if (!disease) return null;

        // DEBUG: Log raw database values
        logger.info(`[DiseaseService] Raw DB values for disease ${id}:`, {
            diagnosticPlan: typeof disease.diagnosticPlan + ' -> ' + (disease.diagnosticPlan?.substring(0, 100) || 'null'),
            treatmentPlan: typeof disease.treatmentPlan + ' -> ' + (disease.treatmentPlan?.substring(0, 100) || 'null'),
            differentialDiagnosis: typeof disease.differentialDiagnosis + ' -> ' + (disease.differentialDiagnosis?.substring(0, 100) || 'null'),
            redFlags: typeof disease.redFlags + ' -> ' + (disease.redFlags?.substring(0, 100) || 'null')
        });

        const diseaseIcd10Codes = safeJsonParse(disease.icd10Codes, []);
        const parsedDiagnosticPlan = safeJsonParse(disease.diagnosticPlan, []);
        const parsedTreatmentPlan = safeJsonParse(disease.treatmentPlan, []);
        const parsedDifferentialDiagnosis = safeJsonParse(disease.differentialDiagnosis, []);
        const parsedRedFlags = safeJsonParse(disease.redFlags, []);

        // DEBUG: Log parsed values
        logger.info(`[DiseaseService] Parsed values:`, {
            diagnosticPlan: parsedDiagnosticPlan.length,
            treatmentPlan: parsedTreatmentPlan.length,
            differentialDiagnosis: parsedDifferentialDiagnosis.length,
            redFlags: parsedRedFlags.length
        });

        // Фильтруем null/undefined и пустые строки
        const allCodes = [disease.icd10Code, ...diseaseIcd10Codes]
            .filter(c => c && typeof c === 'string' && c.trim() !== '');

        // Find medications matching these ICD codes
        const { MedicationService } = require('../medications/service.cjs');
        const relatedMedications = allCodes.length > 0
            ? await MedicationService.getByIcd10Codes(allCodes)
            : [];

        // Destructure to exclude fields that need parsing
        const {
            icd10Codes: _,
            diagnosticPlan: __,
            treatmentPlan: ___,
            differentialDiagnosis: ____,
            redFlags: _____,
            symptomsEmbedding: ______,
            ...diseaseWithoutJsonFields
        } = disease;

        return {
            ...diseaseWithoutJsonFields,
            icd10Codes: diseaseIcd10Codes,
            diagnosticPlan: parsedDiagnosticPlan,
            treatmentPlan: parsedTreatmentPlan,
            differentialDiagnosis: parsedDifferentialDiagnosis,
            redFlags: parsedRedFlags,
            relatedMedications
        };
    },

    /**
     * Create or update disease
     */
    async upsert(data) {
        const normalizedInput = normalizeDiseaseData(data);
        const validated = DiseaseSchema.parse(normalizedInput);
        const { id, ...rest } = validated;

        const normalizedSymptoms = normalizeSymptoms(rest.symptoms || []);
        rest.symptoms = normalizedSymptoms;

        // Генерируем embedding для симптомов
        let symptomsEmbedding = null;
        if (rest.symptoms && Array.isArray(rest.symptoms) && rest.symptoms.length > 0) {
            try {
                const symptomsText = rest.symptoms.join(', ');
                symptomsEmbedding = await generateEmbedding(symptomsText);
                logger.info(`[DiseaseService] Generated embedding for disease: ${rest.nameRu}`);
            } catch (error) {
                logger.warn('[DiseaseService] Failed to generate embedding, continuing without it:', error.message);
                // Продолжаем без embedding - это не критично
            }
        }

        const dbData = {
            ...rest,
            icd10Codes: JSON.stringify(rest.icd10Codes),
            symptoms: JSON.stringify(rest.symptoms),
            diagnosticPlan: JSON.stringify(rest.diagnosticPlan || []),
            treatmentPlan: JSON.stringify(rest.treatmentPlan || []),
            differentialDiagnosis: JSON.stringify(rest.differentialDiagnosis || []),
            redFlags: JSON.stringify(rest.redFlags || []),
            symptomsEmbedding: symptomsEmbedding ? JSON.stringify(symptomsEmbedding) : null,
        };

        logger.debug(`[DiseaseService] Saving disease with plans:`, {
            diagnosticPlan: (rest.diagnosticPlan || []).length,
            treatmentPlan: (rest.treatmentPlan || []).length,
            differentialDiagnosis: (rest.differentialDiagnosis || []).length,
            redFlags: (rest.redFlags || []).length
        });

        if (id) {
            return await prisma.disease.update({
                where: { id },
                data: dbData,
            });
        }

        return await prisma.disease.create({
            data: dbData,
        });
    },

    /**
     * Delete disease
     */
    async delete(id) {
        return await prisma.disease.delete({
            where: { id: Number(id) },
        });
    },

    /**
     * Get normalized guideline plan for a disease
     */
    async getGuidelinePlan(diseaseId) {
        const disease = await prisma.disease.findUnique({
            where: { id: Number(diseaseId) }
        });

        if (!disease) {
            throw new Error('Заболевание не найдено');
        }

        const guideline = await prisma.clinicalGuideline.findFirst({
            where: { diseaseId: Number(diseaseId) },
            orderBy: { createdAt: 'desc' }
        });

        return buildGuidelinePlan(disease, guideline);
    },

    /**
     * Update a guideline (e.g. rename)
     */
    async updateGuideline(guidelineId, data) {
        return await prisma.clinicalGuideline.update({
            where: { id: Number(guidelineId) },
            data: {
                title: data.title,
                source: data.source,
                content: data.content
            }
        });
    },

    /**
     * Delete a guideline (file)
     */
    async deleteGuideline(guidelineId) {
        const guideline = await prisma.clinicalGuideline.findUnique({
            where: { id: Number(guidelineId) }
        });

        if (!guideline) {
            throw new Error('Файл не найден');
        }

        // Удаляем физический файл
        if (guideline.pdfPath && fs.existsSync(guideline.pdfPath)) {
            try {
                fs.unlinkSync(guideline.pdfPath);
                logger.info(`[DiseaseService] Deleted file: ${guideline.pdfPath}`);
            } catch (error) {
                logger.warn(`[DiseaseService] Failed to delete file ${guideline.pdfPath}:`, error);
                // Продолжаем удаление записи из БД даже если файл не удален
            }
        }

        // Сохраняем diseaseId перед удалением
        const diseaseId = guideline.diseaseId;

        // Удаляем запись из БД
        await prisma.clinicalGuideline.delete({
            where: { id: Number(guidelineId) }
        });

        // Возвращаем объект с diseaseId для инвалидации кеша
        return { diseaseId };
    },

    /**
     * Queue multiple guidelines for async upload
     */
    async uploadGuidelinesAsync(diseaseId, pdfPaths) {
        const jobIds = [];

        for (const pdfPath of pdfPaths) {
            const jobId = generateJobId();
            const fileName = path.basename(pdfPath);

            uploadQueue.jobs.set(jobId, {
                status: 'queued',
                diseaseId,
                fileName,
                pdfPath,
                progress: 0,
                error: null
            });

            jobIds.push({ jobId, fileName });
            logger.info(`[DiseaseService] Queued upload job ${jobId}: ${fileName}`);
        }

        // Start processing if not already running
        if (!uploadQueue.processing) {
            this.processUploadQueue();
        }

        return jobIds;
    },

    /**
     * Process queued uploads in background
     */
    async processUploadQueue() {
        if (uploadQueue.processing) return;

        uploadQueue.processing = true;
        logger.info('[DiseaseService] Started processing upload queue');

        const { CacheService } = require('../../services/cacheService.cjs');

        for (const [jobId, job] of uploadQueue.jobs.entries()) {
            if (job.status !== 'queued') continue;

            try {
                job.status = 'processing';
                sendProgressEvent(jobId, { status: 'processing', fileName: job.fileName, progress: 0 });

                // Process the file
                const guideline = await this.uploadGuidelineSingle(job.diseaseId, job.pdfPath, jobId);

                job.status = 'completed';
                job.result = guideline;
                sendProgressEvent(jobId, { status: 'completed', fileName: job.fileName, progress: 100, guidelineId: guideline.id });

                // Invalidate cache to trigger UI refresh
                CacheService.invalidate('diseases', `id_${job.diseaseId}`);

                logger.info(`[DiseaseService] Completed upload job ${jobId}: ${job.fileName}`);
            } catch (error) {
                job.status = 'failed';
                job.error = error.message;
                sendProgressEvent(jobId, { status: 'failed', fileName: job.fileName, error: error.message });

                logger.error(`[DiseaseService] Failed upload job ${jobId}:`, error);
            }
        }

        uploadQueue.processing = false;
        logger.info('[DiseaseService] Finished processing upload queue');
    },

    /**
     * Get status of upload jobs
     */
    getUploadStatus(jobIds) {
        const statuses = [];
        for (const jobId of jobIds) {
            const job = uploadQueue.jobs.get(jobId);
            if (job) {
                statuses.push({
                    jobId,
                    status: job.status,
                    fileName: job.fileName,
                    progress: job.progress,
                    error: job.error
                });
            }
        }
        return statuses;
    },

    /**
     * Batch upload multiple guidelines (LEGACY - blocking)
     */
    async uploadGuidelinesBatch(diseaseId, pdfPaths) {
        if (!Array.isArray(pdfPaths) || pdfPaths.length === 0) {
            throw new Error('Необходимо указать хотя бы один файл');
        }

        const results = [];
        const errors = [];

        for (let i = 0; i < pdfPaths.length; i++) {
            const pdfPath = pdfPaths[i];
            try {
                logger.info(`[DiseaseService] Processing file ${i + 1}/${pdfPaths.length}: ${pdfPath}`);
                const guideline = await this.uploadGuideline(diseaseId, pdfPath);
                results.push(guideline);
            } catch (error) {
                logger.error(`[DiseaseService] Failed to process ${pdfPath}:`, error);
                errors.push({ path: pdfPath, error: error.message });
            }
        }

        return {
            success: results,
            errors: errors.length > 0 ? errors : null
        };
    },

    /**
     * Parse PDF guideline and save it (internal method with progress tracking)
     */
    async uploadGuidelineSingle(diseaseId, pdfPath, jobId = null) {
        logger.info(`[DiseaseService] Processing PDF: ${pdfPath} for disease ${diseaseId}`);

        try {
            // 1. Get Metadata (title, codes, symptoms) - Fast
            if (jobId) sendProgressEvent(jobId, { progress: 10, step: 'Extracting metadata' });
            const metadataScript = path.join(process.cwd(), 'scripts', 'parse_pdf.py');
            const { stdout: metaStdout } = await execPromise(`python "${metadataScript}" "${pdfPath}"`);
            const metadata = JSON.parse(metaStdout);

            // 2. Create Chunks (for search) - Fast
            if (jobId) sendProgressEvent(jobId, { progress: 40, step: 'Creating chunks' });
            const chunksScript = path.join(process.cwd(), 'scripts', 'create_chunks.py');
            const { stdout: chunksStdout } = await execPromise(`python "${chunksScript}" "${pdfPath}"`);
            const chunks = JSON.parse(chunksStdout);

            // 3. Copy file to permanent storage
            if (jobId) sendProgressEvent(jobId, { progress: 70, step: 'Saving file' });
            const storageDir = path.join(app.getPath('userData'), 'clinical_guidelines');
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }

            const ext = path.extname(pdfPath) || '.pdf';
            const fileName = `guideline_${diseaseId}_${Date.now()}${ext}`;
            const destPath = path.join(storageDir, fileName);
            fs.copyFileSync(pdfPath, destPath);

            // 4. Save to database
            if (jobId) sendProgressEvent(jobId, { progress: 90, step: 'Saving to database' });
            const guideline = await prisma.clinicalGuideline.create({
                data: {
                    diseaseId: Number(diseaseId),
                    title: metadata.title || path.basename(pdfPath),
                    pdfPath: destPath,
                    content: metadata.description || 'Документ в формате PDF',
                    chunks: JSON.stringify(chunks),
                    source: 'Минздрав РФ',
                },
            });

            // Update disease metadata ONLY if fields are empty (prevent overwriting existing data)
            await this._updateDiseaseMetadataIfEmpty(diseaseId, metadata);

            return guideline;
        } catch (error) {
            logger.error('[DiseaseService] Failed to process/upload guideline:', error);
            throw error;
        }
    },

    /**
     * Legacy synchronous upload (for single file compatibility)
     */
    async uploadGuideline(diseaseId, pdfPath) {
        return await this.uploadGuidelineSingle(diseaseId, pdfPath, null);
    },

    /**
     * Update disease metadata from PDF only if fields are empty
     * @private
     */
    async _updateDiseaseMetadataIfEmpty(diseaseId, metadata) {
        const disease = await prisma.disease.findUnique({
            where: { id: Number(diseaseId) }
        });

        if (!disease) {
            logger.warn(`[DiseaseService] Disease ${diseaseId} not found for metadata update`);
            return;
        }

        const updateData = {};

        // Обновляем симптомы ТОЛЬКО если поле пустое
        const existingSymptoms = safeJsonParse(disease.symptoms, []);
        if (existingSymptoms.length === 0 && metadata.symptoms && metadata.symptoms.length > 0) {
            updateData.symptoms = JSON.stringify(metadata.symptoms);
            logger.info(`[DiseaseService] Adding ${metadata.symptoms.length} symptoms from PDF (field was empty)`);
        } else if (existingSymptoms.length > 0) {
            logger.debug(`[DiseaseService] Skipping symptoms update - field already has ${existingSymptoms.length} items`);
        }

        // Обновляем коды МКБ ТОЛЬКО если поле пустое
        const existingIcdCodes = safeJsonParse(disease.icd10Codes, []);
        if (existingIcdCodes.length === 0 && metadata.icd10_codes && metadata.icd10_codes.length > 0) {
            updateData.icd10Codes = JSON.stringify(metadata.icd10_codes);
            logger.info(`[DiseaseService] Adding ${metadata.icd10_codes.length} ICD codes from PDF (field was empty)`);
        } else if (existingIcdCodes.length > 0) {
            logger.debug(`[DiseaseService] Skipping ICD codes update - field already has ${existingIcdCodes.length} items`);
        }

        // Обновляем только если есть что обновлять И поля были пустыми
        if (Object.keys(updateData).length > 0) {
            await prisma.disease.update({
                where: { id: Number(diseaseId) },
                data: updateData
            });
            logger.info(`[DiseaseService] Updated disease ${diseaseId} metadata from PDF`);
        } else {
            logger.debug(`[DiseaseService] No metadata updates needed for disease ${diseaseId}`);
        }
    },

    /**
     * Parse PDF without saving to database (for fast form autofill)
     */
    async parsePdfOnly(pdfPath) {
        logger.info(`[DiseaseService] Fast parsing PDF for autofill: ${pdfPath}`);

        try {
            const scriptPath = path.join(process.cwd(), 'scripts', 'parse_pdf.py');
            const { stdout, stderr } = await execPromise(`python "${scriptPath}" "${pdfPath}"`);

            let aiWarning = null;
            if (stderr && (stderr.includes('AI extraction failed') || stderr.includes('GEMINI_API_KEY'))) {
                aiWarning = 'AI-парсинг недоступен. Использован базовый парсер.';
            }

            const parsedData = JSON.parse(stdout);

            // Получаем первый код МКБ
            const firstCode = parsedData.icd10_codes?.[0];

            let nameRu = path.basename(pdfPath, path.extname(pdfPath)); // Fallback

            // Если есть код - ищем название в справочнике МКБ
            if (firstCode) {
                try {
                    const { IcdCodeService } = require('../icd-codes/service.cjs');
                    const icdCode = await IcdCodeService.getByCode(firstCode);
                    if (icdCode && icdCode.name) {
                        nameRu = icdCode.name;
                        logger.info(`[DiseaseService] Found ICD name for ${firstCode}: ${nameRu}`);
                    } else {
                        logger.warn(`[DiseaseService] ICD code ${firstCode} not found in reference`);
                    }
                } catch (error) {
                    logger.warn(`[DiseaseService] Failed to get ICD name for ${firstCode}:`, error.message);
                    // Fallback to filename
                }
            }

            return {
                icd10Code: firstCode || '',
                allIcd10Codes: parsedData.icd10_codes || [],
                nameRu, // Теперь из справочника МКБ
                description: 'Извлечено из клинических рекомендаций',
                symptoms: [], // User will enter symptoms manually
                aiUsed: !aiWarning,
                aiWarning,
                pdfPath
            };
        } catch (error) {
            logger.error('[DiseaseService] Failed to parse PDF:', error);
            throw error;
        }
    },

    /**
     * Semantic search по симптомам с использованием embeddings
     * @param {string[]} symptoms - Массив симптомов для поиска
     * @returns {Promise<Array>} Массив заболеваний, отсортированных по релевантности
     */
    async searchBySymptoms(symptoms) {
        if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
            return [];
        }

        // Объединяем симптомы в один текст
        const symptomsText = symptoms.join(', ');

        // Проверяем кэш
        const cached = getCachedSearch(symptomsText);
        if (cached) {
            logger.debug('[DiseaseService] Using cached search results');
            return cached;
        }

        const startTime = Date.now();
        try {
            // Генерируем embedding для запроса
            const queryEmbedding = await generateEmbedding(symptomsText);
            logger.debug('[DiseaseService] Generated query embedding for symptoms:', symptomsText.substring(0, 50));

            // Получаем все заболевания с embeddings
            const diseases = await prisma.disease.findMany({
                where: {
                    symptomsEmbedding: {
                        not: null
                    }
                }
            });

            if (diseases.length === 0) {
                logger.warn('[DiseaseService] No diseases with embeddings found, falling back to keyword matching');
                return this._fallbackKeywordSearch(symptoms);
            }

            // Вычисляем similarity для каждого заболевания
            const results = diseases
                .map(disease => {
                    try {
                        const diseaseEmbedding = JSON.parse(disease.symptomsEmbedding || '[]');
                        if (!Array.isArray(diseaseEmbedding) || diseaseEmbedding.length === 0) {
                            return null;
                        }

                        const similarity = cosineSimilarity(queryEmbedding, diseaseEmbedding);
                        return {
                            disease: {
                                ...disease,
                                symptoms: JSON.parse(disease.symptoms || '[]'),
                                icd10Codes: JSON.parse(disease.icd10Codes || '[]')
                            },
                            similarity
                        };
                    } catch (error) {
                        logger.warn(`[DiseaseService] Failed to parse embedding for disease ${disease.id}:`, error.message);
                        return null;
                    }
                })
                .filter(r => r !== null)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, 10); // Топ-10 результатов

            const finalResults = results.map(r => r.disease);

            // Сохраняем в кэш
            cacheSearch(symptomsText, finalResults);

            const duration = Date.now() - startTime;
            logger.info(`[DiseaseService] Semantic search found ${finalResults.length} results in ${duration}ms`);

            if (duration > 3000) {
                logger.warn(`[DiseaseService] Search took longer than expected: ${duration}ms`);
            }

            return finalResults;

        } catch (error) {
            logger.error('[DiseaseService] Semantic search failed, falling back to keyword matching:', error);
            return this._fallbackKeywordSearch(symptoms);
        }
    },

    /**
     * Fallback метод для поиска по ключевым словам (если embeddings недоступны)
     * @private
     */
    async _fallbackKeywordSearch(symptoms) {
        const diseases = await prisma.disease.findMany();
        const results = diseases
            .map(d => {
                const dSymptoms = JSON.parse(d.symptoms || '[]');
                const matches = symptoms.filter(s =>
                    dSymptoms.some(ds => ds.toLowerCase().includes(s.toLowerCase())) ||
                    d.nameRu.toLowerCase().includes(s.toLowerCase())
                );
                return {
                    disease: {
                        ...d,
                        symptoms: dSymptoms,
                        icd10Codes: JSON.parse(d.icd10Codes || '[]')
                    },
                    score: matches.length / Math.max(symptoms.length, 1)
                };
            })
            .filter(r => r.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

        return results.map(r => r.disease);
    },

    // ============= DISEASE NOTES =============

    /**
     * Get notes for a disease (personal + shared)
     */
    async listNotes(diseaseId, userId) {
        const notes = await prisma.diseaseNote.findMany({
            where: {
                diseaseId: Number(diseaseId),
                OR: [
                    { authorId: userId },
                    { isShared: true }
                ]
            },
            include: {
                author: {
                    select: {
                        id: true,
                        username: true,
                        lastName: true, firstName: true, middleName: true
                    }
                }
            },
            orderBy: [
                { isPinned: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return notes.map(note => ({
            ...note,
            tags: JSON.parse(note.tags || '[]')
        }));
    },

    /**
     * Create a new disease note
     */
    async createNote(data, userId) {
        const note = await prisma.diseaseNote.create({
            data: {
                diseaseId: Number(data.diseaseId),
                authorId: userId,
                title: data.title,
                content: data.content,
                tags: JSON.stringify(data.tags || []),
                isPinned: data.isPinned || false,
                isShared: data.isShared || false,
            }
        });

        return {
            ...note,
            tags: JSON.parse(note.tags)
        };
    },

    /**
     * Update an existing disease note
     */
    async updateNote(id, data, userId) {
        // Security check: only author can update
        const existing = await prisma.diseaseNote.findUnique({
            where: { id: Number(id) }
        });

        if (!existing || existing.authorId !== userId) {
            throw new Error('Unauthorized or note not found');
        }

        const updateData = {
            title: data.title,
            content: data.content,
            isPinned: data.isPinned,
            isShared: data.isShared,
        };

        if (data.tags) {
            updateData.tags = JSON.stringify(data.tags);
        }

        const updated = await prisma.diseaseNote.update({
            where: { id: Number(id) },
            data: updateData
        });

        return {
            ...updated,
            tags: JSON.parse(updated.tags)
        };
    },

    /**
     * Delete a disease note
     */
    async deleteNote(id, userId) {
        // Security check: only author can delete
        const existing = await prisma.diseaseNote.findUnique({
            where: { id: Number(id) }
        });

        if (!existing || existing.authorId !== userId) {
            throw new Error('Unauthorized or note not found');
        }

        return await prisma.diseaseNote.delete({
            where: { id: Number(id) }
        });
    }
};

module.exports = { DiseaseService, DiseaseSchema };
