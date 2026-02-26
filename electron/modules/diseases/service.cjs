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
const { normalizeWithAI } = require('../../services/aiSymptomNormalizer.cjs');
const { logDegradation } = require('../../logger.cjs');
const { normalizeDiseaseData } = require('../../utils/diseaseNormalization.cjs');
const { ChunkIndexService } = require('../../services/chunkIndexService.cjs');

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
    // Keep in-memory job status in sync for polling clients
    try {
        const job = uploadQueue.jobs.get(jobId);
        if (job) {
            if (data.status) job.status = data.status;
            if (typeof data.progress === 'number') job.progress = data.progress;
            if (data.error) job.error = data.error;
        }
    } catch (_) {
        // noop
    }

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

// Symptom schema: { text, category } with backward compatibility for string[]
const SymptomSchema = z.object({
    text: z.string().min(1),
    category: z.enum(['clinical', 'physical', 'other']).default('other'),
});

// Disease Validation Schema
const DiseaseSchema = z.object({
    id: z.number().optional(),
    icd10Code: z.string().min(3).max(10),
    icd10Codes: z.array(z.string()).default([]),
    nameRu: z.string().min(2),
    nameEn: z.string().optional().nullable(),
    description: z.string(),
    symptoms: z.array(SymptomSchema).default([]),
    diagnosticPlan: z.array(DiagnosticPlanItemSchema).optional().default([]),
    treatmentPlan: z.array(TreatmentPlanItemSchema).optional().default([]),
    differentialDiagnosis: z.array(z.string()).optional().default([]),
    redFlags: z.array(z.string()).optional().default([]),
});

/**
 * Parse symptoms from DB JSON. Supports old format (string[]) and new format ({text, category}[]).
 */
