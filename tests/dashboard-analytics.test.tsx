// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Dashboard } from '../src/modules/dashboard/Dashboard';
import { dashboardService } from '../src/services/dashboard.service';

vi.mock('react-router-dom', () => ({
    Link: ({ children, to, ...props }: any) => <a href={to} {...props}>{children}</a>,
}));

vi.mock('../src/context/AuthContext', () => ({
    useAuth: () => ({
        currentUser: {
            firstName: 'Анна',
            lastName: 'Педиатр',
        },
    }),
}));

describe('Dashboard analytics', () => {
    const getDashboardSummary = vi.fn();
    const getDashboardVisitAnalytics = vi.fn();

    const toIsoDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    beforeEach(() => {
        vi.clearAllMocks();

        const manyPatients = Array.from({ length: 12 }, (_, index) => ({
            childId: index + 1,
            visitsCount: 1,
            lastVisitId: index + 101,
            lastVisitDate: `2026-04-${String((index % 9) + 10).padStart(2, '0')}`,
            lastVisitTime: '10:00',
            child: {
                id: index + 1,
                name: `Имя${index + 1}`,
                surname: `Пациент${index + 1}`,
                birthDate: '2021-02-12',
            },
        }));

        getDashboardSummary.mockResolvedValue({
            visitsToday: [],
            visitsTodayCount: 2,
            patientsTodayCount: 2,
            weeklyVisitsCount: 5,
        });

        getDashboardVisitAnalytics.mockImplementation(async (range: { dateFrom: string; dateTo: string }) => ({
            dateFrom: range.dateFrom,
            dateTo: range.dateTo,
            totalVisitsCount: range.dateFrom === '2026-04-05' ? 1 : range.dateFrom === '2026-03-01' ? 12 : 3,
            uniquePatientsCount: range.dateFrom === '2026-04-05' ? 1 : range.dateFrom === '2026-03-01' ? 12 : 2,
            completedVisitsCount: 2,
            draftVisitsCount: range.dateFrom === '2026-04-05' ? 0 : range.dateFrom === '2026-03-01' ? 3 : 1,
            patients: range.dateFrom === '2026-04-05'
                ? [
                    {
                        childId: 2,
                        visitsCount: 1,
                        lastVisitId: 22,
                        lastVisitDate: '2026-04-06',
                        lastVisitTime: '09:30',
                        child: {
                            id: 2,
                            name: 'Анна',
                            surname: 'Петрова',
                            birthDate: '2021-02-12',
                        },
                    },
                ]
                : range.dateFrom === '2026-03-01'
                    ? manyPatients
                : [
                    {
                        childId: 1,
                        visitsCount: 2,
                        lastVisitId: 11,
                        lastVisitDate: '2026-04-18',
                        lastVisitTime: '10:00',
                        child: {
                            id: 1,
                            name: 'Иван',
                            surname: 'Иванов',
                            birthDate: '2020-05-10',
                        },
                    },
                    {
                        childId: 2,
                        visitsCount: 1,
                        lastVisitId: 12,
                        lastVisitDate: '2026-04-16',
                        lastVisitTime: '13:30',
                        child: {
                            id: 2,
                            name: 'Анна',
                            surname: 'Петрова',
                            birthDate: '2021-02-12',
                        },
                    },
                ],
        }));

        Object.defineProperty(window, 'electronAPI', {
            configurable: true,
            writable: true,
            value: {
                getDashboardSummary,
                getDashboardVisitAnalytics,
                updateVisitNotes: vi.fn().mockResolvedValue(true),
                log: vi.fn().mockResolvedValue(undefined),
            },
        });
    });

    it('renders analytics block and reloads it when date range changes', async () => {
        render(<Dashboard />);

        expect(await screen.findByText(/Статистика за период/i)).toBeInTheDocument();
        expect(await screen.findByText(/Иванов Иван/i)).toBeInTheDocument();
        expect(screen.getByText(/Петрова Анна/i)).toBeInTheDocument();
        expect(screen.getByText(/Всего приёмов/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Перейти к приёму пациента Иванов Иван/i })).toHaveAttribute('href', '/patients/1/visits/11');

        const now = new Date();
        const expectedInitialDateTo = toIsoDate(now);
        const expectedInitialDateFrom = toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1));

        await waitFor(() => {
            expect(getDashboardVisitAnalytics).toHaveBeenCalledWith({
                dateFrom: expectedInitialDateFrom,
                dateTo: expectedInitialDateTo,
            });
        });

        const dateInputs = screen.getAllByPlaceholderText('дд.мм.гггг');
        fireEvent.change(dateInputs[0], { target: { value: '05.04.2026' } });

        await waitFor(() => {
            expect(getDashboardVisitAnalytics).toHaveBeenLastCalledWith({
                dateFrom: '2026-04-05',
                dateTo: expectedInitialDateTo,
            });
        });

        await waitFor(() => {
            expect(screen.getByText(/1 приём/i)).toBeInTheDocument();
        });

        expect(screen.getByRole('link', { name: /Перейти к приёму пациента Петрова Анна/i })).toHaveAttribute('href', '/patients/2/visits/22');
    });

    it('shows pagination controls when analytics list exceeds ten patients', async () => {
        render(<Dashboard />);

        const dateInputs = await screen.findAllByPlaceholderText('дд.мм.гггг');
        fireEvent.change(dateInputs[0], { target: { value: '01.03.2026' } });

        await waitFor(() => {
            expect(screen.getByText(/Страница 1 \/ 2/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/Показано 1-10 из 12/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Перейти к приёму пациента Пациент1 Имя1/i })).toHaveAttribute('href', '/patients/1/visits/101');
        expect(screen.queryByText(/Пациент11 Имя11/i)).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: /Вперёд/i }));

        await waitFor(() => {
            expect(screen.getByText(/Страница 2 \/ 2/i)).toBeInTheDocument();
        });

        expect(screen.getByText(/Показано 11-12 из 12/i)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Перейти к приёму пациента Пациент11 Имя11/i })).toHaveAttribute('href', '/patients/11/visits/111');
        expect(screen.queryByText(/Пациент1 Имя1/i)).not.toBeInTheDocument();
    });

    it('rejects inverted analytics ranges before IPC call', async () => {
        await expect(
            dashboardService.getVisitAnalytics({
                dateFrom: '2026-04-10',
                dateTo: '2026-04-01',
            })
        ).rejects.toThrow(/Дата начала не может быть позже даты окончания/i);

        expect(getDashboardVisitAnalytics).not.toHaveBeenCalled();
    });
});