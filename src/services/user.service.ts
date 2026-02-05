import { logger } from './logger';
import type { User, UserRoleKey } from '../types';
import {
  RegisterUserInputSchema,
  ResetPasswordInputSchema,
  SetUserRolesInputSchema,
  UpdateUserInputSchema,
} from '../validators/user.validator';

export const userService = {
  async getAllUsers(): Promise<User[]> {
    return await window.electronAPI.getAllUsers();
  },

  async registerUser(data: { username: string; password: string; lastName: string; firstName?: string; middleName?: string; isAdmin: boolean }) {
    const validated = RegisterUserInputSchema.parse(data);
    return await window.electronAPI.registerUser(validated);
  },

  async updateUser(data: { userId: number; username: string; lastName: string; firstName?: string; middleName?: string; isActive: boolean }) {
    const validated = UpdateUserInputSchema.parse(data);
    return await window.electronAPI.updateUser(validated);
  },

  async setUserRoles(data: { userId: number; roles: UserRoleKey[] }) {
    const validated = SetUserRolesInputSchema.parse(data);
    return await window.electronAPI.setUserRoles(validated);
  },

  async resetPassword(data: { userId: number; newPassword: string }) {
    const validated = ResetPasswordInputSchema.parse(data);
    return await window.electronAPI.resetPassword(validated);
  },

  async activateUser(userId: number) {
    return await window.electronAPI.activateUser(userId);
  },

  async deactivateUser(userId: number) {
    return await window.electronAPI.deactivateUser(userId);
  },

  hasRole(user: User | null | undefined, role: UserRoleKey): boolean {
    if (!user) return false;
    if (!Array.isArray(user.roles)) return false;
    return user.roles.includes(role);
  },

  async safeLoadAllUsers(): Promise<User[]> {
    try {
      return await this.getAllUsers();
    } catch (error) {
      logger.error('[userService] Failed to load users', { error });
      return [];
    }
  },
};

