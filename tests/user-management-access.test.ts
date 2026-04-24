import { describe, expect, it } from 'vitest';

const {
    hasAdminRole,
    canViewUsersModule,
    canEditUserProfile,
    validateRolesAssignment,
} = require('../electron/modules/users/access.cjs');

describe('User management access rules', () => {
    const admin = { id: 1, roles: ['admin', 'doctor'] };
    const doctor = { id: 2, roles: ['doctor'] };

    it('allows users module view for authenticated user', () => {
        expect(canViewUsersModule(doctor)).toBe(true);
        expect(canViewUsersModule(admin)).toBe(true);
    });

    it('detects admin role correctly', () => {
        expect(hasAdminRole(admin)).toBe(true);
        expect(hasAdminRole(doctor)).toBe(false);
    });

    it('allows doctor to edit only own profile', () => {
        expect(canEditUserProfile(doctor, 2)).toBe(true);
        expect(canEditUserProfile(doctor, 1)).toBe(false);
    });

    it('allows admin to edit all profiles including own', () => {
        expect(canEditUserProfile(admin, 1)).toBe(true);
        expect(canEditUserProfile(admin, 2)).toBe(true);
    });

    it('blocks doctor from assigning self admin role', () => {
        const result = validateRolesAssignment(doctor, 2, ['doctor', 'admin']);
        expect(result.ok).toBe(false);
        expect(result.error).toContain('администратора');
    });

    it('allows doctor to keep own doctor role', () => {
        const result = validateRolesAssignment(doctor, 2, ['doctor']);
        expect(result.ok).toBe(true);
    });

    it('allows admin to assign roles for any user', () => {
        const result = validateRolesAssignment(admin, 2, ['admin', 'doctor']);
        expect(result.ok).toBe(true);
    });

    it('blocks doctor from changing roles for another user', () => {
        const result = validateRolesAssignment(doctor, 1, ['doctor']);
        expect(result.ok).toBe(false);
        expect(result.error).toContain('Недостаточно прав');
    });
});
