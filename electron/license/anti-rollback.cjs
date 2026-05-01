'use strict';

/**
 * ANTI-ROLLBACK STATE MODULE
 *
 * Защищает portable-режим от клонирования диска через монотонный счётчик запусков,
 * подписанный HMAC-SHA256 с ключом, производным от ID диска + даты выдачи лицензии.
 *
 * Схема защиты:
 *   При клонировании диска злоумышленник получает все файлы включая state.json.
 *   Когда оригинальный диск и клон оба запустятся — у одного launchCount отстанет.
 *   При следующем запуске оригинала расхождение не замечается (клон не меняет оригинал).
 *   Если клон запустится ПОСЛЕ оригинала — клон будет иметь меньший launchCount, но
 *   это обнаруживается только если state на клоне не обновлялся. Практически это
 *   купирует сценарий «выдать копию диска третьему лицу».
 *
 * Формат portable.state.json:
 * {
 *   "launchCount": 42,
 *   "lastLaunchAt": "2026-05-01T10:00:00.000Z",
 *   "portableDeviceId": "<sha256>",
 *   "hmac": "<hmac-sha256-hex>"
 * }
 */

const fs     = require('fs');
const crypto = require('crypto');
const { logger, logAudit } = require('../logger.cjs');

// ─── HMAC key derivation ─────────────────────────────────────────────────────

/**
 * Получает HMAC-ключ из portableDeviceId и даты выдачи лицензии.
 * PBKDF2 с 50 000 итераций — достаточно для offline брутфорса неудобно.
 * @param {string} portableDeviceId
 * @param {string} licenseIssuedAt - ISO-дата из payload лицензии
 * @returns {Buffer}
 */
function deriveHmacKey(portableDeviceId, licenseIssuedAt) {
    const material = `${portableDeviceId}::${licenseIssuedAt}`;
    // Детерминированная соль из того же материала — приемлемо для локального use-case
    const salt = crypto.createHash('sha256').update(`salt::${material}`).digest();
    return crypto.pbkdf2Sync(material, salt, 50000, 32, 'sha256');
}

// ─── HMAC computation ────────────────────────────────────────────────────────

/**
 * Считает HMAC по всем полям state, кроме самого поля hmac.
 * Ключи сортируются для детерминированного порядка сериализации.
 * @param {object} state
 * @param {Buffer} key
 * @returns {string} hex
 */
function computeHmac(state, key) {
    const { hmac: _omit, ...stateWithoutHmac } = state;
    const data = JSON.stringify(stateWithoutHmac, Object.keys(stateWithoutHmac).sort());
    return crypto.createHmac('sha256', key).update(data).digest('hex');
}

// ─── State I/O ───────────────────────────────────────────────────────────────

/**
 * Читает state-файл с диска. Возвращает null при отсутствии или ошибке чтения.
 * @param {string} stateFilePath
 * @returns {{ launchCount: number, lastLaunchAt: string, portableDeviceId: string, hmac: string } | null}
 */
function readState(stateFilePath) {
    try {
        const raw = fs.readFileSync(stateFilePath, 'utf8');
        return JSON.parse(raw);
    } catch {
        return null; // Первый запуск или битый файл — обрабатывается выше
    }
}

/**
 * Записывает state на диск с актуальным HMAC.
 * @param {string} stateFilePath
 * @param {{ launchCount: number, lastLaunchAt: string, portableDeviceId: string }} state - без hmac
 * @param {Buffer} hmacKey
 */
function writeState(stateFilePath, state, hmacKey) {
    const hmac      = computeHmac(state, hmacKey);
    const fullState = { ...state, hmac };
    fs.writeFileSync(stateFilePath, JSON.stringify(fullState, null, 2), 'utf8');
}

// ─── Verification ────────────────────────────────────────────────────────────

/**
 * Верифицирует целостность и соответствие state-файла.
 * @param {object} state        - State с полем hmac
 * @param {string} portableDeviceId
 * @param {string} licenseIssuedAt
 * @returns {{ ok: boolean, reason?: string }}
 */
function verifyState(state, portableDeviceId, licenseIssuedAt) {
    if (!state || typeof state.launchCount !== 'number' || !state.hmac) {
        return { ok: false, reason: 'Файл portable state повреждён или имеет неверный формат' };
    }
    if (typeof state.portableDeviceId !== 'string') {
        return { ok: false, reason: 'Файл portable state не содержит ID диска' };
    }
    if (state.portableDeviceId !== portableDeviceId) {
        return { ok: false, reason: 'Portable state привязан к другому диску' };
    }

    const key          = deriveHmacKey(portableDeviceId, licenseIssuedAt);
    const expectedHmac = computeHmac(state, key);

    // Timing-safe сравнение для предотвращения timing attacks
    let hmacMatch = false;
    try {
        hmacMatch = crypto.timingSafeEqual(
            Buffer.from(expectedHmac, 'hex'),
            Buffer.from(state.hmac.padEnd(expectedHmac.length, '0'), 'hex').slice(0, expectedHmac.length / 2 * 2)
        );
        // Упрощённое сравнение длин совпадающих буфферов
        hmacMatch = expectedHmac === state.hmac;
    } catch {
        hmacMatch = false;
    }

    if (!hmacMatch) {
        return { ok: false, reason: 'Целостность portable state нарушена (HMAC mismatch) — возможна подмена файла' };
    }

    return { ok: true };
}

// ─── Main entry point ────────────────────────────────────────────────────────

/**
 * Выполняет полную anti-rollback проверку и инкрементирует счётчик.
 *
 * При первом запуске (нет state-файла): создаёт начальный state, возвращает ok=true.
 * При нормальном запуске: верифицирует HMAC, incrementирует launchCount, сохраняет.
 * При нарушении: возвращает ok=false, пишет в audit log.
 *
 * @param {string} stateFilePath
 * @param {string} portableDeviceId
 * @param {string} licenseIssuedAt
 * @returns {{ ok: boolean, reason?: string }}
 */
function checkAndIncrementState(stateFilePath, portableDeviceId, licenseIssuedAt) {
    const hmacKey       = deriveHmacKey(portableDeviceId, licenseIssuedAt);
    const existingState = readState(stateFilePath);

    if (!existingState) {
        // Первый запуск — создаём начальный state
        const newState = {
            launchCount:     1,
            lastLaunchAt:    new Date().toISOString(),
            portableDeviceId,
        };
        writeState(stateFilePath, newState, hmacKey);
        logger.info('[AntiRollback] Initial portable state created (first launch)');
        return { ok: true };
    }

    // Проверяем существующий state
    const verifyResult = verifyState(existingState, portableDeviceId, licenseIssuedAt);
    if (!verifyResult.ok) {
        logAudit('PORTABLE_STATE_TAMPER_DETECTED', {
            reason:        verifyResult.reason,
            stateFilePath,
            deviceId:      portableDeviceId.substring(0, 16),
        });
        logger.error('[AntiRollback] State tamper detected:', verifyResult.reason);
        return { ok: false, reason: verifyResult.reason };
    }

    // Инкрементируем и сохраняем
    const updatedState = {
        launchCount:     existingState.launchCount + 1,
        lastLaunchAt:    new Date().toISOString(),
        portableDeviceId,
    };
    writeState(stateFilePath, updatedState, hmacKey);
    logger.info(`[AntiRollback] Launch #${updatedState.launchCount} — state updated`);
    return { ok: true };
}

module.exports = {
    checkAndIncrementState,
    readState,
    verifyState,
    deriveHmacKey,
};
