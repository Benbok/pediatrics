/**
 * IPC Handlers for API Key Pool Management
 */

const { ipcMain } = require('electron');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit } = require('../../logger.cjs');
const { apiKeyManager } = require('../../services/apiKeyManager.cjs');
const apiKeyStore = require('../../services/apiKeyStore.cjs');

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
     * Reload Keys from store (legacy channel name preserved for backward compatibility)
     */
    ipcMain.handle('api-keys:reload-from-env', ensureAuthenticated(async () => {
        const result = await apiKeyManager.reloadFromStore();
        logAudit('API_KEYS_RELOADED', { count: result.keysCount });
        return result;
    }));

    /**
     * Test Connectivity for API Key Pool
     */
    ipcMain.handle('api-keys:test-connectivity', ensureAuthenticated(async (_, options) => {
        const result = await apiKeyManager.testPoolConnectivity(options || {});
        logAudit('API_KEYS_CONNECTIVITY_TEST', {
            totalTested: result.totalTested,
            ok: result.ok,
            failed: result.failed,
            onlyActive: result.onlyActive
        });
        return result;
    }));

    // ── CRUD handlers ─────────────────────────────────────────────────────────

    /**
     * List stored keys (metadata only — no raw or encrypted values)
     */
    ipcMain.handle('api-keys:list', ensureAuthenticated(async () => {
        return apiKeyStore.listKeys();
    }));

    /**
     * Add a new key
     * Payload: { label: string, value: string }
     */
    ipcMain.handle('api-keys:add', ensureAuthenticated(async (_, { label, value, model }) => {
        const result = await apiKeyStore.addKey(label, value, model);
        // Reload the manager pool so the new key is immediately usable
        await apiKeyManager.reloadFromStore();
        logAudit('API_KEY_ADDED', { label, model });
        return result;
    }));

    /**
     * Delete a key by id
     * Payload: { id: string }
     */
    ipcMain.handle('api-keys:delete', ensureAuthenticated(async (_, { id }) => {
        const result = await apiKeyStore.deleteKey(id);
        await apiKeyManager.reloadFromStore();
        logAudit('API_KEY_DELETED', { id });
        return result;
    }));

    /**
     * Update a key's label
     * Payload: { id: string, label: string }
     */
    ipcMain.handle('api-keys:update-label', ensureAuthenticated(async (_, { id, label }) => {
        const result = await apiKeyStore.updateLabel(id, label);
        logAudit('API_KEY_LABEL_UPDATED', { id, label });
        return result;
    }));

    ipcMain.handle('api-keys:update-model', ensureAuthenticated(async (_, { id, model }) => {
        const result = await apiKeyStore.updateModel(id, model);
        logAudit('API_KEY_MODEL_UPDATED', { id, model });
        await apiKeyManager.reloadFromStore();
        return result;
    }));

    ipcMain.handle('api-keys:set-primary', ensureAuthenticated(async (_, { id }) => {
        const result = await apiKeyStore.setPrimary(id);
        logAudit('API_KEY_PRIMARY_SET', { id });
        await apiKeyManager.reloadFromStore({ resetIndex: true });
        return result;
    }));

    /**
     * Test a single stored key by id using its stored model
     */
    ipcMain.handle('api-keys:test-key', ensureAuthenticated(async (_, { id }) => {
        const result = await apiKeyManager.testKeyById(id, 10000);
        logAudit('API_KEY_TEST_SINGLE', { id, ok: result.ok, status: result.status });
        return result;
    }));
};

module.exports = { setupApiKeyHandlers };
