'use strict';

/**
 * LICENSE VERIFICATION MODULE
 *
 * Проверяет RSA-SHA256 подпись лицензионного файла с помощью встроенного публичного ключа.
 * Приватный ключ никогда не попадает в приложение — только публичный.
 *
 * Формат license.json:
 * {
 *   "payload": "<base64-encoded JSON>",
 *   "signature": "<base64-encoded RSA-SHA256 signature>"
 * }
 *
 * Payload (после декодирования из base64):
 * {
 *   "fingerprint": "<sha256 hex>",
 *   "userName": "Иванов И.И.",
 *   "username": "ivanov",                  // optional (Variant A)
 *   "passwordHash": "$2b$10$...",          // optional bcrypt hash (Variant A)
 *   "issuedAt": "2026-01-01T00:00:00.000Z",
 *   "expiresAt": "2027-01-01T00:00:00.000Z" | null,
 *   "version": 1
 * }
 */

const crypto = require('crypto');
const fs = require('fs');
const { logger } = require('../logger.cjs');

// ─── Embedded RSA-2048 Public Key ────────────────────────────────────────────
// Сгенерирован командой: node tools/generate-license.cjs --generate-keys
// Приватный ключ хранится у разработчика. Этот ключ — только для проверки.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoZ/kEC0XGgMV2Ji0h/Le
v5/qlMaeR0sxiH7ANpBLkvsXXCcO/YK+kGxzEmvk+3GhCBtV+ouAjRSmpdkoVP97
D6VjEEmL6m9HmwGMHHqCUWUUZfwHidRU8muUY2rtyBJvzOv4WAC7wpNoADbjUP54
QLaoniLx8cbIdNmKJWq52OMBtLhpE9qkC8/SfD/GBYJOREkhm8B5V4EPsqBe0G2t
PHmzNpRG1eQUuO5UQt6ggIYAGIVpty2rqXkrcPOupFtLRdDf4ofQQL9c7ZIUY9Qn
sMljoXzdQ36JcVfwZseEkmGdogki6MmcfSd3SGiCJPLfD9C3jNZB9Op9sW9ay1RD
wQIDAQAB
-----END PUBLIC KEY-----`;

/**
 * @typedef {Object} LicenseVerifyResult
 * @property {boolean} valid
 * @property {string} [reason]   - Причина отказа (если valid=false)
 * @property {Object} [data]     - Данные лицензии (если valid=true)
 * @property {string} data.userName
 * @property {string} data.fingerprint
 * @property {string} data.issuedAt
 * @property {string|null} data.expiresAt
 * @property {string} [data.username]
 * @property {string} [data.passwordHash]
 */

/**
 * Верифицирует лицензионный файл по пути licenseFilePath.
 * @param {string} licenseFilePath - Полный путь к license.json
 * @param {string} machineFingerprint - SHA-256 отпечаток текущей машины
 * @returns {LicenseVerifyResult}
 */
function verifyLicense(licenseFilePath, machineFingerprint) {
    // 1. Read file
    let raw;
    try {
        raw = fs.readFileSync(licenseFilePath, 'utf8');
    } catch (err) {
        logger.warn('[License] Cannot read license file:', err.message);
        return { valid: false, reason: 'Файл лицензии не найден или недоступен' };
    }

    // 2. Parse JSON
    let licenseObj;
    try {
        licenseObj = JSON.parse(raw);
    } catch {
        return { valid: false, reason: 'Файл лицензии повреждён (некорректный JSON)' };
    }

    const { payload, signature } = licenseObj;
    if (!payload || !signature) {
        return { valid: false, reason: 'Файл лицензии повреждён (отсутствует payload или signature)' };
    }

    // 3. Verify RSA-SHA256 signature
    let signatureValid = false;
    try {
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(payload);
        signatureValid = verify.verify(PUBLIC_KEY, signature, 'base64');
    } catch (err) {
        logger.error('[License] Signature verification error:', err.message);
        return { valid: false, reason: 'Ошибка проверки подписи лицензии' };
    }

    if (!signatureValid) {
        logger.warn('[License] Invalid RSA signature detected');
        return { valid: false, reason: 'Подпись лицензии недействительна — файл изменён или подделан' };
    }

    // 4. Decode payload
    let data;
    try {
        data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    } catch {
        return { valid: false, reason: 'Файл лицензии повреждён (не удалось декодировать данные)' };
    }

    // 5. Check machine fingerprint
    if (!data.fingerprint) {
        return { valid: false, reason: 'Лицензия не содержит привязки к машине' };
    }
    if (data.fingerprint.toLowerCase() !== machineFingerprint.toLowerCase()) {
        logger.warn('[License] Fingerprint mismatch');
        return { valid: false, reason: 'Лицензия привязана к другому компьютеру' };
    }

    // 6. Check expiry
    if (data.expiresAt) {
        const expiryDate = new Date(data.expiresAt);
        if (isNaN(expiryDate.getTime())) {
            return { valid: false, reason: 'Недействительная дата истечения лицензии' };
        }
        if (expiryDate < new Date()) {
            logger.warn('[License] License expired:', data.expiresAt);
            return {
                valid: false,
                reason: `Срок действия лицензии истёк ${expiryDate.toLocaleDateString('ru-RU')}`
            };
        }
    }

    // 7. Optional Variant A credentials contract validation.
    // Both fields must be present together and in valid format.
    const hasUsername = typeof data.username === 'string' && data.username.trim().length > 0;
    const hasPasswordHash = typeof data.passwordHash === 'string' && data.passwordHash.length > 0;

    if (hasUsername !== hasPasswordHash) {
        return { valid: false, reason: 'Лицензия повреждена (неполные credentials в payload)' };
    }

    if (hasUsername) {
        const username = data.username.trim();
        if (username.length < 3) {
            return { valid: false, reason: 'Лицензия содержит некорректный логин (минимум 3 символа)' };
        }
        if (!/^\$2[aby]\$\d{2}\$/.test(data.passwordHash)) {
            return { valid: false, reason: 'Лицензия содержит некорректный password hash' };
        }

        // Normalize username in returned data for downstream provisioning.
        data.username = username;
    }

    logger.info('[License] License verified successfully for user:', data.userName);
    return { valid: true, data };
}

// ─── Portable License Verification (v2) ──────────────────────────────────────

/**
 * Верифицирует PORTABLE_PERSONAL лицензию (payload version = 2).
 *
 * Payload v2:
 * {
 *   "licenseType": "PORTABLE_PERSONAL",
 *   "portableDeviceId": "<sha256 тома>",
 *   "allowedHostFingerprints": ["<sha256>", ...],  // пустой = любой хост
 *   "ownerId": "developer",
 *   "userName": "Разработчик",
 *   "issuedAt": "2026-...",
 *   "expiresAt": null,
 *   "version": 2
 * }
 *
 * @param {string} licenseFilePath      - Путь к portable-license.json
 * @param {string} portableDeviceId     - SHA-256 текущего тома (из getPortableDeviceId)
 * @param {string} [hostFingerprint]    - SHA-256 текущей машины (для whitelist-проверки)
 * @returns {LicenseVerifyResult}
 */
function verifyPortableLicense(licenseFilePath, portableDeviceId, hostFingerprint) {
    // 1. Read file
    let raw;
    try {
        raw = fs.readFileSync(licenseFilePath, 'utf8');
    } catch (err) {
        logger.warn('[License] Cannot read portable license file:', err.message);
        return { valid: false, reason: 'Файл portable-лицензии не найден или недоступен' };
    }

    // 2. Parse JSON
    let licenseObj;
    try {
        licenseObj = JSON.parse(raw);
    } catch {
        return { valid: false, reason: 'Файл portable-лицензии повреждён (некорректный JSON)' };
    }

    const { payload, signature } = licenseObj;
    if (!payload || !signature) {
        return { valid: false, reason: 'Файл portable-лицензии повреждён (отсутствует payload или signature)' };
    }

    // 3. Verify RSA-SHA256 signature (same PUBLIC_KEY as machine licenses)
    let signatureValid = false;
    try {
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(payload);
        signatureValid = verify.verify(PUBLIC_KEY, signature, 'base64');
    } catch (err) {
        logger.error('[License] Portable signature verification error:', err.message);
        return { valid: false, reason: 'Ошибка проверки подписи portable-лицензии' };
    }

    if (!signatureValid) {
        logger.warn('[License] Portable: invalid RSA signature detected');
        return { valid: false, reason: 'Подпись portable-лицензии недействительна — файл изменён или подделан' };
    }

    // 4. Decode payload
    let data;
    try {
        data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    } catch {
        return { valid: false, reason: 'Файл portable-лицензии повреждён (не удалось декодировать данные)' };
    }

    // 5. Version and type checks
    if (data.version !== 2) {
        return { valid: false, reason: 'Неверная версия portable-лицензии (ожидается v2)' };
    }
    if (data.licenseType !== 'PORTABLE_PERSONAL') {
        return { valid: false, reason: 'Тип лицензии не соответствует portable-режиму' };
    }
    if (!data.portableDeviceId) {
        return { valid: false, reason: 'Portable-лицензия не содержит ID диска' };
    }

    // 6. Portable device ID check
    if (data.portableDeviceId.toLowerCase() !== portableDeviceId.toLowerCase()) {
        logger.warn('[License] Portable: device ID mismatch');
        return {
            valid: false,
            reason: 'Лицензия привязана к другому диску (Device ID не совпадает)',
        };
    }

    // 7. Optional host fingerprint whitelist check
    if (
        hostFingerprint &&
        Array.isArray(data.allowedHostFingerprints) &&
        data.allowedHostFingerprints.length > 0
    ) {
        const allowed = data.allowedHostFingerprints.map((fp) => fp.toLowerCase());
        if (!allowed.includes(hostFingerprint.toLowerCase())) {
            logger.warn('[License] Portable: host fingerprint not in whitelist');
            return {
                valid: false,
                reason: 'Этот компьютер не входит в список разрешённых для данной portable-лицензии',
            };
        }
    }

    // 8. Expiry check
    if (data.expiresAt) {
        const expiryDate = new Date(data.expiresAt);
        if (isNaN(expiryDate.getTime())) {
            return { valid: false, reason: 'Недействительная дата истечения portable-лицензии' };
        }
        if (expiryDate < new Date()) {
            logger.warn('[License] Portable license expired:', data.expiresAt);
            return {
                valid: false,
                reason: `Срок действия portable-лицензии истёк ${expiryDate.toLocaleDateString('ru-RU')}`,
            };
        }
    }

    logger.info('[License] Portable license verified for:', data.userName || data.ownerId);
    return { valid: true, data };
}

/**
 * Авто-маршрутизатор: определяет версию лицензии и вызывает нужный верификатор.
 * Позволяет handlers.cjs не знать о деталях версий.
 *
 * @param {string} licenseFilePath
 * @param {{ portableDeviceId?: string, hostFingerprint?: string, machineFingerprint?: string }} context
 * @returns {LicenseVerifyResult}
 */
function verifyLicenseAuto(licenseFilePath, context) {
    // Peek at payload to detect version without full verification
    let payloadData;
    try {
        const raw         = fs.readFileSync(licenseFilePath, 'utf8');
        const licenseObj  = JSON.parse(raw);
        payloadData = JSON.parse(Buffer.from(licenseObj.payload || '', 'base64').toString('utf8'));
    } catch {
        return { valid: false, reason: 'Файл лицензии не найден или повреждён' };
    }

    if (payloadData.version === 2 && payloadData.licenseType === 'PORTABLE_PERSONAL') {
        return verifyPortableLicense(
            licenseFilePath,
            context.portableDeviceId || '',
            context.hostFingerprint
        );
    }

    // Default: v1 machine-bound
    return verifyLicense(licenseFilePath, context.machineFingerprint || '');
}

module.exports = { verifyLicense, verifyPortableLicense, verifyLicenseAuto, PUBLIC_KEY };
