'use strict';

/**
 * LICENSE ADMIN IPC HANDLERS
 *
 * Предоставляет IPC-интерфейс для управления реестром лицензий разработчиком.
 * Все операции требуют наличия приватного ключа (private.pem).
 * На машинах пользователей приватного ключа нет → admin-функции недоступны.
 *
 * Расположение ключа (приоритет):
 *   1. %APPDATA%\PediAssist\private.pem  (userData — работает в prod и dev)
 *   2. <project>/keys/private.pem        (dev fallback — удобно при разработке)
 *
 * Каналы:
 *   license-admin:check-key            — Есть ли приватный ключ
 *   license-admin:import-key           — Импортировать private.pem через диалог
 *   license-admin:list                 — Весь реестр лицензий
 *   license-admin:generate             — Создать новую лицензию
 *   license-admin:revoke               — Отозвать лицензию (мягкое удаление)
 *   license-admin:extend               — Продлить / изменить срок лицензии
 *   license-admin:export               — Получить содержимое license.json для скачивания
 *   license-admin:generate-own-license — Создать лицензию для ТЕКУЩЕЙ машины (first run)
 *   license-admin:create-client-bundle — Создать юзера (doctor) + license за один шаг
 */

const { ipcMain, app, dialog } = require('electron');
const path         = require('path');
const fs           = require('fs');
const crypto       = require('crypto');
const { logger, logAudit } = require('../logger.cjs');
const { prisma } = require('../prisma-client.cjs');
const bcrypt = require('bcryptjs');
const { PUBLIC_KEY } = require('./verify.cjs');
const { ensureAuthenticated, ensureAdmin } = require('../auth.cjs');

// ─── Paths ────────────────────────────────────────────────────────────────────

/**
 * Возвращает путь к приватному ключу.
 * Приоритет: userData (prod) → project keys/ (dev fallback).
 * @returns {string}
 */
function getPrivateKeyPath() {
    const userDataPath = path.join(app.getPath('userData'), 'private.pem');
    if (fs.existsSync(userDataPath)) return userDataPath;
    if (!app.isPackaged) {
        const devFallbackPath = path.join(__dirname, '..', '..', 'keys', 'private.pem');
        if (fs.existsSync(devFallbackPath)) return devFallbackPath;
    }
    return userDataPath;
}

/**
 * Реестр лицензий всегда в userData — консистентен в prod и dev.
 * @returns {string}
 */
function getRegistryPath() {
    return path.join(app.getPath('userData'), 'license-registry.json');
}

// ─── Registry helpers ─────────────────────────────────────────────────────────

/**
 * Читает реестр с диска. Если файл не существует — возвращает пустой реестр.
 * @returns {{ records: LicenseRecord[] }}
 */
