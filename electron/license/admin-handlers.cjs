'use strict';

/**
 * LICENSE ADMIN IPC HANDLERS
 *
 * Предоставляет IPC-интерфейс для управления реестром лицензий разработчиком.
 * Все операции требуют наличия приватного ключа (keys/private.pem).
 * На машинах пользователей приватного ключа нет → admin-функции недоступны.
 *
 * Каналы:
 *   license-admin:list     — Весь реестр лицензий
 *   license-admin:generate — Создать новую лицензию
 *   license-admin:revoke   — Отозвать лицензию (мягкое удаление)
 *   license-admin:extend   — Продлить / изменить срок лицензии
 *   license-admin:export   — Получить содержимое license.json (base64) для скачивания
 */

const { ipcMain } = require('electron');
const path         = require('path');
const fs           = require('fs');
const crypto       = require('crypto');
const { logger, logAudit } = require('../logger.cjs');

// ─── Paths ────────────────────────────────────────────────────────────────────

/** Путь к приватному ключу разработчика (рядом с папкой electron) */
const PRIVATE_KEY_PATH  = path.join(__dirname, '..', '..', 'keys', 'private.pem');
/** Путь к реестру лицензий — только на машине разработчика */
const REGISTRY_PATH     = path.join(__dirname, '..', '..', 'keys', 'license-registry.json');

// ─── Registry helpers ─────────────────────────────────────────────────────────

/**
 * Читает реестр с диска. Если файл не существует — возвращает пустой реестр.
 * @returns {{ records: LicenseRecord[] }}
 */
function readRegistry() {
    if (!fs.existsSync(REGISTRY_PATH)) {
        return { records: [] };
    }
    try {
        return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    } catch (err) {
        logger.error('[LicenseAdmin] Failed to parse registry:', err.message);
        return { records: [] };
    }
}

/**
 * Сохраняет реестр на диск с отступами для читаемости.
 * @param {{ records: any[] }} registry
 */
function writeRegistry(registry) {
    const dir = path.dirname(REGISTRY_PATH);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
}

// ─── Crypto helpers ────────────────────────────────────────────────────────────

/**
 * Генерирует криптографически стойкий UUID v4 без внешних зависимостей.
 * @returns {string}
 */
function generateUUID() {
    const bytes = crypto.randomBytes(16);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = bytes.toString('hex');
    return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
    ].join('-');
}

/**
 * Подписывает payload приватным ключом RSA-SHA256.
 * @param {object} payloadObj
 * @returns {{ payload: string, signature: string }} Base64-encoded payload и подпись
 */
function signLicense(payloadObj) {
    const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
    const payloadB64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(payloadB64);
    const signature = sign.sign(privateKey, 'base64');
    return { payload: payloadB64, signature };
}

// ─── Guard ────────────────────────────────────────────────────────────────────

/**
 * Проверяет наличие приватного ключа. Если ключа нет — пробрасывает ошибку.
 */
