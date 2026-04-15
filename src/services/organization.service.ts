import { OrganizationProfile } from '../types';
import { OrganizationProfileSchema } from '../validators/organization.validator';

const DEFAULT_ORGANIZATION_PROFILE: OrganizationProfile = {
    id: 1,
    name: 'Медицинская организация',
    legalName: null,
    department: null,
    address: null,
    phone: null,
    email: null,
    website: null,
    inn: null,
    ogrn: null,
    chiefDoctor: null,
};

export const organizationService = {
    async getProfile(): Promise<OrganizationProfile> {
        const api = window.electronAPI;
        if (!api?.getOrganizationProfile) {
            return DEFAULT_ORGANIZATION_PROFILE;
        }

        const result = await api.getOrganizationProfile();
        return OrganizationProfileSchema.parse(result);
    },

    async upsertProfile(profile: OrganizationProfile): Promise<OrganizationProfile> {
        const api = window.electronAPI;
        if (!api?.upsertOrganizationProfile) {
            throw new Error('Функция профиля организации недоступна');
        }

        const validated = OrganizationProfileSchema.parse({
            ...profile,
            id: 1,
        });

        const result = await api.upsertOrganizationProfile(validated);
        return OrganizationProfileSchema.parse(result);
    },
};

export const getDefaultOrganizationProfile = (): OrganizationProfile => ({
    ...DEFAULT_ORGANIZATION_PROFILE,
});
