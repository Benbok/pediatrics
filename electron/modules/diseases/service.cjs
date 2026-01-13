const { prisma } = require('../../prisma-client.cjs');
const { logger } = require('../../logger.cjs');
const { z } = require('zod');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const util = require('util');
const execPromise = util.promisify(exec);

// Disease Validation Schema
const DiseaseSchema = z.object({
    id: z.number().optional(),
    icd10Code: z.string().min(3).max(10),
    icd10Codes: z.array(z.string()).default([]),
    nameRu: z.string().min(2),
    nameEn: z.string().optional().nullable(),
    description: z.string(),
    symptoms: z.array(z.string()).default([]),
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
        return await prisma.disease.findUnique({
            where: { id: Number(id) },
            include: {
                guidelines: true,
            },
        });

        if (!disease) return null;

        // Parse ICD codes from disease
        const diseaseIcd10Codes = JSON.parse(disease.icd10Codes || '[]');
        const allCodes = [disease.icd10Code, ...diseaseIcd10Codes];

        // Find medications matching these ICD codes
        const { MedicationService } = require('../medications/service.cjs');
        const relatedMedications = await MedicationService.getByIcd10Codes(allCodes);

        return {
            ...disease,
            icd10Codes: diseaseIcd10Codes,
            relatedMedications
        };
    },

    /**
     * Create or update disease
     */
    async upsert(data) {
        const validated = DiseaseSchema.parse(data);
        const { id, ...rest } = validated;

        if (id) {
            return await prisma.disease.update({
                where: { id },
                data: {
                    ...rest,
                    icd10Codes: JSON.stringify(rest.icd10Codes),
                    symptoms: JSON.stringify(rest.symptoms),
                },
            });
        }

        return await prisma.disease.create({
            data: {
                ...rest,
                icd10Codes: JSON.stringify(rest.icd10Codes),
                symptoms: JSON.stringify(rest.symptoms),
            },
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
     * Parse PDF guideline and save it
     */
    async uploadGuideline(diseaseId, pdfPath) {
        logger.info(`[DiseaseService] Processing PDF: ${pdfPath} for disease ${diseaseId}`);

        try {
            // 1. Get Metadata (title, codes, symptoms) - Fast
            const metadataScript = path.join(process.cwd(), 'scripts', 'parse_pdf.py');
            const { stdout: metaStdout } = await execPromise(`python "${metadataScript}" "${pdfPath}"`);
            const metadata = JSON.parse(metaStdout);

            // 2. Create Chunks (for search) - Fast
            const chunksScript = path.join(process.cwd(), 'scripts', 'create_chunks.py');
            const { stdout: chunksStdout } = await execPromise(`python "${chunksScript}" "${pdfPath}"`);
            const chunks = JSON.parse(chunksStdout);

            // 3. Copy file to permanent storage
            const storageDir = path.join(app.getPath('userData'), 'clinical_guidelines');
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }

            const ext = path.extname(pdfPath) || '.pdf';
            const fileName = `guideline_${diseaseId}_${Date.now()}${ext}`;
            const destPath = path.join(storageDir, fileName);
            fs.copyFileSync(pdfPath, destPath);

            // 4. Save to database
            const guideline = await prisma.clinicalGuideline.create({
                data: {
                    diseaseId: Number(diseaseId),
                    title: metadata.title || `Клинические рекомендации: ${path.basename(pdfPath)}`,
                    pdfPath: destPath,
                    content: metadata.description || 'Клинические рекомендации в формате PDF',
                    chunks: JSON.stringify(chunks),
                    source: 'Минздрав РФ',
                },
            });

            // Update disease metadata if found
            const updateData = {};
            if (metadata.symptoms && metadata.symptoms.length > 0) {
                updateData.symptoms = JSON.stringify(metadata.symptoms);
            }
            if (metadata.icd10_codes && metadata.icd10_codes.length > 0) {
                updateData.icd10Codes = JSON.stringify(metadata.icd10_codes);
            }

            if (Object.keys(updateData).length > 0) {
                await prisma.disease.update({
                    where: { id: Number(diseaseId) },
                    data: updateData
                });
            }

            return guideline;
        } catch (error) {
            logger.error('[DiseaseService] Failed to process/upload guideline:', error);
            throw error;
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

            return {
                icd10Code: parsedData.icd10_codes?.[0] || '',
                allIcd10Codes: parsedData.icd10_codes || [],
                nameRu: parsedData.title || path.basename(pdfPath, path.extname(pdfPath)),
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
     * Semantic search (placeholder for now, will integrate Gemini later)
     */
    async searchBySymptoms(symptoms) {
        // Basic keyword matching as fallback
        const diseases = await prisma.disease.findMany();
        return diseases.filter(d => {
            const dSymptoms = JSON.parse(d.symptoms || '[]');
            return symptoms.some(s => dSymptoms.includes(s.toLowerCase()));
        });
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
                        fullName: true
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
