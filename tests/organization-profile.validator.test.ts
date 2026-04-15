import { describe, expect, it } from 'vitest';
import { OrganizationProfileSchema } from '../src/validators/organization.validator';

describe('OrganizationProfileSchema', () => {
    it('accepts a valid profile and normalizes empty optional fields to null', () => {
        const result = OrganizationProfileSchema.parse({
            id: 1,
            name: 'Детская поликлиника №1',
            legalName: '   ',
            address: 'г. Москва, ул. Тестовая, д. 1',
            phone: ' +7 (495) 123-45-67 ',
            email: '   ',
        });

        expect(result.name).toBe('Детская поликлиника №1');
        expect(result.legalName).toBeNull();
        expect(result.email).toBeNull();
        expect(result.phone).toBe('+7 (495) 123-45-67');
    });

    it('rejects empty organization name', () => {
        expect(() =>
            OrganizationProfileSchema.parse({
                name: '   ',
            })
        ).toThrow();
    });

    it('rejects invalid email format', () => {
        expect(() =>
            OrganizationProfileSchema.parse({
                name: 'Тест',
                email: 'wrong-email',
            })
        ).toThrow();
    });
});
