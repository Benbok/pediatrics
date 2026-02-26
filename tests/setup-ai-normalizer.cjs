/**
 * Setup for ai-symptom-normalizer tests: inject mock logger so CJS require() gets it.
 * Must run before the test file loads the normalizer.
 */
const path = require('path');
const Module = require('module');

const projectRoot = path.resolve(__dirname, '..');
const servicesDir = path.join(projectRoot, 'electron', 'services');
const loggerPath = require.resolve('../logger.cjs', { paths: [servicesDir] });

const apiKeyManagerPath = require.resolve('./apiKeyManager.cjs', { paths: [servicesDir] });

// Important: resolve paths the same way as real code does.
// Most services call require('../prisma-client.cjs') or require('../modules/...') from inside electron/services.
const prismaClientPath = require.resolve('../prisma-client.cjs', { paths: [servicesDir] });
const diseasesServicePath = require.resolve('../modules/diseases/service.cjs', { paths: [servicesDir] });

const mockExports = {
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    logDegradation: () => {},
};

Module._cache[loggerPath] = {
    exports: mockExports,
    loaded: true,
    filename: loggerPath,
    id: loggerPath,
    parent: null,
    children: [],
    paths: Module._nodeModulePaths(projectRoot),
};

// Avoid Electron dependency in apiKeyManager (it uses electron.app.getPath)
// For unit tests we keep it disabled by default.
// For opt-in live tests (RUN_LIVE_AI_TESTS=1) we provide a minimal manager that uses GEMINI_API_KEYS.
const runLive = process.env.RUN_LIVE_AI_TESTS === '1';

function makeTestApiKeyManager() {
    const keysString = process.env.GEMINI_API_KEYS || '';
    const keys = keysString.split(',').map(k => k.trim()).filter(Boolean);
    let idx = 0;

    return {
        getActiveKey() {
            if (!keys.length) throw new Error('No keys in GEMINI_API_KEYS');
            return keys[idx % keys.length];
        },
        async retryWithRotation(operation, maxAttempts = 5) {
            if (!keys.length) throw new Error('No keys in GEMINI_API_KEYS');
            let attempts = 0;
            let lastErr = null;
            const total = Math.min(Number(maxAttempts) || 1, keys.length);

            while (attempts < total) {
                const key = keys[idx % keys.length];
                try {
                    return await operation(key);
                } catch (e) {
                    lastErr = e;
                    idx = (idx + 1) % keys.length;
                    attempts += 1;
                }
            }

            throw lastErr || new Error('retryWithRotation failed');
        },
    };
}

Module._cache[apiKeyManagerPath] = {
    exports: { apiKeyManager: runLive ? makeTestApiKeyManager() : null },
    loaded: true,
    filename: apiKeyManagerPath,
    id: apiKeyManagerPath,
    parent: null,
    children: [],
    paths: Module._nodeModulePaths(projectRoot),
};

globalThis.__mockPrisma = globalThis.__mockPrisma || {};
globalThis.__mockDiseaseService = globalThis.__mockDiseaseService || {};

Module._cache[prismaClientPath] = {
    exports: {
        prisma: {
            clinicalGuideline: {
                findMany: async (...args) => {
                    const impl = globalThis.__mockPrisma.clinicalGuideline?.findMany;
                    if (impl) return impl(...args);
                    return [];
                },
            },
            disease: {
                findMany: async (...args) => {
                    const impl = globalThis.__mockPrisma.disease?.findMany;
                    if (impl) return impl(...args);
                    return [];
                },
            },
            guidelineChunk: {
                findMany: async (...args) => {
                    const impl = globalThis.__mockPrisma.guidelineChunk?.findMany;
                    if (impl) return impl(...args);
                    return [];
                },
            },
            $queryRawUnsafe: async (...args) => {
                const impl = globalThis.__mockPrisma.$queryRawUnsafe;
                if (impl) return impl(...args);
                return [];
            },
            $executeRawUnsafe: async (...args) => {
                const impl = globalThis.__mockPrisma.$executeRawUnsafe;
                if (impl) return impl(...args);
                return 0;
            },
            $disconnect: async () => {},
        },
    },
    loaded: true,
    filename: prismaClientPath,
    id: prismaClientPath,
    parent: null,
    children: [],
    paths: Module._nodeModulePaths(projectRoot),
};

Module._cache[diseasesServicePath] = {
    exports: {
        DiseaseService: {
            searchBySymptoms: async (...args) => {
                const impl = globalThis.__mockDiseaseService.searchBySymptoms;
                if (impl) return impl(...args);
                return [];
            },
        },
    },
    loaded: true,
    filename: diseasesServicePath,
    id: diseasesServicePath,
    parent: null,
    children: [],
    paths: Module._nodeModulePaths(projectRoot),
};
