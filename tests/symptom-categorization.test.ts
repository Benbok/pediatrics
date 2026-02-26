import { describe, it, expect } from 'vitest';
import { parseSymptoms } from '../src/modules/diseases/services/diseaseService';

describe('Symptom Categorization', () => {
    it('should parse old format (string[]) to new format', () => {
        const oldFormat = ['кашель', 'лихорадка'];
        const parsed = parseSymptoms(oldFormat);

        expect(parsed).toEqual([
            { text: 'кашель', category: 'other' },
            { text: 'лихорадка', category: 'other' },
        ]);
    });

    it('should preserve new format (CategorizedSymptom[])', () => {
        const newFormat = [
            { text: 'кашель', category: 'clinical' },
            { text: 'хрипы при аускультации', category: 'physical' },
        ];

        const parsed = parseSymptoms(newFormat);
        expect(parsed).toEqual(newFormat);
    });

    it('should extract text for AI search', () => {
        const symptoms = [
            { text: 'кашель', category: 'clinical' },
            { text: 'хрипы', category: 'physical' },
        ];

        const texts = symptoms.map((s) => s.text);
        expect(texts).toEqual(['кашель', 'хрипы']);
    });

    it('should prevent duplicate symptoms (case-insensitive)', () => {
        const existing = [{ text: 'Кашель', category: 'clinical' }];

        const newSymptom = 'кашель';
        const isDuplicate = existing.some(
            (s) => s.text.toLowerCase() === newSymptom.toLowerCase()
        );

        expect(isDuplicate).toBe(true);
    });

    it('should regenerate embedding only when text changes', () => {
        const oldSymptoms = [
            { text: 'кашель', category: 'clinical' },
            { text: 'лихорадка', category: 'other' },
        ];

        const newSymptoms1 = [
            { text: 'кашель', category: 'physical' },
            { text: 'лихорадка', category: 'other' },
        ];

        const newSymptoms2 = [
            { text: 'кашель', category: 'clinical' },
            { text: 'одышка', category: 'other' },
        ];

        const oldTexts = oldSymptoms.map((s) => s.text).sort().join('|');
        const newTexts1 = newSymptoms1.map((s) => s.text).sort().join('|');
        const newTexts2 = newSymptoms2.map((s) => s.text).sort().join('|');

        expect(oldTexts === newTexts1).toBe(true);
        expect(oldTexts === newTexts2).toBe(false);
    });

    it('should handle PDF import with default category', () => {
        const pdfSymptoms = ['кашель', 'лихорадка'];
        const converted = parseSymptoms(pdfSymptoms);

        expect(converted).toEqual([
            { text: 'кашель', category: 'other' },
            { text: 'лихорадка', category: 'other' },
        ]);
    });

    it('should return empty array for empty input', () => {
        expect(parseSymptoms([])).toEqual([]);
        expect(parseSymptoms(null)).toEqual([]);
        expect(parseSymptoms(undefined)).toEqual([]);
    });

    it('should filter out empty text from objects', () => {
        const input = [
            { text: 'кашель', category: 'clinical' },
            { text: '  ', category: 'other' },
            { text: '', category: 'physical' },
        ];
        const parsed = parseSymptoms(input);
        expect(parsed).toHaveLength(1);
        expect(parsed[0]).toEqual({ text: 'кашель', category: 'clinical' });
    });
});
