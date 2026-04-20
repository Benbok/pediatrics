'use strict';

/**
 * IPC Handlers for AI Provider Routing
 *
 * Channels:
 *   ai-routing:get-all  → [{id, label, provider}]
 *   ai-routing:set      → { featureId: string, provider: 'local'|'gemini' }
 */

const { ipcMain } = require('electron');
const { ensureAuthenticated } = require('../../auth.cjs');
const { logAudit } = require('../../logger.cjs');
const aiRoutingStore = require('../../services/aiRoutingStore.cjs');

const setupAiRoutingHandlers = () => {
    ipcMain.handle('ai-routing:get-all', ensureAuthenticated(async () => {
        return aiRoutingStore.getAll();
    }));

    ipcMain.handle('ai-routing:set', ensureAuthenticated(async (_, { featureId, provider }) => {
        await aiRoutingStore.set(featureId, provider);
        logAudit('AI_ROUTING_CHANGED', { featureId, provider });
        return { ok: true };
    }));
};

module.exports = { setupAiRoutingHandlers };
