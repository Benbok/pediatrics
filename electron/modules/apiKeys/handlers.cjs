/**
 * IPC Handlers for API Key Pool Management
 */

const { ipcMain } = require('electron');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit } = require('../../logger.cjs');
const { apiKeyManager } = require('../../services/apiKeyManager.cjs');

const setupApiKeyHandlers = () => {
    /**
     * Get Pool Status
     */
    ipcMain.handle('api-keys:get-pool-status', ensureAuthenticated(async () => {
        return apiKeyManager.getPoolStatus();
    }));

    /**
     * Reset Key Status
     */
    ipcMain.handle('api-keys:reset-key', ensureAuthenticated(async (_, keyIndex) => {
        const result = await apiKeyManager.resetKeyStatus(keyIndex);
        logAudit('API_KEY_RESET', { keyIndex });
        return result;
    }));

    /**
     * Reset All Keys Status
     */
    ipcMain.handle('api-keys:reset-all', ensureAuthenticated(async () => {
        await apiKeyManager.resetAllKeys();
        logAudit('API_KEYS_RESET_ALL');
        return true;
    }));

    /**
     * Reload Keys from .env
     */
    ipcMain.handle('api-keys:reload-from-env', ensureAuthenticated(async () => {
        const result = await apiKeyManager.reloadFromEnv();
        logAudit('API_KEYS_RELOADED', { count: result.keysCount });
        return result;
    }));
};

module.exports = { setupApiKeyHandlers };
