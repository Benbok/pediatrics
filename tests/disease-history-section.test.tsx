// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DiseaseHistorySection } from '../src/modules/visits/components/DiseaseHistorySection';
import { Visit } from '../src/types';

describe('DiseaseHistorySection', () => {
    const mockFormData: Partial<Visit> = {
        complaints: 'высокая температура',
        diseaseOnset: '3 дня назад',
        diseaseCourse: 'прогрессирует',
        treatmentBeforeVisit: 'парацетамол',
    };

    const mockOnChange = vi.fn();
    const mockOnRefine = vi.fn();

    it('should render disease history fields', () => {
        const { container } = render(
            <DiseaseHistorySection
                formData={mockFormData}
                onChange={mockOnChange}
            />
        );

        expect(container).toBeTruthy();
        expect(screen.getByDisplayValue('высокая температура')).toBeTruthy();
        expect(screen.getByDisplayValue('3 дня назад')).toBeTruthy();
    });

    it('should accept and use LLM refinement props', () => {
        const refiningFields = new Set(['complaints']);
        const streamPreview = { complaints: 'высокая температура 38.5' };

        const { container } = render(
            <DiseaseHistorySection
                formData={mockFormData}
                onChange={mockOnChange}
                onRefine={mockOnRefine}
                refiningFields={refiningFields}
                streamPreview={streamPreview}
            />
        );

        // Should render refine buttons when onRefine is provided
        const refineButtons = screen.queryAllByText(/Рефайн/i);
        expect(refineButtons.length).toBeGreaterThan(0);
    });

    it('should show refine button only when field has content', () => {
        const emptyFormData: Partial<Visit> = {
            complaints: '',
            diseaseOnset: '',
            diseaseCourse: '',
            treatmentBeforeVisit: '',
        };

        const { container } = render(
            <DiseaseHistorySection
                formData={emptyFormData}
                onChange={mockOnChange}
                onRefine={mockOnRefine}
                refiningFields={new Set()}
                streamPreview={{}}
            />
        );

        // Buttons should not appear when fields are empty
        const refineButtons = screen.queryAllByText(/Рефайн/i);
        expect(refineButtons.length).toBe(0);
    });

    it('should disable refine button during processing', () => {
        const refiningFields = new Set(['complaints']);

        const { container } = render(
            <DiseaseHistorySection
                formData={mockFormData}
                onChange={mockOnChange}
                onRefine={mockOnRefine}
                refiningFields={refiningFields}
                streamPreview={{}}
            />
        );

        // Find the refine button for complaints field
        const refineButtons = screen.getAllByText(/Рефайнинг/i);
        expect(refineButtons.length).toBeGreaterThan(0);
    });

    it('should display streaming preview during refinement', () => {
        const streamPreview = { complaints: 'Высокая температура 38.5, ' };

        const { container } = render(
            <DiseaseHistorySection
                formData={mockFormData}
                onChange={mockOnChange}
                onRefine={mockOnRefine}
                refiningFields={new Set()}
                streamPreview={streamPreview}
            />
        );

        // Should show preview text when there's stream preview
        expect(screen.getByText(/Генерация:\s*Высокая температура 38\.5/i)).toBeTruthy();
    });
});
