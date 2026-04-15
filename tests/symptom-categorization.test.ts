import { describe, it, expect } from 'vitest';
import { parseSymptoms } from '../src/modules/diseases/services/diseaseService';

const { normalizeSymptomsToCategorized } = require('../electron/utils/diseaseNormalization.cjs');

describe('Symptom Categorization', () => {
    it('should parse old format (string[]) to new format', () => {
        const oldFormat = ['кашель', 'лихорадка'];
        const parsed = parseSymptoms(oldFormat);

        expect(parsed).toEqual([
            expect.objectContaining({ text: 'кашель', category: 'other' }),
            expect.objectContaining({ text: 'лихорадка', category: 'other' }),
        ]);
    });

    it('should preserve new format (CategorizedSymptom[])', () => {
        const newFormat = [
            { text: 'кашель', category: 'clinical' },
            { text: 'хрипы при аускультации', category: 'physical' },
        ];

        const parsed = parseSymptoms(newFormat);
        expect(parsed).toEqual(newFormat.map(s => expect.objectContaining(s)));
    });

    it('should preserve laboratory category in frontend parsing', () => {
        const newFormat = [
            { text: 'СРБ > 30 мг/л', category: 'laboratory' },
        ];

        const parsed = parseSymptoms(newFormat);
        expect(parsed).toEqual(newFormat.map(s => expect.objectContaining(s)));
    });

    it('should preserve laboratory category in backend normalization', () => {
        const normalized = normalizeSymptomsToCategorized([
            { text: 'Лейкоцитоз', category: 'laboratory' },
        ]);

        expect(normalized).toEqual([
            expect.objectContaining({ text: 'Лейкоцитоз', category: 'laboratory' }),
        ]);
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
            expect.objectContaining({ text: 'кашель', category: 'other' }),
            expect.objectContaining({ text: 'лихорадка', category: 'other' }),
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
        expect(parsed[0]).toEqual(expect.objectContaining({ text: 'кашель', category: 'clinical' }));
    });

    it('should preserve long paragraph text without vocabulary replacement (backend)', () => {
        // Regression test: long descriptive text must NOT be replaced by a short vocabulary
        // canonical via substring token matching (e.g. "температурой" → "Лихорадка").
        const longText =
            'Острое начало заболевания с невысокой (субфебрильной) температурой, катаральными явлениями в виде ринита, фарингита или ларингита, осиплостью голоса';
        const normalized = normalizeSymptomsToCategorized([
            { text: longText, category: 'clinical' },
        ]);
        expect(normalized).toEqual([expect.objectContaining({ text: longText, category: 'clinical' })]);
    });

    it('should not deduplicate distinct long texts that share vocabulary tokens', () => {
        // Two different clinical descriptions both mention "температур" — they must remain distinct.
        const text1 = 'Острое начало с субфебрильной температурой и ринитом';
        const text2 = 'Постепенное начало с высокой температурой и кашлем';
        const normalized = normalizeSymptomsToCategorized([
            { text: text1, category: 'clinical' },
            { text: text2, category: 'clinical' },
        ]);
        expect(normalized).toHaveLength(2);
        expect(normalized[0].text).toBe(text1);
        expect(normalized[1].text).toBe(text2);
    });
});
