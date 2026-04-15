import { describe, expect, it } from 'vitest';
import { toggleRecommendationSelection } from '../src/modules/visits/utils/recommendationSelection';

describe('toggleRecommendationSelection', () => {
    it('adds a recommendation when it is not selected yet', () => {
        expect(toggleRecommendationSelection(['Пить больше жидкости'], 'Контроль температуры')).toEqual([
            'Пить больше жидкости',
            'Контроль температуры',
        ]);
    });

    it('removes a recommendation when it is selected already', () => {
        expect(toggleRecommendationSelection(['Пить больше жидкости', 'Контроль температуры'], 'Контроль температуры')).toEqual([
            'Пить больше жидкости',
        ]);
    });

    it('ignores blank input after trimming', () => {
        expect(toggleRecommendationSelection(['Пить больше жидкости'], '   ')).toEqual([
            'Пить больше жидкости',
        ]);
    });
});
