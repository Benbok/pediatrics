'use strict';

/**
 * TASK-084 — Unit Tests: Portable License Mode
 *
 * Run: node tests/portable-license.test.cjs
 *   OR: npm run test:portable
 *
 * Uses Node.js built-in test runner (node:test, available since Node 18).
 * Patches Module._load to stub `electron` before any electron-dependent
 * module is required (anti-rollback.cjs → logger.cjs → paths.cjs → electron).
 *
 * Covers:
 *  - anti-rollback: first launch, increment, HMAC tamper, rollback detection
 *  - verifyPortableLicense: missing file, bad JSON, bad signature, wrong device
 *  - verifyLicenseAuto: v1/v2 routing
 *  - paths.cjs: exported constants, structure
 *  - Regression: verifyLicense v1 (machine-bound) unaffected
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const crypto = require('crypto');
const Module = require('module');

// ── Patch electron BEFORE any electron-dependent module loads ─────────────────
// This is necessary because logger.cjs calls getPaths() at module evaluation time,
// and paths.cjs calls app.isPackaged synchronously. Standard vitest vi.mock() does
// not intercept synchronous CJS require() calls in this transitive chain.

const TMP_BASE = path.join(os.tmpdir(), 'pedi-test-portable-base');
fs.mkdirSync(path.join(TMP_BASE, 'logs'),    { recursive: true });
fs.mkdirSync(path.join(TMP_BASE, 'backups'), { recursive: true });

const ELECTRON_MOCK = {
    app: {
        isPackaged: false,
        getPath:    () => TMP_BASE,
    },
};

const _origLoad = Module._load.bind(Module);
Module._load = function (request, ...rest) {
    if (request === 'electron') return ELECTRON_MOCK;
    return _origLoad(request, ...rest);
};

// ── Safe to require electron-dependent modules now ────────────────────────────

const {
    checkAndIncrementState,
    readState,
    verifyState,
    deriveHmacKey,
} = require('../electron/license/anti-rollback.cjs');

const {
    verifyPortableLicense,
    verifyLicenseAuto,
    verifyLicense,
} = require('../electron/license/verify.cjs');

const {
    initPaths,
    getPaths,
    PORTABLE_FLAG_FILENAME,
} = require('../electron/config/paths.cjs');

// ── Test helpers ──────────────────────────────────────────────────────────────

function makeTempDir() {
    const dir = path.join(os.tmpdir(), `pedi-test-${crypto.randomBytes(6).toString('hex')}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function removeTempDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

/**
 * Signs a payload with a given RSA private key and writes license.json.
 * Used to test signature rejection (since test key ≠ embedded production key).
 */
function writeSignedLicense(filePath, payloadObj, privateKeyPem) {
    const payloadStr = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
    const sign       = crypto.createSign('RSA-SHA256');
    sign.update(payloadStr);
    const signature  = sign.sign(privateKeyPem, 'base64');
    fs.writeFileSync(filePath, JSON.stringify({ payload: payloadStr, signature }), 'utf8');
}

// ─────────────────────────────────────────────────────────────────────────────
// anti-rollback — checkAndIncrementState
// ─────────────────────────────────────────────────────────────────────────────

