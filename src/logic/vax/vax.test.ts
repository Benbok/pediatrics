import { describe, it, expect } from 'vitest';
import { calculateVaccineSchedule } from './index';
import { ChildProfile, VaccinationProfile, VaccineStatus, HepBRiskFactor } from '../../types';
import { VACCINE_SCHEDULE } from '../../constants';

describe('calculateVaccineSchedule', () => {
    const mockChild: ChildProfile = {
        name: 'Иван',
        surname: 'Иванов',
        birthDate: new Date().toISOString().split('T')[0], // Today
        birthWeight: 3500,
        gender: 'male',
    };

    const mockProfile: VaccinationProfile = {
        childId: 1,
        hepBRiskFactors: [],
        customVaccines: [],
    };

    it('should mark BCG as DUE_NOW for a newborn', () => {
        const schedule = calculateVaccineSchedule(mockChild, mockProfile, [], VACCINE_SCHEDULE);
        const bcg = schedule.find(v => v.id === 'bcg-1');

        expect(bcg).toBeDefined();
        // BCG is planned at 0 months, so it should be due now
        expect(bcg?.status).toBe(VaccineStatus.DUE_NOW);
    });

    it('should mark a vaccine as COMPLETED if a record exists', () => {
        const records = [{
            vaccineId: 'bcg-1',
            isCompleted: true,
            completedDate: mockChild.birthDate,
        }];

        const schedule = calculateVaccineSchedule(mockChild, mockProfile, records, VACCINE_SCHEDULE);
        const bcg = schedule.find(v => v.id === 'bcg-1');

        expect(bcg?.status).toBe(VaccineStatus.COMPLETED);
    });

    it('should handle Hepatitis B risk group filtering', () => {
        // Standard schedule (no risk) has 3 doses: hepB-1, hepB-2, hepB-6
        const standardSchedule = calculateVaccineSchedule(mockChild, mockProfile, [], VACCINE_SCHEDULE);
        const hepBVaccinesNormal = standardSchedule.filter(v => v.id.startsWith('hepb'));

        expect(hepBVaccinesNormal.length).toBe(3);

        // Risk group schedule has 4 doses: hepB-risk-1, hepB-risk-2, hepB-risk-2-5, hepB-risk-12
        const riskProfile = { ...mockProfile, hepBRiskFactors: [HepBRiskFactor.MOTHER_HBSAG] };
        const riskSchedule = calculateVaccineSchedule(mockChild, riskProfile, [], VACCINE_SCHEDULE);
        const hepBVaccinesRisk = riskSchedule.filter(v => v.id.startsWith('hepb'));

        expect(hepBVaccinesRisk.length).toBe(4);
    });

    it('should support combined vaccines (Pentaxim)', () => {
        const records = [{
            vaccineId: 'dtp-1', // User marked DTP-1
            isCompleted: true,
            completedDate: '2023-01-01',
            vaccineBrand: 'Пентаксим'
        }];

        // Set child age so dtp-1 is in the past
        const olderChild = { ...mockChild, birthDate: '2022-10-01' };

        const schedule = calculateVaccineSchedule(olderChild, mockProfile, records, VACCINE_SCHEDULE);

        // Pentaxim covers Polio-1 and Hib-1 (if not excluded)
        const polio1 = schedule.find(v => v.id === 'polio-1');
        const hib1 = schedule.find(v => v.id === 'hib-1');

        expect(polio1?.status).toBe(VaccineStatus.COMPLETED);
        expect(polio1?.userRecord?.notes).toContain('В составе Пентаксим');

        expect(hib1?.status).toBe(VaccineStatus.COMPLETED);
        expect(hib1?.userRecord?.notes).toContain('В составе Пентаксим');
    });

    it('should mark vaccines as OVERDUE if older than 1 month past due', () => {
        const veryOldChild = { ...mockChild, birthDate: '2020-01-01' };
        const schedule = calculateVaccineSchedule(veryOldChild, mockProfile, [], VACCINE_SCHEDULE);

        const bcg = schedule.find(v => v.id === 'bcg-1');
        expect(bcg?.status).toBe(VaccineStatus.OVERDUE);
    });
});
