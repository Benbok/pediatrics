import { z } from 'zod';

export const UserRoleKeySchema = z.enum(['admin', 'doctor']);

export const RegisterUserInputSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6),
  lastName: z.string().min(1, 'Фамилия обязательна').max(100),
  firstName: z.string().max(100).optional().default(''),
  middleName: z.string().max(100).optional().default(''),
  isAdmin: z.boolean().default(false),
});

export const UpdateUserInputSchema = z.object({
  userId: z.number().int().positive(),
  username: z.string().min(3).max(50),
  lastName: z.string().min(1, 'Фамилия обязательна').max(100),
  firstName: z.string().max(100).optional().default(''),
  middleName: z.string().max(100).optional().default(''),
  isActive: z.boolean(),
});

export const SetUserRolesInputSchema = z.object({
  userId: z.number().int().positive(),
  roles: z.array(UserRoleKeySchema).min(1),
});

export const ResetPasswordInputSchema = z.object({
  userId: z.number().int().positive(),
  newPassword: z.string().min(6),
});

