import { describe, it, expect } from 'vitest';
import { VisitSchema, AnalyzeVisitSchema } from '../src/validators/visit.validator';
import { MedicationSchema, CalculateDoseSchema, LinkMedicationToDiseaseSchema } from '../src/validators/medication.validator';
import { PdfNoteSchema, PdfNoteUpdateSchema } from '../src/validators/pdfNote.validator';

describe('Visit Validators', () => {
    describe('VisitSchema', () => {
        it('should validate a valid visit', () => {
            const validVisit = {
                childId: 1,
                doctorId: 1,
                visitDate: '2024-01-15',
                complaints: 'Кашель, насморк',
                status: 'draft',
                prescriptions: [],
            };

            const result = VisitSchema.safeParse(validVisit);
            expect(result.success).toBe(true);
        });

        it('should reject visit with invalid date format', () => {
            const invalidVisit = {
                childId: 1,
                doctorId: 1,
                visitDate: '2024/01/15',
                complaints: 'Test',
                status: 'draft',
            };

            const result = VisitSchema.safeParse(invalidVisit);
            expect(result.success).toBe(false);
        });

        it('should reject visit without complaints', () => {
            const invalidVisit = {
                childId: 1,
                doctorId: 1,
                visitDate: '2024-01-15',
                complaints: '',
                status: 'draft',
            };

            const result = VisitSchema.safeParse(invalidVisit);
            expect(result.success).toBe(false);
        });

        it('should reject visit with invalid status', () => {
            const invalidVisit = {
                childId: 1,
                doctorId: 1,
                visitDate: '2024-01-15',
                complaints: 'Test',
                status: 'invalid',
            };

            const result = VisitSchema.safeParse(invalidVisit);
            expect(result.success).toBe(false);
        });

        it('should validate visit with optional fields', () => {
            const visitWithOptionals = {
                childId: 1,
                doctorId: 1,
                visitDate: '2024-01-15',
                complaints: 'Test',
                status: 'completed',
                currentWeight: 25.5,
                currentHeight: 120,
                bmi: 17.7,
                bsa: 0.95,
                physicalExam: 'Норма',
                primaryDiagnosisId: 1,
            };

            const result = VisitSchema.safeParse(visitWithOptionals);
            expect(result.success).toBe(true);
        });
    });

    describe('AnalyzeVisitSchema', () => {
        it('should validate valid visit ID', () => {
            const result = AnalyzeVisitSchema.safeParse({ visitId: 1 });
            expect(result.success).toBe(true);
        });

        it('should reject invalid visit ID', () => {
            const result = AnalyzeVisitSchema.safeParse({ visitId: 0 });
            expect(result.success).toBe(false);
        });
    });
});

describe('Medication Validators', () => {
    describe('MedicationSchema', () => {
        it('should validate a valid medication', () => {
            const validMedication = {
                nameRu: 'Парацетамол',
                activeSubstance: 'Парацетамол',
                icd10Codes: ['J00'],
                contraindications: 'Гиперчувствительность',
                forms: [],
                pediatricDosing: [],
                indications: [],
            };

            const result = MedicationSchema.safeParse(validMedication);
            expect(result.success).toBe(true);
        });

        it('should reject medication without nameRu', () => {
            const invalidMedication = {
                activeSubstance: 'Парацетамол',
                contraindications: 'Test',
            };

            const result = MedicationSchema.safeParse(invalidMedication);
            expect(result.success).toBe(false);
        });

        it('should reject medication without contraindications', () => {
            const invalidMedication = {
                nameRu: 'Парацетамол',
                activeSubstance: 'Парацетамол',
            };

            const result = MedicationSchema.safeParse(invalidMedication);
            expect(result.success).toBe(false);
        });

        it('should validate medication with optional fields', () => {
            const medicationWithOptionals = {
                nameRu: 'Парацетамол',
                nameEn: 'Paracetamol',
                activeSubstance: 'Парацетамол',
                contraindications: 'Test',
                clinicalPharmGroup: 'Анальгетик',
                minInterval: 4,
                maxDosesPerDay: 4,
                routeOfAdmin: 'oral',
            };

            const result = MedicationSchema.safeParse(medicationWithOptionals);
            expect(result.success).toBe(true);
        });

        it('should allow medication without icd10Codes (optional field)', () => {
            const medicationWithoutIcd = {
                nameRu: 'Парацетамол',
                activeSubstance: 'Парацетамол',
                contraindications: 'Test',
            };

            const result = MedicationSchema.safeParse(medicationWithoutIcd);
            expect(result.success).toBe(true);
            // icd10Codes должен быть undefined, а не пустым массивом
            expect(result.data?.icd10Codes).toBeUndefined();
        });
    });

    describe('CalculateDoseSchema', () => {
        it('should validate valid dose calculation params', () => {
            const validParams = {
                medicationId: 1,
                weight: 20.5,
                ageMonths: 24,
                height: 85,
            };

            const result = CalculateDoseSchema.safeParse(validParams);
            expect(result.success).toBe(true);
        });

        it('should reject invalid weight', () => {
            const invalidParams = {
                medicationId: 1,
                weight: 0.3,
                ageMonths: 24,
            };

            const result = CalculateDoseSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });

        it('should reject negative age', () => {
            const invalidParams = {
                medicationId: 1,
                weight: 20,
                ageMonths: -1,
            };

            const result = CalculateDoseSchema.safeParse(invalidParams);
            expect(result.success).toBe(false);
        });
    });

    describe('LinkMedicationToDiseaseSchema', () => {
        it('should validate valid link data', () => {
            const validLink = {
                diseaseId: 1,
                medicationId: 1,
                priority: 5,
                dosing: '10 мг/кг',
                duration: '7 дней',
            };

            const result = LinkMedicationToDiseaseSchema.safeParse(validLink);
            expect(result.success).toBe(true);
        });

        it('should reject link with invalid IDs', () => {
            const invalidLink = {
                diseaseId: 0,
                medicationId: 1,
            };

            const result = LinkMedicationToDiseaseSchema.safeParse(invalidLink);
            expect(result.success).toBe(false);
        });
    });
});

describe('PDF Note Validators', () => {
    it('should validate a valid PDF note', () => {
        const validNote = {
            pdfPath: 'C:\\files\\guideline.pdf',
            page: 2,
            content: 'Ключевые рекомендации на этой странице.',
        };

        const result = PdfNoteSchema.safeParse(validNote);
        expect(result.success).toBe(true);
    });

    it('should reject PDF note without content', () => {
        const invalidNote = {
            pdfPath: 'C:\\files\\guideline.pdf',
            page: 1,
            content: '',
        };

        const result = PdfNoteSchema.safeParse(invalidNote);
        expect(result.success).toBe(false);
    });

    it('should reject update without fields', () => {
        const result = PdfNoteUpdateSchema.safeParse({});
        expect(result.success).toBe(false);
    });
});