function readRegistry() {
    const registryPath = getRegistryPath();
    if (!fs.existsSync(registryPath)) return { records: [] };
    try {
        return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
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
    const registryPath = getRegistryPath();
    const dir = path.dirname(registryPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
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
    const privateKey = fs.readFileSync(getPrivateKeyPath(), 'utf8');
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
    if (!fs.existsSync(getPrivateKeyPath())) {
        throw new Error(
            'Приватный ключ не найден. Импортируйте private.pem через панель Лицензии → Ключ разработчика.'
        );
    }
}

/**
 * Проверяет, что файл является валидным RSA private key.
 * @param {string} filePath
 * @returns {boolean}
 */
function isValidRsaPrivateKey(filePath) {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (!content.includes('PRIVATE KEY')) return false;
        crypto.createSign('RSA-SHA256').sign(content);

        // Security hardening: imported private key must match embedded PUBLIC_KEY.
        const probe = `pediassist-key-proof:${crypto.randomBytes(24).toString('hex')}`;
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(probe);
        const signature = sign.sign(content, 'base64');

        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(probe);
        return verify.verify(PUBLIC_KEY, signature, 'base64');
    } catch {
        return false;
    }
}

async function isFirstRun() {
    return (await prisma.user.count()) === 0;
}

function withFirstRunOrAdmin(handler) {
    return async (event, ...args) => {
        if (await isFirstRun()) return handler(event, ...args);
        const wrapped = ensureAuthenticated(ensureAdmin(handler));
        return wrapped(event, ...args);
    };
}

function withAdmin(handler) {
    return ensureAuthenticated(ensureAdmin(handler));
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

/**
 * Регистрирует все IPC-обработчики license-admin.
 * Вызывать из electron/main.cjs при инициализации.
 */
function setupLicenseAdminHandlers() {

    // ── license-admin:list ────────────────────────────────────────────────────
    ipcMain.handle('license-admin:list', withAdmin(async () => {
        try {
            assertPrivateKeyExists();
            const registry = readRegistry();
            return { success: true, records: registry.records };
        } catch (err) {
            logger.error('[LicenseAdmin] list error:', err.message);
            return { success: false, error: err.message };
        }
    }));

    // ── license-admin:generate ────────────────────────────────────────────────
    // args: { fingerprint, userName, expiresAt: string|null, notes: string }
    ipcMain.handle('license-admin:generate', withAdmin(async (_event, args) => {
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

            const { record } = _buildAndSaveLicenseRecord({ fingerprint, userName, expiresAt, notes });

            logAudit('license-admin:generate', { userName: record.userName, fingerprint: record.fingerprint, expiresAt: record.expiresAt });
            logger.info(`[LicenseAdmin] Generated license for "${record.userName}" fp=${record.fingerprint.slice(0, 16)}...`);

            return { success: true, record };
        } catch (err) {
            logger.error('[LicenseAdmin] generate error:', err.message);
            return { success: false, error: err.message };
        }
    }));

    // ── license-admin:revoke ──────────────────────────────────────────────────
    // args: { id: string }
    ipcMain.handle('license-admin:revoke', withAdmin(async (_event, args) => {
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
    }));

    // ── license-admin:extend ──────────────────────────────────────────────────
    // args: { id: string, expiresAt: string|null }
    ipcMain.handle('license-admin:extend', withAdmin(async (_event, args) => {
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
    }));

    // ── license-admin:export ──────────────────────────────────────────────────
    // args: { id: string }
    // Возвращает JSON-строку файла лицензии для скачивания клиентом
    ipcMain.handle('license-admin:export', withAdmin(async (_event, args) => {
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
    }));

    // ── license-admin:check-key ───────────────────────────────────────────────
    // Не требует аутентификации — используется на First Run Setup и в LicenseAdminPanel.
    ipcMain.handle('license-admin:check-key', async () => {
        const keyPath = getPrivateKeyPath();
        const exists = fs.existsSync(keyPath);
        return { exists, path: exists ? keyPath : null };
    });

    // ── license-admin:import-key ──────────────────────────────────────────────
    // Открывает диалог выбора файла → проверяет RSA key → копирует в userData.
    // Не требует аутентификации (используется на экране First Run Setup).
    ipcMain.handle('license-admin:import-key', withFirstRunOrAdmin(async (event) => {
        const { BrowserWindow } = require('electron');
        const win = BrowserWindow.fromWebContents(event.sender);

        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
            title: 'Выберите файл приватного ключа (private.pem)',
            filters: [
                { name: 'PEM Key', extensions: ['pem'] },
                { name: 'All Files', extensions: ['*'] },
            ],
            properties: ['openFile'],
        });

        if (canceled || !filePaths.length) {
            return { success: false, error: 'Импорт отменён' };
        }

        const sourcePath = filePaths[0];
        if (!isValidRsaPrivateKey(sourcePath)) {
            return { success: false, error: 'Ключ отклонён. Требуется private.pem, соответствующий встроенному PUBLIC_KEY приложения.' };
        }

        try {
            const destPath = path.join(app.getPath('userData'), 'private.pem');
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(sourcePath, destPath);
            logAudit('license-admin:import-key', { destPath });
            logger.info(`[LicenseAdmin] Private key imported to ${destPath}`);
            return { success: true };
        } catch (err) {
            logger.error('[LicenseAdmin] import-key error:', err.message);
            return { success: false, error: `Ошибка копирования ключа: ${err.message}` };
        }
    }));

    // ── license-admin:generate-own-license ────────────────────────────────────
    // Генерирует постоянную лицензию для ТЕКУЩЕЙ машины и сохраняет в userData.
    // Используется при First Run Setup.
    ipcMain.handle('license-admin:generate-own-license', withFirstRunOrAdmin(async () => {
        try {
            assertPrivateKeyExists();

            const { getFingerprint } = require('./fingerprint.cjs');
            let fingerprint;
            try {
                fingerprint = getFingerprint();
            } catch (err) {
                return { success: false, error: `Не удалось получить fingerprint: ${err.message}` };
            }

            const { licenseJson } = _buildAndSaveLicenseRecord({
                fingerprint,
                userName: 'Разработчик',
                expiresAt: null,
                notes: 'Автоматически создана при First Run Setup',
            });

            const licenseDest = path.join(app.getPath('userData'), 'license.json');
            fs.writeFileSync(licenseDest, licenseJson, 'utf8');

            logAudit('license-admin:generate-own-license', { fingerprint });
            logger.info('[LicenseAdmin] Own license generated and saved to userData');

            return { success: true };
        } catch (err) {
            logger.error('[LicenseAdmin] generate-own-license error:', err.message);
            return { success: false, error: err.message };
        }
    }));

    // ── license-admin:create-client-bundle ────────────────────────────────────
    // Создаёт юзера (doctor) + генерирует license.json за один атомарный шаг.
    // args: { fingerprint, clientName, username, password, expiresAt, notes }
    ipcMain.handle('license-admin:create-client-bundle', withAdmin(async (_event, args) => {
        try {
            assertPrivateKeyExists();

            const { fingerprint, clientName, username, password, expiresAt, notes } = args || {};

            if (!fingerprint || !/^[a-f0-9]{64}$/i.test(fingerprint)) {
                return { success: false, error: 'Неверный fingerprint: должно быть 64 hex-символа' };
            }
            if (!clientName || !clientName.trim()) {
                return { success: false, error: 'ФИО клиента обязательно' };
            }
            if (!username || username.trim().length < 3) {
                return { success: false, error: 'Логин должен быть минимум 3 символа' };
            }
            if (!password || password.length < 6) {
                return { success: false, error: 'Пароль должен быть минимум 6 символов' };
            }
            if (expiresAt && isNaN(new Date(expiresAt).getTime())) {
                return { success: false, error: `Неверный формат даты: ${expiresAt}` };
            }

            const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
            if (existing) {
                return { success: false, error: `Логин «${username}» уже занят` };
            }

            const passwordHash = await bcrypt.hash(password, 10);
            const newUser = await prisma.$transaction(async (tx) => {
                const created = await tx.user.create({
                    data: {
                        username: username.trim(),
                        passwordHash,
                        lastName: clientName.trim(),
                        firstName: '',
                        middleName: '',
                        isAdmin: false,
                        isActive: true,
                    },
                });

                const roleDoctor = await tx.role.upsert({
                    where: { key: 'doctor' },
                    update: {},
                    create: { key: 'doctor' },
                });

                await tx.userRole.create({
                    data: { userId: created.id, roleId: roleDoctor.id },
                });

                return created;
            });

            const { licenseJson } = _buildAndSaveLicenseRecord({
                fingerprint,
                userName: clientName.trim(),
                expiresAt: expiresAt || null,
                notes: (notes || '').trim(),
                username: username.trim(),
                passwordHash,
            });

            logAudit('license-admin:create-client-bundle', {
                username: newUser.username,
                userId: newUser.id,
                fingerprint,
            });
            logger.info(`[LicenseAdmin] Client bundle: user "${newUser.username}" + license for "${clientName}"`);

            return {
                success: true,
                licenseContent: licenseJson,
                suggestedName: `license-${clientName.trim().replace(/\s+/g, '_')}.json`,
                username: newUser.username,
            };
        } catch (err) {
            logger.error('[LicenseAdmin] create-client-bundle error:', err.message);
            return { success: false, error: err.message };
        }
    }));
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Строит запись реестра, подписывает её и сохраняет в реестр.
 * @returns {{ record: object, licenseJson: string }}
 */
function _buildAndSaveLicenseRecord({ fingerprint, userName, expiresAt, notes, username, passwordHash }) {
    const payloadObj = {
        fingerprint: fingerprint.toLowerCase(),
        userName: userName.trim(),
        issuedAt: new Date().toISOString(),
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        version: 1,
    };

    // Variant A: optionally bind login credentials to signed payload.
    // Backward compatibility: licenses without these fields remain valid.
    if (username && passwordHash) {
        payloadObj.username = username.trim();
        payloadObj.passwordHash = passwordHash;
    }

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

    const licenseJson = JSON.stringify({ payload, signature }, null, 2);
    return { record, licenseJson };
}

module.exports = { setupLicenseAdminHandlers };
