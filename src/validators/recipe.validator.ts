import { z } from 'zod';

/**
 * Zod-схема для элемента рецепта (Rp./D.S.)
 */
const RecipeItemSchema = z.object({
    rpLine: z.string().min(1, 'Строка Rp. обязательна'),
    dsLine: z.string().min(1, 'Строка D.S. обязательна'),
});

/**
 * Zod-схема для данных пациента в рецепте
 */
const RecipePatientInfoSchema = z.object({
    fullName: z.string().min(1, 'ФИО пациента обязательно'),
    birthDate: z.string().min(1, 'Дата рождения обязательна'),
    ageText: z.string().optional(),
});

/**
 * Zod-схема для данных врача в рецепте
 */
const RecipeDoctorInfoSchema = z.object({
    fullName: z.string().min(1, 'ФИО врача обязательно'),
});

/**
 * Zod-схема для данных клиники в рецепте
 */
const RecipeClinicInfoSchema = z.object({
    organizationStamp: z.string().min(1, 'Наименование организации обязательно'),
    ipStamp: z.string().optional(),
    okudCode: z.string().optional(),
    okpoCode: z.string().optional(),
});

/**
 * Полная Zod-схема для Recipe107PrintData
 */
export const Recipe107Schema = z.object({
    issueDate: z.string().min(1, 'Дата выписки рецепта обязательна'),
    patient: RecipePatientInfoSchema,
    doctor: RecipeDoctorInfoSchema,
    clinic: RecipeClinicInfoSchema,
    items: z
        .array(RecipeItemSchema)
        .min(1, 'Необходимо хотя бы одно назначение')
        .max(6, 'На одном листе рецепта не более 6 назначений (по 3 в каждой колонке)'),  
    validityPeriod: z.enum(['60days', '1year', 'custom']),
    customValidityDays: z.number().int().min(1).max(365).optional(),
    isPreferential: z.boolean(),
});

export type Recipe107SchemaType = z.infer<typeof Recipe107Schema>;
