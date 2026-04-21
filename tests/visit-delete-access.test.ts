import { describe, expect, it } from 'vitest';

const { assertCanDeleteVisit } = require('../electron/modules/visits/access.cjs');

describe('Visit delete access', () => {
    it('allows admin to delete another doctor visit', () => {
        expect(() => assertCanDeleteVisit(
            { id: 99, roles: ['admin'] },
            { id: 10, doctorId: 5 }
        )).not.toThrow();
    });

    it('allows visit owner to delete own visit', () => {
        expect(() => assertCanDeleteVisit(
            { id: 5, roles: ['doctor'] },
            { id: 10, doctorId: 5 }
        )).not.toThrow();
    });

    it('blocks authenticated non-owner without admin role', () => {
        expect(() => assertCanDeleteVisit(
            { id: 7, roles: ['doctor'] },
            { id: 10, doctorId: 5 }
        )).toThrow('Недостаточно прав для удаления приема');
    });

    it('blocks deletion when visit does not exist', () => {
        expect(() => assertCanDeleteVisit(
            { id: 7, roles: ['doctor'] },
            null
        )).toThrow('Прием не найден');
    });
});