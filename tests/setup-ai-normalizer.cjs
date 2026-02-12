/**
 * Setup for ai-symptom-normalizer tests: inject mock logger so CJS require() gets it.
 * Must run before the test file loads the normalizer.
 */
const path = require('path');
const Module = require('module');

const projectRoot = path.resolve(__dirname, '..');
const servicesDir = path.join(projectRoot, 'electron', 'services');
const loggerPath = require.resolve('../logger.cjs', { paths: [servicesDir] });

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
