'use strict';

/**
 * PORTABLE BOOTSTRAP MODULE
 *
 * Запускает portable-режим при старте приложения:
 *   1. Проверяет наличие portable-license.json
 *   2. Определяет ID текущего диска (по букве диска exe)
 *   3. Верифицирует portable-лицензию
 *   4. Выполняет anti-rollback проверку и инкремент счётчика
 *
 * Вызывается из electron/license/handlers.cjs → checkCurrentLicense()
 * только когда getPaths().isPortable === true.
 *
 * UX-принцип: никакого UI-мастера активации. Либо лицензия найдена и верна → старт,
 * либо чёткий errorCode для минимального экрана ошибки в ActivationPage.
 */

const fs   = require('fs');
const path = require('path');
const { logger, logAudit }             = require('../logger.cjs');
const { verifyPortableLicense }        = require('./verify.cjs');
const { checkAndIncrementState }       = require('./anti-rollback.cjs');
const { getPortableDeviceId, getFingerprint } = require('./fingerprint.cjs');

/**
 * @typedef {Object} BootstrapResult
 * @property {boolean} valid
 * @property {string}  [reason]                  - Причина отказа
 * @property {string}  [errorCode]               - Машинный код ошибки для UI
 *   'LICENSE_MISSING' | 'DEVICE_MISMATCH' | 'STATE_TAMPER' | 'LICENSE_INVALID' | 'DEVICE_ID_ERROR'
 * @property {string}  [portableDeviceDisplayId] - XXXX-XXXX-XXXX-XXXX (только при DEVICE_MISMATCH)
 * @property {object}  [data]                    - Данные лицензии при valid=true
 */

/**
 * Выполняет полный bootstrap portable-режима.
 *
 * @param {import('../config/paths.cjs').AppPaths} paths - Из getPaths()
 * @returns {Promise<BootstrapResult>}
 */
async function bootstrapPortable(paths) {
    const { licenseFilePath, portableStatePath, exeDir } = paths;

    // ── 1. Проверяем наличие файла лицензии ─────────────────────────────────
    if (!fs.existsSync(licenseFilePath)) {
        logger.warn('[PortableBootstrap] portable-license.json not found at:', licenseFilePath);
        return {
            valid:     false,
            reason:    'Файл portable-license.json не найден в папке data на диске',
            errorCode: 'LICENSE_MISSING',
        };
    }

    // ── 2. Определяем букву диска и получаем Device ID ────────────────────────
    let portableDeviceId;
    let driveLetter;
    let displayId;
    try {
        // Из пути к exe извлекаем букву диска: 'D:\PediAssist\...' → 'D'
        driveLetter = path.parse(exeDir).root.charAt(0).toUpperCase();
        portableDeviceId = getPortableDeviceId(driveLetter);
        displayId = portableDeviceId.substring(0, 32).toUpperCase().match(/.{8}/g).join('-');
    } catch (err) {
        logger.error('[PortableBootstrap] Cannot get portable device ID:', err.message);
        return {
            valid:     false,
            reason:    `Не удалось определить ID диска: ${err.message}`,
            errorCode: 'DEVICE_ID_ERROR',
        };
    }

    // ── 3. Опциональный fingerprint машины (для whitelist, если настроен) ────
    let hostFingerprint;
    try {
        hostFingerprint = getFingerprint();
    } catch {
        // Хост-fingerprint опционален в portable-режиме — пропускаем
        hostFingerprint = undefined;
    }

    // ── 4. Верифицируем лицензию ─────────────────────────────────────────────
    const verifyResult = verifyPortableLicense(licenseFilePath, portableDeviceId, hostFingerprint);
    if (!verifyResult.valid) {
        const isDeviceMismatch =
            verifyResult.reason?.includes('другому диску') ||
            verifyResult.reason?.includes('Device ID');

        logAudit('PORTABLE_LICENSE_CHECK_FAILED', {
            reason:   verifyResult.reason,
            deviceId: portableDeviceId.substring(0, 16),
        });

        return {
            valid:                   false,
            reason:                  verifyResult.reason,
            errorCode:               isDeviceMismatch ? 'DEVICE_MISMATCH' : 'LICENSE_INVALID',
            portableDeviceDisplayId: isDeviceMismatch ? displayId : undefined,
        };
    }

    // ── 5. Anti-rollback проверка ─────────────────────────────────────────────
    const rollbackResult = checkAndIncrementState(
        portableStatePath,
        portableDeviceId,
        verifyResult.data.issuedAt,
    );
    if (!rollbackResult.ok) {
        return {
            valid:     false,
            reason:    rollbackResult.reason,
            errorCode: 'STATE_TAMPER',
        };
    }

    // ── Успех ─────────────────────────────────────────────────────────────────
    logAudit('PORTABLE_BOOT_OK', {
        userName: verifyResult.data.userName || verifyResult.data.ownerId || 'unknown',
    });
    logger.info('[PortableBootstrap] Portable mode started successfully');

    return {
        valid: true,
        data:  verifyResult.data,
    };
}

module.exports = { bootstrapPortable };
