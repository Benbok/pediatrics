import { z } from 'zod';

const optionalText = (max: number) =>
    z.preprocess((value) => {
        if (value === null || value === undefined) return null;
        const normalized = String(value).trim();
        return normalized.length > 0 ? normalized : null;
    }, z.string().max(max).nullable());

export const OrganizationProfileSchema = z.object({
    id: z.number().int().min(1).max(1).optional(),
    name: z.string().trim().min(1, 'Название организации обязательно').max(200),
    legalName: optionalText(300).optional(),
    department: optionalText(200).optional(),
    address: optionalText(500).optional(),
    phone: optionalText(50).optional(),
    email: z.preprocess((value) => {
        if (value === null || value === undefined) return null;
        const normalized = String(value).trim();
        return normalized.length > 0 ? normalized : null;
    }, z.string().email('Некорректный email').max(200).nullable()).optional(),
    website: optionalText(250).optional(),
    inn: optionalText(20).optional(),
    ogrn: optionalText(20).optional(),
    chiefDoctor: optionalText(200).optional(),
});

export type OrganizationProfileInput = z.infer<typeof OrganizationProfileSchema>;