function _parseSymptoms(symptomsJson) {
    const parsed = safeJsonParse(symptomsJson, []);
    if (parsed.length === 0) return [];
    if (typeof parsed[0] === 'string') {
        return parsed.map(text => ({ text: String(text).trim(), category: 'other' }));
    }
    return parsed.map(s => ({
        text: (s && s.text) ? String(s.text).trim() : '',
        category: (s && s.category && ['clinical', 'physical', 'other'].includes(s.category)) ? s.category : 'other',
    })).filter(s => s.text.length > 0);
}

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
            symptoms: _____symptoms,
            ...diseaseWithoutJsonFields
        } = disease;

        const parsedSymptoms = _parseSymptoms(disease.symptoms);

        return {
            ...diseaseWithoutJsonFields,
            icd10Codes: diseaseIcd10Codes,
            symptoms: parsedSymptoms,
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

        const symptomTexts = (rest.symptoms || []).map(s => (typeof s === 'string' ? s : s.text));
        const symptomsTextForEmbedding = symptomTexts.join(', ');

        let shouldRegenerateEmbedding = true;
        let symptomsEmbedding = null;

        if (id) {
            const existingDisease = await prisma.disease.findUnique({
                where: { id },
            });
            if (existingDisease && existingDisease.symptoms) {
                const oldParsed = _parseSymptoms(existingDisease.symptoms);
                const oldTexts = oldParsed.map(s => s.text).sort().join('|');
                const newTexts = symptomTexts.slice().sort().join('|');
                shouldRegenerateEmbedding = oldTexts !== newTexts;
                logger.debug(`[DiseaseService] Embedding regeneration: ${shouldRegenerateEmbedding ? 'YES' : 'NO (category-only change)'}`);
            }
        }

        if (shouldRegenerateEmbedding && symptomTexts.length > 0) {
            try {
                symptomsEmbedding = await generateEmbedding(symptomsTextForEmbedding);
                logger.info(`[DiseaseService] Generated embedding for disease: ${rest.nameRu}`);
            } catch (error) {
                logger.warn('[DiseaseService] Failed to generate embedding, continuing without it:', error.message);
            }
        } else if (id) {
            const existingDisease = await prisma.disease.findUnique({ where: { id } });
            if (existingDisease && existingDisease.symptomsEmbedding) {
                symptomsEmbedding = existingDisease.symptomsEmbedding;
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
            symptomsEmbedding: symptomsEmbedding ? (typeof symptomsEmbedding === 'string' ? symptomsEmbedding : JSON.stringify(symptomsEmbedding)) : null,
        };

        logger.debug(`[DiseaseService] Saving disease with plans:`, {
            diagnosticPlan: (rest.diagnosticPlan || []).length,
            treatmentPlan: (rest.treatmentPlan || []).length,
            differentialDiagnosis: (rest.differentialDiagnosis || []).length,
            redFlags: (rest.redFlags || []).length
        });

        if (id) {
            const updated = await prisma.disease.update({
                where: { id },
                data: dbData,
            });
            return { ...updated, symptoms: _parseSymptoms(updated.symptoms) };
        }

        const created = await prisma.disease.create({
            data: dbData,
        });
        return { ...created, symptoms: _parseSymptoms(created.symptoms) };
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

        // Delete chunks first, then guideline (no FTS triggers — FTS is rebuilt programmatically)
        await prisma.guidelineChunk.deleteMany({
            where: { guidelineId: Number(guidelineId) }
        });
        await prisma.clinicalGuideline.delete({
            where: { id: Number(guidelineId) }
        });

        // Rebuild FTS and refresh in-memory index
        try {
            await ChunkIndexService.rebuildFts();
            if (ChunkIndexService.isLoaded()) {
                const diseaseChunks = await prisma.guidelineChunk.findMany({
                    where: {
                        diseaseId: Number(diseaseId),
                        embeddingJson: { not: null }
                    },
                    select: {
                        id: true,
                        diseaseId: true,
                        guidelineId: true,
                        type: true,
                        pageStart: true,
                        pageEnd: true,
                        sectionTitle: true,
                        text: true,
                        embeddingJson: true,
                    }
                });
                ChunkIndexService.updateForGuideline(diseaseId, diseaseChunks);
            }
        } catch (e) {
            logger.warn('[DiseaseService] Failed to refresh indexes after delete:', e.message);
        }

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
                job.progress = 0;
                sendProgressEvent(jobId, { status: 'processing', fileName: job.fileName, progress: 0 });

                // Process the file
                const guideline = await this.uploadGuidelineSingle(job.diseaseId, job.pdfPath, jobId);

                job.status = 'completed';
                job.progress = 100;
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
            let metadata = { title: path.basename(pdfPath) };
            try {
                const { stdout: metaStdout } = await execPromise(`python "${metadataScript}" "${pdfPath}"`);
                metadata = JSON.parse(metaStdout);
            } catch (e) {
                // Degrade gracefully if AI/unavailable: continue with minimal metadata
                logger.warn('[DiseaseService] Metadata extraction failed, continuing without it:', e.message);
            }

            // 2. Create Chunks (for search) - Fast
            if (jobId) sendProgressEvent(jobId, { progress: 40, step: 'Creating chunks' });
            const legacyChunksScript = path.join(process.cwd(), 'scripts', 'create_chunks.py');
            const { stdout: legacyChunksStdout } = await execPromise(`python "${legacyChunksScript}" "${pdfPath}"`);
            const legacyChunks = JSON.parse(legacyChunksStdout);

            // Clinical chunks with type + overlap (for CDSS search)
            const clinicalChunksScript = path.join(process.cwd(), 'scripts', 'create_clinical_chunks.py');
            const { stdout: clinicalChunksStdout } = await execPromise(`python "${clinicalChunksScript}" "${pdfPath}" 700 100`);
            const clinicalChunks = JSON.parse(clinicalChunksStdout);

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
                    // Keep legacy JSON chunks for backward compatibility
                    chunks: JSON.stringify(legacyChunks),
                    source: 'Минздрав РФ',
                },
            });

            // 5. Save clinical chunks into normalized table (GuidelineChunk) for FTS and (optional) embeddings
            if (Array.isArray(clinicalChunks) && clinicalChunks.length > 0) {
                if (jobId) sendProgressEvent(jobId, { progress: 95, step: 'Indexing guideline chunks' });

                const rows = [];
                const canEmbed = Boolean(process.env.VITE_GEMINI_API_KEY);
                let embedEnabled = canEmbed;

                for (const chunk of clinicalChunks) {
                    const text = (chunk && chunk.text) ? String(chunk.text).trim() : '';
                    if (!text) continue;

                    const page = Number(chunk.page) || null;
                    const sectionTitle = (chunk && chunk.sectionTitle) ? String(chunk.sectionTitle).trim() : null;
                    const type = (chunk && chunk.type) ? String(chunk.type).trim() : 'other';

                    let embeddingJson = null;
                    if (embedEnabled) {
                        try {
                            const emb = await generateEmbedding(text, { rotation: 'none' });
                            if (Array.isArray(emb) && emb.length > 0) {
                                embeddingJson = JSON.stringify(emb);
                            }
                        } catch (e) {
                            // Degrade gracefully: still keep chunk for FTS.
                            embeddingJson = null;

                            // If API is blocked/limited - stop trying for remaining chunks in this upload
                            const msg = String(e && e.message ? e.message : '');
                            if (
                                msg.includes('location is not supported') ||
                                msg.includes('RESOURCE_EXHAUSTED') ||
                                msg.includes('Quota exceeded') ||
                                msg.includes('429')
                            ) {
                                embedEnabled = false;
                            }
                        }
                    }

                    rows.push({
                        guidelineId: guideline.id,
                        diseaseId: Number(diseaseId),
                        type,
                        pageStart: page,
                        pageEnd: page,
                        sectionTitle,
                        text,
                        embeddingJson
                    });
                }

                if (rows.length > 0) {
                    // Make idempotent for re-uploads in the future: remove existing chunks for this guideline
                    await prisma.guidelineChunk.deleteMany({
                        where: { guidelineId: guideline.id }
                    });

                    await prisma.guidelineChunk.createMany({
                        data: rows
                    });

                    // Rebuild FTS from scratch (no triggers — programmatic rebuild)
                    await ChunkIndexService.rebuildFts();

                    // Refresh in-memory chunk index (if loaded)
                    try {
                        if (ChunkIndexService.isLoaded()) {
                            const diseaseChunks = await prisma.guidelineChunk.findMany({
                                where: {
                                    diseaseId: Number(diseaseId),
                                    embeddingJson: { not: null }
                                },
                                select: {
                                    id: true,
                                    diseaseId: true,
                                    guidelineId: true,
                                    type: true,
                                    pageStart: true,
                                    pageEnd: true,
                                    sectionTitle: true,
                                    text: true,
                                    embeddingJson: true,
                                }
                            });
                            ChunkIndexService.updateForGuideline(diseaseId, diseaseChunks);
                        }
                    } catch (e) {
                        logger.warn('[DiseaseService] Failed to refresh ChunkIndexService after upload:', e.message);
                    }
                }
            }

            // Update disease metadata ONLY if fields are empty (prevent overwriting existing data)
            await this._updateDiseaseMetadataIfEmpty(diseaseId, metadata);

            return guideline;
        } catch (error) {
            logger.error('[DiseaseService] Failed to process/upload guideline:', error);
            throw error;
        }
    },

    /**
     * Rebuild normalized guideline chunks (GuidelineChunk + FTS triggers) for all guidelines.
     * Safe to run when AI is unavailable: embeddings will be stored only if key exists.
     */
    async reindexGuidelineChunks() {
        logger.info('[DiseaseService] Reindexing guideline chunks...');
        const canEmbed = Boolean(process.env.VITE_GEMINI_API_KEY);

        const guidelines = await prisma.clinicalGuideline.findMany({
            select: {
                id: true,
                diseaseId: true,
                pdfPath: true,
            }
        });

        for (const g of guidelines) {
            if (!g.pdfPath) continue;

            try {
                const clinicalChunksScript = path.join(process.cwd(), 'scripts', 'create_clinical_chunks.py');
                const { stdout: clinicalChunksStdout } = await execPromise(`python "${clinicalChunksScript}" "${g.pdfPath}" 700 100`);
                const clinicalChunks = JSON.parse(clinicalChunksStdout);

                await prisma.guidelineChunk.deleteMany({
                    where: { guidelineId: g.id }
                });

                if (!Array.isArray(clinicalChunks) || clinicalChunks.length === 0) {
                    continue;
                }

                const rows = [];
                for (const chunk of clinicalChunks) {
                    const text = (chunk && chunk.text) ? String(chunk.text).trim() : '';
                    if (!text) continue;

                    const page = Number(chunk.page) || null;
                    const sectionTitle = (chunk && chunk.sectionTitle) ? String(chunk.sectionTitle).trim() : null;
                    const type = (chunk && chunk.type) ? String(chunk.type).trim() : 'other';

                    let embeddingJson = null;
                    if (canEmbed) {
                        try {
                            const emb = await generateEmbedding(text, { rotation: 'none' });
                            if (Array.isArray(emb) && emb.length > 0) {
                                embeddingJson = JSON.stringify(emb);
                            }
                        } catch (_) {
                            embeddingJson = null;
                        }
                    }

                    rows.push({
                        guidelineId: g.id,
                        diseaseId: Number(g.diseaseId),
                        type,
                        pageStart: page,
                        pageEnd: page,
                        sectionTitle,
                        text,
                        embeddingJson,
                    });
                }

                if (rows.length > 0) {
                    await prisma.guidelineChunk.createMany({ data: rows });
                }
            } catch (error) {
                logger.warn(`[DiseaseService] Failed to reindex guideline ${g.id}:`, error.message);
            }
        }

        // Rebuild FTS and reload in-memory index
        try {
            await ChunkIndexService.rebuildFts();
            await ChunkIndexService.loadOnStartup();
        } catch (error) {
            logger.warn('[DiseaseService] Failed to reload indexes after reindex:', error.message);
        }

        logger.info('[DiseaseService] Reindex guideline chunks completed');
        return true;
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

        // Обновляем симптомы ТОЛЬКО если поле пустое (сохраняем в формате {text, category})
        const existingSymptoms = safeJsonParse(disease.symptoms, []);
        if (existingSymptoms.length === 0 && metadata.symptoms && metadata.symptoms.length > 0) {
            const categorized = metadata.symptoms.map(s =>
                ({ text: String(s).trim(), category: 'other' })
            ).filter(s => s.text.length > 0);
            updateData.symptoms = JSON.stringify(categorized);
            logger.info(`[DiseaseService] Adding ${categorized.length} symptoms from PDF (field was empty)`);
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

            const extractedSymptoms = Array.isArray(parsedData.symptoms) ? parsedData.symptoms : [];
            const symptomsCategorized = extractedSymptoms.map(text =>
                ({ text: String(text).trim(), category: 'other' })
            ).filter(s => s.text.length > 0);

            return {
                icd10Code: firstCode || '',
                allIcd10Codes: parsedData.icd10_codes || [],
                nameRu, // Теперь из справочника МКБ
                description: 'Извлечено из клинических рекомендаций',
                symptoms: symptomsCategorized,
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
        const symptomTexts = Array.isArray(symptoms)
            ? symptoms.map(s => (typeof s === 'string' ? s : (s && s.text) ? s.text : '')).filter(Boolean)
            : [];
        if (symptomTexts.length === 0) {
            return [];
        }

        // 1. Нормализация (словарь + опционально batch AI)
        const { normalized, source, aiUsed } = await normalizeWithAI(symptomTexts);
        logger.debug(`[DiseaseService] Normalization: ${source}, AI used: ${aiUsed}`);

        const symptomsToUse = normalized.length > 0 ? normalized : symptomTexts;
        const symptomsText = symptomsToUse.join(', ');

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
                logDegradation('search', 'Keyword');
                return this._fallbackKeywordSearch(symptomsToUse);
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
                                symptoms: _parseSymptoms(disease.symptoms),
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

            // Если semantic search не дал ни одного результата (все embeddings битые или не совпали) — fallback на поиск по ключам
            if (finalResults.length === 0) {
                logger.warn('[DiseaseService] Semantic search returned 0 results, falling back to keyword matching');
                logDegradation('search', 'Keyword');
                return this._fallbackKeywordSearch(symptomsToUse);
            }

            logDegradation('search', 'Semantic');
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
            logDegradation('search', 'Keyword');
            return this._fallbackKeywordSearch(symptomsToUse);
        }
    },

    /**
     * Fallback метод для поиска по ключевым словам (если embeddings недоступны).
     * Учитывает синонимы из cdssVocabulary: «температура» ≈ «лихорадка», «одинофагия» ≈ «боль при глотании» и т.д.
     * @private
     */
    async _fallbackKeywordSearch(symptoms) {
        const diseases = await prisma.disease.findMany();
        const queryCanonical = new Set(normalizeSymptoms(symptoms).map(n => n.toLowerCase().trim()));
        const queryRaw = symptoms.map(s => s.toLowerCase().trim());

        const results = diseases
            .map(d => {
                const dParsed = _parseSymptoms(d.symptoms);
                const dTexts = dParsed.map(s => s.text);
                const dCanonical = new Set(normalizeSymptoms(dTexts).map(n => n.toLowerCase().trim()));

                const matchByCanonical = [...queryCanonical].filter(qc => dCanonical.has(qc)).length;
                const matchBySubstring = queryRaw.filter(s =>
                    dTexts.some(ds => ds.toLowerCase().includes(s)) ||
                    d.nameRu.toLowerCase().includes(s)
                ).length;
                const matchesCount = Math.max(matchByCanonical, matchBySubstring);

                return {
                    disease: {
                        ...d,
                        symptoms: dParsed,
                        icd10Codes: JSON.parse(d.icd10Codes || '[]')
                    },
                    score: matchesCount / Math.max(symptoms.length, 1)
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