describe('anti-rollback — checkAndIncrementState', () => {
    const DEVICE_ID = 'a'.repeat(64);
    const ISSUED_AT = '2026-01-01T00:00:00.000Z';
    let tmpDir;

    beforeEach(() => { tmpDir = makeTempDir(); });
    afterEach(() => removeTempDir(tmpDir));

    it('первый запуск (нет state) → создаёт state, launchCount=1, ok=true', () => {
        const sp = path.join(tmpDir, 'portable.state.json');
        assert.equal(fs.existsSync(sp), false);

        const result = checkAndIncrementState(sp, DEVICE_ID, ISSUED_AT);

        assert.equal(result.ok, true);
        assert.equal(fs.existsSync(sp), true);

        const state = readState(sp);
        assert.equal(state.launchCount, 1);
        assert.equal(typeof state.hmac, 'string');
        assert.ok(state.hmac.length > 0);
        assert.equal(state.portableDeviceId, DEVICE_ID);
    });

    it('нормальный запуск → launchCount инкрементируется, ok=true', () => {
        const sp = path.join(tmpDir, 'portable.state.json');
        checkAndIncrementState(sp, DEVICE_ID, ISSUED_AT); // launch 1
        const result = checkAndIncrementState(sp, DEVICE_ID, ISSUED_AT); // launch 2

        assert.equal(result.ok, true);
        const state = readState(sp);
        assert.equal(state.launchCount, 2);
    });

    it('подмена HMAC → tamper detected, ok=false', () => {
        const sp = path.join(tmpDir, 'portable.state.json');
        checkAndIncrementState(sp, DEVICE_ID, ISSUED_AT);

        const raw  = JSON.parse(fs.readFileSync(sp, 'utf8'));
        raw.hmac   = 'deadbeef'.repeat(8); // corrupt HMAC
        fs.writeFileSync(sp, JSON.stringify(raw), 'utf8');

        const result = checkAndIncrementState(sp, DEVICE_ID, ISSUED_AT);
        assert.equal(result.ok, false);
        assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
    });

    it('откат launchCount (HMAC не пересчитан) → tamper detected, ok=false', () => {
        const sp = path.join(tmpDir, 'portable.state.json');
        checkAndIncrementState(sp, DEVICE_ID, ISSUED_AT); // count=1
        checkAndIncrementState(sp, DEVICE_ID, ISSUED_AT); // count=2

        // Roll back without recomputing HMAC
        const raw       = JSON.parse(fs.readFileSync(sp, 'utf8'));
        raw.launchCount = 1;
        fs.writeFileSync(sp, JSON.stringify(raw), 'utf8');

        const result = checkAndIncrementState(sp, DEVICE_ID, ISSUED_AT);
        assert.equal(result.ok, false);
    });

    it('state с другим deviceId → tamper detected', () => {
        const sp = path.join(tmpDir, 'portable.state.json');
        checkAndIncrementState(sp, DEVICE_ID, ISSUED_AT);

        const result = checkAndIncrementState(sp, 'b'.repeat(64), ISSUED_AT);
        assert.equal(result.ok, false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// anti-rollback — verifyState (pure function)
// ─────────────────────────────────────────────────────────────────────────────

describe('anti-rollback — verifyState', () => {
    const DEVICE_ID = 'c'.repeat(64);
    const ISSUED_AT = '2026-01-01T00:00:00.000Z';

    it('повреждённый state (нет hmac) → ok=false', () => {
        const result = verifyState({ launchCount: 1, portableDeviceId: DEVICE_ID }, DEVICE_ID, ISSUED_AT);
        assert.equal(result.ok, false);
    });

    it('другой portableDeviceId в state → ok=false', () => {
        const key  = deriveHmacKey(DEVICE_ID, ISSUED_AT);
        const body = { launchCount: 1, lastLaunchAt: ISSUED_AT, portableDeviceId: DEVICE_ID };
        const hmac = crypto
            .createHmac('sha256', key)
            .update(JSON.stringify(body, Object.keys(body).sort()))
            .digest('hex');

        const result = verifyState(
            { ...body, hmac, portableDeviceId: 'd'.repeat(64) },
            DEVICE_ID, ISSUED_AT,
        );
        assert.equal(result.ok, false);
    });

    it('корректный state с правильным HMAC → ok=true', () => {
        const key  = deriveHmacKey(DEVICE_ID, ISSUED_AT);
        const body = { launchCount: 5, lastLaunchAt: ISSUED_AT, portableDeviceId: DEVICE_ID };
        const hmac = crypto
            .createHmac('sha256', key)
            .update(JSON.stringify(body, Object.keys(body).sort()))
            .digest('hex');

        const result = verifyState({ ...body, hmac }, DEVICE_ID, ISSUED_AT);
        assert.equal(result.ok, true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyPortableLicense — negative cases
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyPortableLicense — negative cases', () => {
    const FAKE_DEVICE_ID = 'e'.repeat(64);
    let tmpDir;

    beforeEach(() => { tmpDir = makeTempDir(); });
    afterEach(() => removeTempDir(tmpDir));

    it('файл лицензии отсутствует → valid=false', () => {
        const result = verifyPortableLicense(
            path.join(tmpDir, 'portable-license.json'),
            FAKE_DEVICE_ID,
        );
        assert.equal(result.valid, false);
        assert.ok(typeof result.reason === 'string' && result.reason.length > 0);
    });

    it('некорректный JSON → valid=false', () => {
        const fp = path.join(tmpDir, 'portable-license.json');
        fs.writeFileSync(fp, 'NOT JSON', 'utf8');
        assert.equal(verifyPortableLicense(fp, FAKE_DEVICE_ID).valid, false);
    });

    it('отсутствуют поля payload/signature → valid=false', () => {
        const fp = path.join(tmpDir, 'portable-license.json');
        fs.writeFileSync(fp, JSON.stringify({ bad: 'data' }), 'utf8');
        assert.equal(verifyPortableLicense(fp, FAKE_DEVICE_ID).valid, false);
    });

    it('неверная RSA-подпись → valid=false', () => {
        const fp          = path.join(tmpDir, 'portable-license.json');
        const fakePayload = Buffer.from(JSON.stringify({ version: 2 })).toString('base64');
        fs.writeFileSync(fp, JSON.stringify({ payload: fakePayload, signature: 'aW52YWxpZA==' }), 'utf8');
        assert.equal(verifyPortableLicense(fp, FAKE_DEVICE_ID).valid, false);
    });

    it('подпись сторонним тестовым ключом (не embedded PUBLIC_KEY) → valid=false', () => {
        const fp = path.join(tmpDir, 'portable-license.json');
        const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        const privateKeyPem  = privateKey.export({ type: 'pkcs8', format: 'pem' });

        writeSignedLicense(fp, {
            licenseType: 'PORTABLE_PERSONAL', portableDeviceId: FAKE_DEVICE_ID,
            allowedHostFingerprints: [], ownerId: 'developer', userName: 'Test',
            issuedAt: '2026-01-01T00:00:00.000Z', expiresAt: null, version: 2,
        }, privateKeyPem);

        const result = verifyPortableLicense(fp, FAKE_DEVICE_ID);
        assert.equal(result.valid, false);
        assert.ok(result.reason && /подпись|signature/i.test(result.reason));
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// verifyLicenseAuto — routing v1 vs v2
// ─────────────────────────────────────────────────────────────────────────────

describe('verifyLicenseAuto — маршрутизация по версии', () => {
    let tmpDir;

    beforeEach(() => { tmpDir = makeTempDir(); });
    afterEach(() => removeTempDir(tmpDir));

    it('v2 PORTABLE_PERSONAL → portable path → valid=false (нет правильного ключа)', () => {
        const fp = path.join(tmpDir, 'license.json');
        const pl = Buffer.from(JSON.stringify({ version: 2, licenseType: 'PORTABLE_PERSONAL' })).toString('base64');
        fs.writeFileSync(fp, JSON.stringify({ payload: pl, signature: 'xx==' }), 'utf8');

        assert.equal(verifyLicenseAuto(fp, { portableDeviceId: 'a'.repeat(64) }).valid, false);
    });

    it('v1 → machine-bound path → valid=false (неверная подпись)', () => {
        const fp = path.join(tmpDir, 'license.json');
        const pl = Buffer.from(JSON.stringify({
            version: 1, fingerprint: 'a'.repeat(64),
            userName: 'Test', issuedAt: new Date().toISOString(), expiresAt: null,
        })).toString('base64');
        fs.writeFileSync(fp, JSON.stringify({ payload: pl, signature: 'xx==' }), 'utf8');

        assert.equal(verifyLicenseAuto(fp, { machineFingerprint: 'a'.repeat(64) }).valid, false);
    });

    it('повреждённый файл (пустой объект) → valid=false', () => {
        const fp = path.join(tmpDir, 'license.json');
        fs.writeFileSync(fp, '{}', 'utf8');
        assert.equal(verifyLicenseAuto(fp, {}).valid, false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// Regression: verifyLicense v1 (machine-bound)
// ─────────────────────────────────────────────────────────────────────────────

describe('Регрессия: verifyLicense (v1 machine-bound)', () => {
    let tmpDir;

    beforeEach(() => { tmpDir = makeTempDir(); });
    afterEach(() => removeTempDir(tmpDir));

    it('файл отсутствует → valid=false', () => {
        assert.equal(verifyLicense(path.join(tmpDir, 'license.json'), 'a'.repeat(64)).valid, false);
    });

    it('некорректный JSON → valid=false', () => {
        const fp = path.join(tmpDir, 'license.json');
        fs.writeFileSync(fp, 'INVALID', 'utf8');
        assert.equal(verifyLicense(fp, 'a'.repeat(64)).valid, false);
    });

    it('неверная RSA-подпись → valid=false', () => {
        const fp = path.join(tmpDir, 'license.json');
        const pl = Buffer.from(JSON.stringify({
            fingerprint: 'a'.repeat(64), userName: 'Test',
            issuedAt: new Date().toISOString(), expiresAt: null, version: 1,
        })).toString('base64');
        fs.writeFileSync(fp, JSON.stringify({ payload: pl, signature: 'bm90YXNpZ24=' }), 'utf8');
        assert.equal(verifyLicense(fp, 'a'.repeat(64)).valid, false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// paths.cjs — exported constants and structure
// ─────────────────────────────────────────────────────────────────────────────

describe('paths.cjs — exported constants', () => {
    it('PORTABLE_FLAG_FILENAME === "portable.flag"', () => {
        assert.equal(PORTABLE_FLAG_FILENAME, 'portable.flag');
    });

    it('экспортирует функции initPaths и getPaths', () => {
        assert.equal(typeof initPaths, 'function');
        assert.equal(typeof getPaths, 'function');
    });

    it('результат getPaths() содержит обязательные ключи', () => {
        const paths = getPaths();
        const required = ['isPortable', 'dataRoot', 'dbPath', 'licenseFilePath', 'logDir', 'backupDir'];
        for (const key of required) {
            assert.ok(key in paths, `Missing key: ${key}`);
        }
    });

    it('в dev-режиме (app.isPackaged=false) isPortable=false', () => {
        const paths = getPaths();
        // Our electron mock returns isPackaged: false → portable detection skipped
        assert.equal(paths.isPortable, false);
    });
});
