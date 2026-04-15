import { describe, it, expect } from 'vitest';
import { InfectiousDiseaseEntrySchema, InfectiousDiseasesDataSchema } from '../src/validators/anamnesis025.validator';

describe('InfectiousDiseaseEntry — ageYears + ageMonths validation', () => {
    it('accepts valid ageYears (0–18) and ageMonths (0–11)', () => {
        const result = InfectiousDiseaseEntrySchema.safeParse({ had: true, ageYears: 5, ageMonths: 7 });
        expect(result.success).toBe(true);
    });

    it('rejects ageYears > 18', () => {
        const result = InfectiousDiseaseEntrySchema.safeParse({ had: true, ageYears: 19 });
        expect(result.success).toBe(false);
    });

    it('rejects ageYears < 0', () => {
        const result = InfectiousDiseaseEntrySchema.safeParse({ had: true, ageYears: -1 });
        expect(result.success).toBe(false);
    });

    it('rejects ageMonths > 11', () => {
        const result = InfectiousDiseaseEntrySchema.safeParse({ had: true, ageMonths: 12 });
        expect(result.success).toBe(false);
    });

    it('rejects ageMonths < 0', () => {
        const result = InfectiousDiseaseEntrySchema.safeParse({ had: true, ageMonths: -1 });
        expect(result.success).toBe(false);
    });

    it('rejects non-integer ageYears', () => {
        const result = InfectiousDiseaseEntrySchema.safeParse({ had: true, ageYears: 2.5 });
        expect(result.success).toBe(false);
    });

    it('rejects non-integer ageMonths', () => {
        const result = InfectiousDiseaseEntrySchema.safeParse({ had: true, ageMonths: 3.7 });
        expect(result.success).toBe(false);
    });

    it('accepts null values for ageYears and ageMonths', () => {
        const result = InfectiousDiseaseEntrySchema.safeParse({ had: false, ageYears: null, ageMonths: null });
        expect(result.success).toBe(true);
    });

    it('accepts omitted age fields', () => {
        const result = InfectiousDiseaseEntrySchema.safeParse({ had: false });
        expect(result.success).toBe(true);
    });

    it('validates full InfectiousDiseasesData with ageMonths', () => {
        const result = InfectiousDiseasesDataSchema.safeParse({
            measles: { had: true, ageYears: 3, ageMonths: 2 },
            chickenpox: { had: false },
        });
        expect(result.success).toBe(true);
    });
});
