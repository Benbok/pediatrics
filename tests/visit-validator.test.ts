import { describe, it, expect } from 'vitest';
import {
    VisitSchema,
    PrimaryVisitSchema,
    FollowupVisitSchema,
    ConsultationVisitSchema,
    EmergencyVisitSchema,
    UrgentVisitSchema,
    getVisitSchemaByType,
    DiagnosisEntrySchema,
} from '../src/validators/visit.validator';

describe('Visit Validator', () => {
    describe('DiagnosisEntrySchema', () => {
        it('should validate valid diagnosis entry', () => {
            const valid = {
                code: 'J45.0',
                nameRu: 'Бронхиальная астма',
                diseaseId: 1,
            };
            expect(() => DiagnosisEntrySchema.parse(valid)).not.toThrow();
        });

        it('should validate diagnosis entry without diseaseId', () => {
            const valid = {
                code: 'J45.0',
                nameRu: 'Бронхиальная астма',
            };
            expect(() => DiagnosisEntrySchema.parse(valid)).not.toThrow();
        });

        it('should reject invalid ICD code format', () => {
            const invalid = {
                code: 'INVALID',
                nameRu: 'Test',
            };
            expect(() => DiagnosisEntrySchema.parse(invalid)).toThrow();
        });

        it('should reject missing required fields', () => {
            const invalid = {
                code: 'J45.0',
            };
            expect(() => DiagnosisEntrySchema.parse(invalid)).toThrow();
        });
    });

    describe('VisitSchema', () => {
        const baseVisit = {
            childId: 1,
            doctorId: 1,
            visitDate: '2025-01-19',
            complaints: 'Жалобы пациента',
            status: 'draft' as const,
            prescriptions: [],
        };

        it('should validate minimal valid visit', () => {
            expect(() => VisitSchema.parse(baseVisit)).not.toThrow();
        });

        it('should validate visit with all optional fields', () => {
            const fullVisit = {
                ...baseVisit,
                visitType: 'primary' as const,
                visitPlace: 'clinic' as const,
                visitTime: '10:00',
                ticketNumber: 'T-001',
                diseaseHistory: 'История заболевания',
                lifeHistory: 'История жизни',
                allergyHistory: 'Аллергологический анамнез',
                previousDiseases: 'Перенесенные заболевания',
                bloodPressureSystolic: 120,
                bloodPressureDiastolic: 80,
                pulse: 72,
                respiratoryRate: 18,
                temperature: 36.6,
                oxygenSaturation: 98,
                consciousnessLevel: 'ясное',
                generalCondition: 'удовлетворительное',
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
                comorbidities: [
                    {
                        code: 'E11.9',
                        nameRu: 'Сахарный диабет',
                    },
                ],
            };
            expect(() => VisitSchema.parse(fullVisit)).not.toThrow();
        });

        it('should validate JSON string diagnosis fields', () => {
            const visitWithJsonDiagnoses = {
                ...baseVisit,
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
            };
            expect(() => VisitSchema.parse(visitWithJsonDiagnoses)).not.toThrow();
        });

        it('should reject visit without required complaints', () => {
            const invalid = {
                ...baseVisit,
                complaints: '',
            };
            expect(() => VisitSchema.parse(invalid)).toThrow();
        });

        it('should reject visit with invalid date format', () => {
            const invalid = {
                ...baseVisit,
                visitDate: '19.01.2025', // Wrong format
            };
            expect(() => VisitSchema.parse(invalid)).toThrow();
        });

        it('should reject systolic BP less than diastolic', () => {
            const invalid = {
                ...baseVisit,
                bloodPressureSystolic: 80,
                bloodPressureDiastolic: 120,
            };
            expect(() => VisitSchema.parse(invalid)).toThrow();
        });

        it('should reject duplicate complication codes', () => {
            const invalid = {
                ...baseVisit,
                complications: [
                    {
                        code: 'J45.0',
                        nameRu: 'First',
                    },
                    {
                        code: 'J45.0',
                        nameRu: 'Second',
                    },
                ],
            };
            expect(() => VisitSchema.parse(invalid)).toThrow();
        });

        it('should reject duplicate comorbidity codes', () => {
            const invalid = {
                ...baseVisit,
                comorbidities: [
                    {
                        code: 'E11.9',
                        nameRu: 'First',
                    },
                    {
                        code: 'E11.9',
                        nameRu: 'Second',
                    },
                ],
            };
            expect(() => VisitSchema.parse(invalid)).toThrow();
        });

        it('should validate vital signs ranges', () => {
            const valid = {
                ...baseVisit,
                pulse: 72, // Valid range: 30-250
                respiratoryRate: 18, // Valid range: 10-60
                temperature: 36.6, // Valid range: 30.0-45.0
                oxygenSaturation: 98, // Valid range: 0-100
            };
            expect(() => VisitSchema.parse(valid)).not.toThrow();
        });

        it('should reject out-of-range pulse', () => {
            const invalid = {
                ...baseVisit,
                pulse: 300, // Out of range
            };
            expect(() => VisitSchema.parse(invalid)).toThrow();
        });

        it('should reject out-of-range temperature', () => {
            const invalid = {
                ...baseVisit,
                temperature: 50.0, // Out of range
            };
            expect(() => VisitSchema.parse(invalid)).toThrow();
        });
    });

    describe('PrimaryVisitSchema', () => {
        const basePrimary = {
            childId: 1,
            doctorId: 1,
            visitDate: '2025-01-19',
            complaints: 'Жалобы',
            visitType: 'primary' as const,
            status: 'draft' as const,
            prescriptions: [],
        };

        it('should validate valid primary visit', () => {
            expect(() => PrimaryVisitSchema.parse(basePrimary)).not.toThrow();
        });

        it('should require complaints for primary visit', () => {
            const invalid = {
                ...basePrimary,
                complaints: '',
            };
            expect(() => PrimaryVisitSchema.parse(invalid)).toThrow();
        });

        it('should require diagnosis when status is completed', () => {
            const invalid = {
                ...basePrimary,
                status: 'completed' as const,
                primaryDiagnosis: null,
            };
            expect(() => PrimaryVisitSchema.parse(invalid)).toThrow();
        });

        it('should validate primary visit with diagnosis when completed', () => {
            const valid = {
                ...basePrimary,
                status: 'completed' as const,
                primaryDiagnosis: {
                    code: 'J45.0',
                    nameRu: 'Бронхиальная астма',
                },
            };
            expect(() => PrimaryVisitSchema.parse(valid)).not.toThrow();
        });
    });

    describe('FollowupVisitSchema', () => {
        const baseFollowup = {
            childId: 1,
            doctorId: 1,
            visitDate: '2025-01-19',
            complaints: 'Жалобы',
            visitType: 'followup' as const,
            status: 'draft' as const,
            prescriptions: [],
        };

        it('should validate valid followup visit', () => {
            expect(() => FollowupVisitSchema.parse(baseFollowup)).not.toThrow();
        });

        it('should require complaints for followup visit', () => {
            const invalid = {
                ...baseFollowup,
                complaints: '',
            };
            expect(() => FollowupVisitSchema.parse(invalid)).toThrow();
        });
    });

    describe('ConsultationVisitSchema', () => {
        const baseConsultation = {
            childId: 1,
            doctorId: 1,
            visitDate: '2025-01-19',
            complaints: 'Жалобы',
            visitType: 'consultation' as const,
            referringDoctorId: 2,
            status: 'draft' as const,
            prescriptions: [],
        };

        it('should validate valid consultation visit', () => {
            expect(() => ConsultationVisitSchema.parse(baseConsultation)).not.toThrow();
        });

        it('should require referringDoctorId for consultation', () => {
            const invalid = {
                ...baseConsultation,
                referringDoctorId: undefined,
            };
            expect(() => ConsultationVisitSchema.parse(invalid)).toThrow();
        });

        it('should require diagnosis when consultation is completed', () => {
            const invalid = {
                ...baseConsultation,
                status: 'completed' as const,
                primaryDiagnosis: null,
            };
            expect(() => ConsultationVisitSchema.parse(invalid)).toThrow();
        });
    });

    describe('EmergencyVisitSchema', () => {
        const baseEmergency = {
            childId: 1,
            doctorId: 1,
            visitDate: '2025-01-19',
            visitTime: '14:30',
            complaints: 'Жалобы',
            visitType: 'emergency' as const,
            status: 'draft' as const,
            prescriptions: [],
            temperature: 38.5,
        };

        it('should validate valid emergency visit', () => {
            expect(() => EmergencyVisitSchema.parse(baseEmergency)).not.toThrow();
        });

        it('should require complaints or diagnosis for emergency', () => {
            const invalid = {
                ...baseEmergency,
                complaints: '',
                primaryDiagnosis: null,
            };
            expect(() => EmergencyVisitSchema.parse(invalid)).toThrow();
        });

        it('should validate emergency with diagnosis and minimal complaints', () => {
            // Для экстренного приема жалобы могут быть минимальными, но не пустыми
            // так как базовый VisitSchema требует complaints.min(1)
            // Но custom validation проверяет что есть либо жалобы, либо диагноз
            const valid = {
                ...baseEmergency,
                complaints: 'Экстренная ситуация', // Не пустая строка
                primaryDiagnosis: {
                    code: 'J45.0',
                    nameRu: 'Бронхиальная астма',
                },
            };
            expect(() => EmergencyVisitSchema.parse(valid)).not.toThrow();
        });

        it('should require visitTime for emergency', () => {
            const invalid = {
                ...baseEmergency,
                visitTime: undefined,
            };
            expect(() => EmergencyVisitSchema.parse(invalid)).toThrow();
        });
    });

    describe('UrgentVisitSchema', () => {
        const baseUrgent = {
            childId: 1,
            doctorId: 1,
            visitDate: '2025-01-19',
            visitTime: '14:30',
            complaints: 'Жалобы',
            visitType: 'urgent' as const,
            status: 'draft' as const,
            prescriptions: [],
            pulse: 90,
        };

        it('should validate valid urgent visit', () => {
            expect(() => UrgentVisitSchema.parse(baseUrgent)).not.toThrow();
        });

        it('should require visitTime for urgent visit', () => {
            const invalid = {
                ...baseUrgent,
                visitTime: undefined,
            };
            expect(() => UrgentVisitSchema.parse(invalid)).toThrow();
        });
    });

    describe('getVisitSchemaByType', () => {
        it('should return PrimaryVisitSchema for primary type', () => {
            const schema = getVisitSchemaByType('primary');
            expect(schema).toBe(PrimaryVisitSchema);
        });

        it('should return FollowupVisitSchema for followup type', () => {
            const schema = getVisitSchemaByType('followup');
            expect(schema).toBe(FollowupVisitSchema);
        });

        it('should return ConsultationVisitSchema for consultation type', () => {
            const schema = getVisitSchemaByType('consultation');
            expect(schema).toBe(ConsultationVisitSchema);
        });

        it('should return EmergencyVisitSchema for emergency type', () => {
            const schema = getVisitSchemaByType('emergency');
            expect(schema).toBe(EmergencyVisitSchema);
        });

        it('should return UrgentVisitSchema for urgent type', () => {
            const schema = getVisitSchemaByType('urgent');
            expect(schema).toBe(UrgentVisitSchema);
        });

        it('should return VisitSchema for unknown type', () => {
            const schema = getVisitSchemaByType('unknown');
            expect(schema).toBe(VisitSchema);
        });

        it('should return VisitSchema for null type', () => {
            const schema = getVisitSchemaByType(null);
            expect(schema).toBe(VisitSchema);
        });
    });
});
