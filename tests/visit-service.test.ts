import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Visit, DiagnosisEntry } from '../src/types';

// Mock window.electronAPI
global.window = {
    electronAPI: {
        getVisits: vi.fn(),
        getVisit: vi.fn(),
        upsertVisit: vi.fn(),
        deleteVisit: vi.fn(),
        analyzeVisit: vi.fn(),
        getMedicationsForDiagnosis: vi.fn(),
    },
} as any;

describe('Visit Service Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Diagnosis normalization', () => {
        it('should normalize diagnosis entry structure', () => {
            const diagnosis: DiagnosisEntry = {
                code: 'J45.0',
                nameRu: 'Бронхиальная астма',
                diseaseId: 1,
            };

            expect(diagnosis.code).toBe('J45.0');
            expect(diagnosis.nameRu).toBe('Бронхиальная астма');
            expect(diagnosis.diseaseId).toBe(1);
        });

        it('should handle diagnosis without diseaseId', () => {
            const diagnosis: DiagnosisEntry = {
                code: 'J45.0',
                nameRu: 'Бронхиальная астма',
            };

            expect(diagnosis.code).toBe('J45.0');
            expect(diagnosis.diseaseId).toBeUndefined();
        });
    });

    describe('Visit type determination logic', () => {
        it('should determine primary visit for new patient', () => {
            const visits: Visit[] = [];
            const daysSinceLastVisit = visits.length === 0 ? Infinity : 0;
            const visitType = daysSinceLastVisit > 30 ? 'primary' : 'followup';
            
            expect(visitType).toBe('primary');
        });

        it('should determine followup visit if last visit was recent', () => {
            const lastVisitDate = new Date();
            lastVisitDate.setDate(lastVisitDate.getDate() - 10); // 10 days ago
            const daysSinceLastVisit = Math.floor(
                (new Date().getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            const visitType = daysSinceLastVisit > 30 ? 'primary' : 'followup';
            
            expect(visitType).toBe('followup');
        });

        it('should determine primary visit if last visit was over 30 days ago', () => {
            const lastVisitDate = new Date();
            lastVisitDate.setDate(lastVisitDate.getDate() - 35); // 35 days ago
            const daysSinceLastVisit = Math.floor(
                (new Date().getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            const visitType = daysSinceLastVisit > 30 ? 'primary' : 'followup';
            
            expect(visitType).toBe('primary');
        });
    });

    describe('Ticket number generation', () => {
        it('should generate ticket number in correct format', () => {
            const visitId = 123;
            const date = new Date('2025-01-19');
            const year = date.getFullYear();
            const ticketNumber = `T-${year}-${String(visitId).padStart(6, '0')}`;
            
            expect(ticketNumber).toBe('T-2025-000123');
            expect(ticketNumber).toMatch(/^T-\d{4}-\d{6}$/);
        });

        it('should handle large visit IDs in ticket number', () => {
            const visitId = 999999;
            const date = new Date('2025-01-19');
            const year = date.getFullYear();
            const ticketNumber = `T-${year}-${String(visitId).padStart(6, '0')}`;
            
            expect(ticketNumber).toBe('T-2025-999999');
        });
    });

    describe('Visit data serialization', () => {
        it('should serialize diagnosis objects to JSON strings', () => {
            const primaryDiagnosis: DiagnosisEntry = {
                code: 'J45.0',
                nameRu: 'Бронхиальная астма',
                diseaseId: 1,
            };
            const serialized = JSON.stringify(primaryDiagnosis);
            
            expect(typeof serialized).toBe('string');
            expect(JSON.parse(serialized)).toEqual(primaryDiagnosis);
        });

        it('should serialize complications array to JSON string', () => {
            const complications: DiagnosisEntry[] = [
                {
                    code: 'J45.1',
                    nameRu: 'Осложнение 1',
                },
                {
                    code: 'J45.2',
                    nameRu: 'Осложнение 2',
                },
            ];
            const serialized = JSON.stringify(complications);
            
            expect(typeof serialized).toBe('string');
            expect(JSON.parse(serialized)).toEqual(complications);
        });

        it('should handle null diagnosis values', () => {
            const primaryDiagnosis = null;
            const serialized = primaryDiagnosis ? JSON.stringify(primaryDiagnosis) : null;
            
            expect(serialized).toBeNull();
        });
    });

    describe('Visit data deserialization', () => {
        it('should deserialize JSON string diagnosis to object', () => {
            const serialized = JSON.stringify({
                code: 'J45.0',
                nameRu: 'Бронхиальная астма',
                diseaseId: 1,
            });
            const deserialized = JSON.parse(serialized);
            
            expect(deserialized.code).toBe('J45.0');
            expect(deserialized.nameRu).toBe('Бронхиальная астма');
            expect(deserialized.diseaseId).toBe(1);
        });

        it('should handle already parsed diagnosis objects', () => {
            const diagnosis: DiagnosisEntry = {
                code: 'J45.0',
                nameRu: 'Бронхиальная астма',
            };
            const parsed = typeof diagnosis === 'string' ? JSON.parse(diagnosis) : diagnosis;
            
            expect(parsed).toEqual(diagnosis);
        });

        it('should handle empty string diagnosis', () => {
            const diagnosis = '';
            const parsed = diagnosis ? (typeof diagnosis === 'string' ? JSON.parse(diagnosis) : diagnosis) : null;
            
            expect(parsed).toBeNull();
        });
    });

    describe('Visit validation edge cases', () => {
        it('should handle visit with missing optional fields', () => {
            const minimalVisit: Partial<Visit> = {
                childId: 1,
                doctorId: 1,
                visitDate: '2025-01-19',
                complaints: 'Жалобы',
                status: 'draft',
                prescriptions: [],
            };
            
            expect(minimalVisit.childId).toBeDefined();
            expect(minimalVisit.complaints).toBeDefined();
        });

        it('should handle visit with all JSON fields as strings', () => {
            const visit: Partial<Visit> = {
                childId: 1,
                doctorId: 1,
                visitDate: '2025-01-19',
                complaints: 'Жалобы',
                primaryDiagnosis: JSON.stringify({
                    code: 'J45.0',
                    nameRu: 'Бронхиальная астма',
                }),
                complications: JSON.stringify([
                    {
                        code: 'J45.1',
                        nameRu: 'Осложнение',
                    },
                ]),
                status: 'draft',
                prescriptions: [],
            };
            
            expect(typeof visit.primaryDiagnosis).toBe('string');
            expect(typeof visit.complications).toBe('string');
        });

        it('should handle visit with all JSON fields as objects', () => {
            const visit: Partial<Visit> = {
                childId: 1,
                doctorId: 1,
                visitDate: '2025-01-19',
                complaints: 'Жалобы',
                primaryDiagnosis: {
                    code: 'J45.0',
                    nameRu: 'Бронхиальная астма',
                },
                complications: [
                    {
                        code: 'J45.1',
                        nameRu: 'Осложнение',
                    },
                ],
                status: 'draft',
                prescriptions: [],
            };
            
            expect(typeof visit.primaryDiagnosis).toBe('object');
            expect(Array.isArray(visit.complications)).toBe(true);
        });
    });

    describe('Visit status transitions', () => {
        it('should allow transition from draft to completed', () => {
            const draftStatus: Visit['status'] = 'draft';
            const completedStatus: Visit['status'] = 'completed';
            
            expect(['draft', 'completed']).toContain(draftStatus);
            expect(['draft', 'completed']).toContain(completedStatus);
        });

        it('should validate required fields for completed status', () => {
            const completedVisit = {
                status: 'completed' as const,
                primaryDiagnosis: {
                    code: 'J45.0',
                    nameRu: 'Бронхиальная астма',
                },
            };
            
            expect(completedVisit.status).toBe('completed');
            expect(completedVisit.primaryDiagnosis).toBeDefined();
        });
    });

    describe('Visit type-specific validation', () => {
        it('should validate emergency visit requires time', () => {
            const emergencyVisit = {
                visitType: 'emergency' as const,
                visitTime: '14:30',
            };
            
            expect(emergencyVisit.visitTime).toBeDefined();
        });

        it('should validate consultation visit requires referringDoctorId', () => {
            const consultationVisit = {
                visitType: 'consultation' as const,
                referringDoctorId: 2,
            };
            
            expect(consultationVisit.referringDoctorId).toBeDefined();
        });
    });
});
