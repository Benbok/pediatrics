import { z } from 'zod';
import {
    HepBRiskFactor,
    PneumoRiskFactor,
    PertussisContraindication,
    PolioRiskFactor,
    MMRContraindication,
    MeningoRiskFactor,
    VaricellaRiskFactor,
    HepARiskFactor,
    FluRiskFactor,
    HpvRiskFactor,
    TbeRiskFactor,
    RotavirusRiskFactor
} from '../types';

export const VaccinationProfileSchema = z.object({
    id: z.number().optional(),
    childId: z.number(),
    hepBRiskFactors: z.array(z.nativeEnum(HepBRiskFactor)).optional(),
    pneumoRiskFactors: z.array(z.nativeEnum(PneumoRiskFactor)).optional(),
    pertussisContraindications: z.array(z.nativeEnum(PertussisContraindication)).optional(),
    polioRiskFactors: z.array(z.nativeEnum(PolioRiskFactor)).optional(),
    mmrContraindications: z.array(z.nativeEnum(MMRContraindication)).optional(),
    meningRiskFactors: z.array(z.nativeEnum(MeningoRiskFactor)).optional(),
    varicellaRiskFactors: z.array(z.nativeEnum(VaricellaRiskFactor)).optional(),
    hepaRiskFactors: z.array(z.nativeEnum(HepARiskFactor)).optional(),
    fluRiskFactors: z.array(z.nativeEnum(FluRiskFactor)).optional(),
    hpvRiskFactors: z.array(z.nativeEnum(HpvRiskFactor)).optional(),
    tbeRiskFactors: z.array(z.nativeEnum(TbeRiskFactor)).optional(),
    rotaRiskFactors: z.array(z.nativeEnum(RotavirusRiskFactor)).optional(),
    mantouxDate: z.string().nullable().optional()
        .refine((date) => !date || (new Date(date) <= new Date()), 'Дата Манту не может быть в будущем'),
    mantouxResult: z.boolean().nullable().optional(),
    customVaccines: z.array(z.any()).optional(),
});

export type VaccinationProfileInput = z.infer<typeof VaccinationProfileSchema>;
