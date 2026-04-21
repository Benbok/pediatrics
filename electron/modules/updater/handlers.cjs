const { autoUpdater } = require('electron-updater');
const { ipcMain } = require('electron');
const { logger } = require('../../logger.cjs');

/**
 * Настраивает автообновление и регистрирует IPC-обработчики.
 * Вызывать только в production-режиме после создания mainWindow.
 *
 * @param {import('electron').BrowserWindow} mainWindow
 */
function setupUpdaterHandlers(mainWindow) {
    // Направить логи updater через project logger
    autoUpdater.logger = logger;

    // Не скачивать автоматически — только по явному запросу пользователя
    autoUpdater.autoDownload = false;

    // Установить после закрытия приложения (если скачано, но пользователь отложил)
    autoUpdater.autoInstallOnAppQuit = true;

    // ────────────────────────────────────────────────────────────
    // События autoUpdater → push в renderer
    // ────────────────────────────────────────────────────────────

    autoUpdater.on('checking-for-update', () => {
        logger.info('[Updater] Checking for update...');
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:checking');
        }
    });

    autoUpdater.on('update-available', (info) => {
        logger.info(`[Updater] Update available: ${info.version}`);
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:update-available', {
                version: info.version,
                releaseDate: info.releaseDate,
                releaseNotes: info.releaseNotes || null,
            });
        }
    });

    autoUpdater.on('update-not-available', (info) => {
        logger.info(`[Updater] No update available. Current version: ${info.version}`);
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:up-to-date');
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        const percent = Math.round(progressObj.percent);
        logger.debug(`[Updater] Download progress: ${percent}%`);
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:download-progress', {
                percent,
                transferred: progressObj.transferred,
                total: progressObj.total,
                bytesPerSecond: progressObj.bytesPerSecond,
            });
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        logger.info(`[Updater] Update downloaded: ${info.version}`);
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:update-downloaded', {
                version: info.version,
            });
        }
    });

    autoUpdater.on('error', (err) => {
        const message = err ? err.message : 'unknown error';
        logger.error(`[Updater] Error: ${message}`);
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:error', { message });
        }
    });

    // ────────────────────────────────────────────────────────────
    // IPC handlers — команды от renderer
    // ────────────────────────────────────────────────────────────

    ipcMain.handle('updater:check', async () => {
        try {
            await autoUpdater.checkForUpdates();
            return { success: true };
        } catch (err) {
            logger.error('[Updater] checkForUpdates failed:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('updater:download', async () => {
        try {
            await autoUpdater.downloadUpdate();
            return { success: true };
        } catch (err) {
            logger.error('[Updater] downloadUpdate failed:', err);
            return { success: false, error: err.message };
        }
    });

    ipcMain.handle('updater:install', () => {
        logger.info('[Updater] quitAndInstall called by renderer');
        setImmediate(() => autoUpdater.quitAndInstall());
        return { success: true };
    });

    // Автопроверка через 5 секунд после запуска
    setTimeout(() => {
        autoUpdater.checkForUpdates().catch((err) => {
            logger.warn('[Updater] Background check failed:', err.message);
        });
    }, 5000);

    logger.info('[Updater] Auto-updater initialized');
}

module.exports = { setupUpdaterHandlers };
