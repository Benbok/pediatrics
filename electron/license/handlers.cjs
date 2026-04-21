'use strict';

/**
 * LICENSE IPC HANDLERS
 *
 * Регистрирует IPC-обработчики для системы лицензирования:
 *   license:get-fingerprint  — Возвращает отпечаток машины для отображения
 *   license:check            — Проверяет текущую лицензию
 *   license:import           — Открывает диалог выбора файла и импортирует лицензию
 *
 * В режиме разработки (isDev = !app.isPackaged) лицензия не требуется.
 */

const { ipcMain, dialog, app } = require('electron');
const path = require('path');
const fs = require('fs');
const { getFingerprint, getDisplayFingerprint } = require('./fingerprint.cjs');
const { verifyLicense } = require('./verify.cjs');
const { logger, logAudit } = require('../logger.cjs');
const { prisma } = require('../prisma-client.cjs');

const isDev = !app.isPackaged;

/**
 * Возвращает путь к файлу лицензии в userData директории.
 * В продакшне: %APPDATA%\pediassist\license.json
 */
function getLicensePath() {
    return path.join(app.getPath('userData'), 'license.json');
}

function toPublicLicenseData(data) {
    return {
        userName: data.userName,
        expiresAt: data.expiresAt,
        username: data.username,
    };
}

/**
 * Auto-provisions a local doctor account from signed Variant A credentials.
 * Backward compatibility: if credentials are absent, returns success with manual credential flow required.
 *
 * @param {{ userName: string, username?: string, passwordHash?: string }} licenseData
 * @returns {Promise<{ success: boolean, autoProvisioned: boolean, requiresManualCredentials: boolean, username?: string, reason?: string }>}
 */
async function autoProvisionUserFromLicense(licenseData) {
    const username = typeof licenseData.username === 'string' ? licenseData.username.trim() : '';
    const passwordHash = typeof licenseData.passwordHash === 'string' ? licenseData.passwordHash : '';

    if (!username || !passwordHash) {
        return { success: true, autoProvisioned: false, requiresManualCredentials: true };
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const roleAdmin = await tx.role.upsert({
                where: { key: 'admin' },
                update: {},
                create: { key: 'admin' },
            });
            const roleDoctor = await tx.role.upsert({
                where: { key: 'doctor' },
                update: {},
                create: { key: 'doctor' },
            });

            const existing = await tx.user.findUnique({ where: { username } });
            if (existing) {
                // Keep imported credentials authoritative for this licensed local admin account.
                await tx.user.update({
                    where: { id: existing.id },
                    data: {
                        passwordHash,
                        isAdmin: true,
                        isActive: true,
                    },
                });

                const existingRoleRows = await tx.userRole.findMany({
                    where: {
                        userId: existing.id,
                        roleId: { in: [roleAdmin.id, roleDoctor.id] },
                    },
                });
                const existingRoleIds = new Set(existingRoleRows.map((r) => r.roleId));
                const missingRoleIds = [roleAdmin.id, roleDoctor.id].filter((roleId) => !existingRoleIds.has(roleId));

                if (missingRoleIds.length > 0) {
                    await tx.userRole.createMany({
                        data: missingRoleIds.map((roleId) => ({ userId: existing.id, roleId })),
                    });
                }

                return { status: 'existing', username: existing.username };
            }

            const created = await tx.user.create({
                data: {
                    username,
                    passwordHash,
                    lastName: (licenseData.userName || username).trim(),
                    firstName: '',
                    middleName: '',
                    isAdmin: true,
                    isActive: true,
                },
            });

            await tx.userRole.createMany({
                data: [
                    { userId: created.id, roleId: roleAdmin.id },
                    { userId: created.id, roleId: roleDoctor.id },
                ],
            });

            return { status: 'created', username: created.username };
        });

        const autoProvisioned = result.status === 'created' || result.status === 'existing';
        return {
            success: true,
            autoProvisioned,
            requiresManualCredentials: false,
            username: result.username,
        };
    } catch (err) {
        logger.error('[License] Auto-provision failed:', err.message);
        return {
            success: false,
            autoProvisioned: false,
            requiresManualCredentials: false,
            reason: 'Не удалось автоматически создать пользователя из лицензии: ' + err.message,
        };
    }
}

/**
 * Проверяет текущую лицензию.
 * @returns {{ valid: boolean, reason?: string, data?: object, devMode?: boolean }}
 */
