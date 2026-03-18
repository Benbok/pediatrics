import { z } from 'zod';

export const HeredityDataSchema = z.object({
  tuberculosis: z.boolean().default(false),
  tuberculosisDetails: z.string().optional().nullable(),
  diabetes: z.boolean().default(false),
  diabetesDetails: z.string().optional().nullable(),
  hypertension: z.boolean().default(false),
  hypertensionDetails: z.string().optional().nullable(),
  oncology: z.boolean().default(false),
  oncologyDetails: z.string().optional().nullable(),
  allergies: z.boolean().default(false),
  allergiesDetails: z.string().optional().nullable(),
  other: z.string().optional().nullable(),
});

export const BirthDataSchema = z.object({
  pregnancyCourse: z.string().optional().nullable(),
  obstetricalHistory: z.string().optional().nullable(),
  deliveryMethod: z.enum(['natural', 'cesarean']).optional().nullable(),
  gestationalAge: z.number()
    .min(20)
    .max(45)
    .refine((val) => {
      if (val === null || val === undefined) return true;
      // Проверяем, что дробная часть (дни) не превышает 6
      const weeks = Math.floor(val);
      const daysDecimal = val - weeks;
      const days = Math.round(daysDecimal * 10);
      return days <= 6;
    }, {
      message: 'Дни в неделе не могут превышать 6 (например, 38,7 автоматически станет 39,0)'
    })
    .optional()
    .nullable(),
  birthWeight: z.number().min(500).max(7000).optional().nullable(),
  birthHeight: z.number().min(20).max(70).optional().nullable(),
  apgarScore: z.string()
    .regex(/^\d{1,2}\/\d{1,2}(\/\d{1,2})?$/, 'Формат Апгар: 8/8 или 8/8/8')
    .optional()
    .nullable(),
  neonatalComplications: z.boolean().optional().nullable(),
  neonatalComplicationsDetails: z.string().optional().nullable(),
});

export const FeedingDataSchema = z.object({
  breastfeeding: z.enum(['yes', 'no', 'mixed']).optional().nullable(),
  breastfeedingFrom: z.string().optional().nullable(),
  breastfeedingTo: z.string().optional().nullable(),
  formulaName: z.string().optional().nullable(),
  complementaryFoodAge: z.number().min(0).max(24).optional().nullable(),
  nutritionFeatures: z.string().optional().nullable(),
});

export const InfectiousDiseaseEntrySchema = z.object({
  had: z.boolean().default(false),
  ageYears: z.number().min(0).max(18).optional().nullable(),
});

export const InfectiousDiseasesDataSchema = z.object({
  measles: InfectiousDiseaseEntrySchema.optional(),
  chickenpox: InfectiousDiseaseEntrySchema.optional(),
  rubella: InfectiousDiseaseEntrySchema.optional(),
  pertussis: InfectiousDiseaseEntrySchema.optional(),
  scarletFever: InfectiousDiseaseEntrySchema.optional(),
  tonsillitis: z.object({
    had: z.boolean().default(false),
    perYear: z.number().min(0).max(50).optional().nullable(),
  }).optional(),
  other: z.string().optional().nullable(),
});

export const AllergyStatusDataSchema = z.object({
  food: z.string().optional().nullable(),
  medication: z.string().optional().nullable(),
  materials: z.string().optional().nullable(),
  insectBites: z.string().optional().nullable(),
  seasonal: z.string().optional().nullable(),
});