function assertPrivateKeyExists() {
    if (!fs.existsSync(PRIVATE_KEY_PATH)) {
        throw new Error(
            'Приватный ключ не найден. Admin-функции доступны только на машине разработчика.'
        );
    }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

/**
 * Регистрирует все IPC-обработчики license-admin.
 * Вызывать из electron/main.cjs при инициализации.
 */
function setupLicenseAdminHandlers() {

    // ── license-admin:list ────────────────────────────────────────────────────
    ipcMain.handle('license-admin:list', async () => {
        try {
            assertPrivateKeyExists();
            const registry = readRegistry();
            return { success: true, records: registry.records };
        } catch (err) {
            logger.error('[LicenseAdmin] list error:', err.message);
            return { success: false, error: err.message };
        }
    });

    // ── license-admin:generate ────────────────────────────────────────────────
    // args: { fingerprint, userName, expiresAt: string|null, notes: string }
    ipcMain.handle('license-admin:generate', async (_event, args) => {
        try {
            assertPrivateKeyExists();

            const { fingerprint, userName, expiresAt, notes } = args || {};

            if (!fingerprint || typeof fingerprint !== 'string') {
                return { success: false, error: 'Fingerprint обязателен' };
            }
            if (!/^[a-f0-9]{64}$/i.test(fingerprint)) {
                return { success: false, error: 'Неверный fingerprint: должно быть 64 hex-символа (SHA-256)' };
            }
            if (!userName || typeof userName !== 'string' || !userName.trim()) {
                return { success: false, error: 'Имя пользователя обязательно' };
            }
            if (expiresAt && isNaN(new Date(expiresAt).getTime())) {
                return { success: false, error: `Неверный формат даты: ${expiresAt}. Используйте YYYY-MM-DD` };
            }

            const payloadObj = {
                fingerprint: fingerprint.toLowerCase(),
                userName: userName.trim(),
                issuedAt: new Date().toISOString(),
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                version: 1,
            };

            const { payload, signature } = signLicense(payloadObj);

            const record = {
                id: generateUUID(),
                userName: payloadObj.userName,
                fingerprint: payloadObj.fingerprint,
                issuedAt: payloadObj.issuedAt,
                expiresAt: payloadObj.expiresAt,
                notes: (notes || '').trim(),
                revokedAt: null,
                licensePayload: payload,
                licenseSignature: signature,
            };

            const registry = readRegistry();
            registry.records.unshift(record);
            writeRegistry(registry);

            logAudit('license-admin:generate', { userName: record.userName, fingerprint: record.fingerprint, expiresAt: record.expiresAt });
            logger.info(`[LicenseAdmin] Generated license for "${record.userName}" fp=${record.fingerprint.slice(0, 16)}...`);

            return { success: true, record };
        } catch (err) {
            logger.error('[LicenseAdmin] generate error:', err.message);
            return { success: false, error: err.message };
        }
    });

    // ── license-admin:revoke ──────────────────────────────────────────────────
    // args: { id: string }
    ipcMain.handle('license-admin:revoke', async (_event, args) => {
        try {
            assertPrivateKeyExists();

            const { id } = args || {};
            if (!id) return { success: false, error: 'ID лицензии обязателен' };

            const registry = readRegistry();
            const idx = registry.records.findIndex((r) => r.id === id);
            if (idx === -1) return { success: false, error: 'Лицензия не найдена' };
            if (registry.records[idx].revokedAt) {
                return { success: false, error: 'Лицензия уже отозвана' };
            }

            registry.records[idx].revokedAt = new Date().toISOString();
            writeRegistry(registry);

            logAudit('license-admin:revoke', { id, userName: registry.records[idx].userName });
            logger.info(`[LicenseAdmin] Revoked license id=${id}`);

            return { success: true, record: registry.records[idx] };
        } catch (err) {
            logger.error('[LicenseAdmin] revoke error:', err.message);
            return { success: false, error: err.message };
        }
    });

    // ── license-admin:extend ──────────────────────────────────────────────────
    // args: { id: string, expiresAt: string|null }
    ipcMain.handle('license-admin:extend', async (_event, args) => {
        try {
            assertPrivateKeyExists();

            const { id, expiresAt } = args || {};
            if (!id) return { success: false, error: 'ID лицензии обязателен' };
            if (expiresAt && isNaN(new Date(expiresAt).getTime())) {
                return { success: false, error: `Неверный формат даты: ${expiresAt}` };
            }

            const registry = readRegistry();
            const idx = registry.records.findIndex((r) => r.id === id);
            if (idx === -1) return { success: false, error: 'Лицензия не найдена' };

            const existing = registry.records[idx];

            // Перегенерируем лицензию с новой датой истечения
            const payloadObj = {
                fingerprint: existing.fingerprint,
                userName: existing.userName,
                issuedAt: existing.issuedAt, // сохраняем оригинальную дату выдачи
                expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
                version: 1,
            };

            const { payload, signature } = signLicense(payloadObj);

            registry.records[idx].expiresAt = payloadObj.expiresAt;
            registry.records[idx].revokedAt = null; // снимаем отзыв при продлении
            registry.records[idx].licensePayload = payload;
            registry.records[idx].licenseSignature = signature;
            writeRegistry(registry);

            logAudit('license-admin:extend', { id, userName: existing.userName, newExpiresAt: payloadObj.expiresAt });
            logger.info(`[LicenseAdmin] Extended license id=${id} newExpiry=${payloadObj.expiresAt}`);

            return { success: true, record: registry.records[idx] };
        } catch (err) {
            logger.error('[LicenseAdmin] extend error:', err.message);
            return { success: false, error: err.message };
        }
    });

    // ── license-admin:export ──────────────────────────────────────────────────
    // args: { id: string }
    // Возвращает JSON-строку файла лицензии для скачивания клиентом
    ipcMain.handle('license-admin:export', async (_event, args) => {
        try {
            assertPrivateKeyExists();

            const { id } = args || {};
            if (!id) return { success: false, error: 'ID лицензии обязателен' };

            const registry = readRegistry();
            const record = registry.records.find((r) => r.id === id);
            if (!record) return { success: false, error: 'Лицензия не найдена' };

            const licenseJson = JSON.stringify(
                { payload: record.licensePayload, signature: record.licenseSignature },
                null,
                2
            );

            return {
                success: true,
                content: licenseJson,
                suggestedName: `license-${record.userName.replace(/\s+/g, '_')}.json`,
            };
        } catch (err) {
            logger.error('[LicenseAdmin] export error:', err.message);
            return { success: false, error: err.message };
        }
    });
}

module.exports = { setupLicenseAdminHandlers };
