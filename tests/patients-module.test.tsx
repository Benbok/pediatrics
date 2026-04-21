// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { PatientsModule } from '../src/modules/patients/PatientsModule';

const mockNavigate = vi.fn();
const mockSetSelectedChild = vi.fn();

vi.mock('react-router-dom', () => ({
    useNavigate: () => mockNavigate,
}));

vi.mock('../src/context/ChildContext', () => ({
    useChild: () => ({
        setSelectedChild: mockSetSelectedChild,
    }),
}));

describe('PatientsModule', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        Object.defineProperty(window, 'electronAPI', {
            configurable: true,
            writable: true,
            value: {
                getChildren: vi.fn().mockResolvedValue([
                    {
                        id: 1,
                        surname: 'Иванов',
                        name: 'Иван',
                        patronymic: 'Иванович',
                        birthDate: '2020-05-10',
                        gender: 'male',
                        createdAt: '2026-04-10T09:15:00.000Z',
                    },
                    {
                        id: 2,
                        surname: 'Петрова',
                        name: 'Анна',
                        patronymic: 'Сергеевна',
                        birthDate: '2021-02-12',
                        gender: 'female',
                        createdAt: '2026-04-18T14:30:00.000Z',
                    },
                ]),
            },
        });
    });

    it('renders loaded patients and creation metadata', async () => {
        render(<PatientsModule />);

        expect(await screen.findByText(/Иванов Иван/i)).toBeInTheDocument();
        expect(screen.getByText(/Петрова Анна/i)).toBeInTheDocument();
        expect(screen.getAllByText(/Дата создания:/i).length).toBeGreaterThan(1);
        expect(screen.getByText(/Всего пациентов/i)).toBeInTheDocument();
    });

    it('combines search and createdAt range filters', async () => {
        render(<PatientsModule />);

        await screen.findByText(/Иванов Иван/i);

        fireEvent.change(screen.getByPlaceholderText(/Фамилия, имя или отчество/i), {
            target: { value: 'Петрова' },
        });

        await waitFor(() => {
            expect(screen.queryByText(/Иванов Иван/i)).not.toBeInTheDocument();
            expect(screen.getByText(/Петрова Анна/i)).toBeInTheDocument();
        });

        const dateInputs = screen.getAllByPlaceholderText('дд.мм.гггг');
        fireEvent.change(dateInputs[0], { target: { value: '19.04.2026' } });

        await waitFor(() => {
            expect(screen.queryByText(/Петрова Анна/i)).not.toBeInTheDocument();
            expect(screen.getByText(/Пациенты не найдены/i)).toBeInTheDocument();
        });

        fireEvent.click(screen.getAllByRole('button', { name: /Сбросить фильтры/i })[0]);

        await waitFor(() => {
            expect(screen.getByText(/Иванов Иван/i)).toBeInTheDocument();
            expect(screen.getByText(/Петрова Анна/i)).toBeInTheDocument();
        });
    });
});