async function checkCurrentLicense() {
    // Dev mode bypass — полная функциональность без лицензии
    if (isDev) {
        return { valid: true, devMode: true, data: { userName: 'Разработчик', expiresAt: null } };
    }

    const licensePath = getLicensePath();

    if (!fs.existsSync(licensePath)) {
        return { valid: false, reason: 'Лицензионный файл не найден. Обратитесь к разработчику.' };
    }

    let fingerprint;
    try {
        fingerprint = getFingerprint();
    } catch (err) {
        logger.error('[License] Cannot get machine fingerprint:', err.message);
        return { valid: false, reason: 'Не удалось определить идентификатор машины: ' + err.message };
    }

    const result = verifyLicense(licensePath, fingerprint);
    if (!result.valid) return result;

    return {
        ...result,
        data: toPublicLicenseData(result.data),
    };
}

/**
 * Регистрирует все IPC-обработчики лицензирования.
 * Вызывать из electron/main.cjs до создания окна.
 */
function setupLicenseHandlers() {
    // ── license:get-fingerprint ───────────────────────────────────────────────
    // Возвращает отпечаток машины для отображения на экране активации.
    // Намеренно работает БЕЗ проверки аутентификации (юзер ещё не вошёл).
    ipcMain.handle('license:get-fingerprint', async () => {
        if (isDev) {
            return {
                fingerprint: 'DEV-MODE-NO-FINGERPRINT-REQUIRED',
                display: 'РЕЖИМ-РАЗРАБОТКИ-XXXX-XXXX'
            };
        }
        try {
            const fingerprint = getFingerprint();
            const display = getDisplayFingerprint();
            return { fingerprint, display };
        } catch (err) {
            logger.error('[License] getFingerprint error:', err.message);
            return { fingerprint: null, display: 'ОШИБКА-ПОЛУЧЕНИЯ-ID', error: err.message };
        }
    });

    // ── license:check ─────────────────────────────────────────────────────────
    // Синхронная проверка текущей лицензии. Вызывается рендерером при старте.
    ipcMain.handle('license:check', async () => {
        const result = await checkCurrentLicense();
        if (!result.valid) {
            logger.warn('[License] License check failed:', result.reason);
        }
        return result;
    });

    // ── license:import ────────────────────────────────────────────────────────
    // Открывает диалог выбора файла лицензии, копирует в userData и верифицирует.
    // Не требует аутентификации (юзер на экране активации, до входа).
    ipcMain.handle('license:import', async (event) => {
        const { BrowserWindow } = require('electron');
        const win = BrowserWindow.fromWebContents(event.sender);

        // Open file dialog
        const { canceled, filePaths } = await dialog.showOpenDialog(win, {
            title: 'Выберите файл лицензии',
            defaultPath: app.getPath('downloads'),
            filters: [
                { name: 'Файл лицензии PediAssist', extensions: ['json'] },
                { name: 'Все файлы', extensions: ['*'] }
            ],
            properties: ['openFile'],
        });

        if (canceled || !filePaths.length) {
            return { success: false, reason: 'Импорт отменён пользователем' };
        }

        const selectedPath = filePaths[0];
        logger.info('[License] User selected license file:', selectedPath);

        // Pre-verify: check signature and fingerprint before saving
        let fingerprint;
        try {
            fingerprint = getFingerprint();
        } catch (err) {
            return { success: false, reason: 'Не удалось получить идентификатор машины: ' + err.message };
        }

        const verifyResult = verifyLicense(selectedPath, fingerprint);
        if (!verifyResult.valid) {
            logAudit('LICENSE_IMPORT_REJECTED', { reason: verifyResult.reason, file: selectedPath });
            return { success: false, reason: verifyResult.reason };
        }

        const provisionResult = await autoProvisionUserFromLicense(verifyResult.data);
        if (!provisionResult.success) {
            logAudit('LICENSE_IMPORT_PROVISION_FAILED', {
                userName: verifyResult.data.userName,
                reason: provisionResult.reason,
            });
            return { success: false, reason: provisionResult.reason };
        }

        // Copy license file to userData
        const destPath = getLicensePath();
        try {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
            fs.copyFileSync(selectedPath, destPath);
        } catch (err) {
            logger.error('[License] Failed to save license file:', err.message);
            return { success: false, reason: 'Не удалось сохранить файл лицензии: ' + err.message };
        }

        logAudit('LICENSE_IMPORTED', { userName: verifyResult.data.userName });
        logger.info('[License] License imported successfully for:', verifyResult.data.userName);

        if (provisionResult.autoProvisioned) {
            logAudit('LICENSE_USER_AUTO_PROVISIONED', {
                userName: verifyResult.data.userName,
                username: provisionResult.username,
            });
        }

        return {
            success: true,
            data: toPublicLicenseData(verifyResult.data),
            autoProvisioned: provisionResult.autoProvisioned,
            requiresManualCredentials: provisionResult.requiresManualCredentials,
            username: provisionResult.username,
        };
    });

    logger.info('[License] License handlers registered');
}

module.exports = { setupLicenseHandlers, checkCurrentLicense };
