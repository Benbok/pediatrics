/**
 * API Key Service (Frontend)
 *
 * Сервис для управления и мониторинга пула API ключей.
 * Ключи хранятся зашифрованными в приложении — в UI передаются только метаданные.
 */

export interface ApiKeyEntry {
  id: string;
  label: string;
  model: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKeyStatus {
  index: number;
  status: 'active' | 'failed';
  errorCount: number;
  lastUsed: string | null;
  lastError: string | null;
}

export interface PoolStatus {
  total: number;
  active: number;
  failed: number;
  currentKeyIndex: number;
  needsAttention: boolean; // true если active <= 2
  keys: ApiKeyStatus[];
}

export interface ApiKeyConnectivityResult {
  index: number;
  ok: boolean;
  status: 'ok' | 'invalid_key' | 'permission' | 'network' | 'timeout' | 'rate_limited' | 'unknown';
  message: string;
  latencyMs: number | null;
  checkedAt: string;
}

export interface ApiKeysConnectivityReport {
  totalTested: number;
  ok: number;
  failed: number;
  byStatus: Record<string, number>;
  onlyActive: boolean;
  timeoutMs: number;
  results: ApiKeyConnectivityResult[];
}

export const apiKeyService = {
  // ── Pool management ────────────────────────────────────────────────────────

  async getPoolStatus(): Promise<PoolStatus> {
    return await window.electronAPI.getApiKeysPoolStatus();
  },

  async resetKey(keyIndex: number): Promise<boolean> {
    return await window.electronAPI.resetApiKey(keyIndex);
  },

  async resetAllKeys(): Promise<boolean> {
    return await window.electronAPI.resetAllApiKeys();
  },

  async reloadKeysFromEnv(): Promise<{ success: boolean; keysCount: number }> {
    return await window.electronAPI.reloadApiKeysFromEnv();
  },

  async testConnectivity(options?: { onlyActive?: boolean; timeoutMs?: number }): Promise<ApiKeysConnectivityReport> {
    return await window.electronAPI.testApiKeysConnectivity(options);
  },

  // ── CRUD (in-app encrypted storage) ───────────────────────────────────────

  /** List stored keys — metadata only, no raw values */
  async listKeys(): Promise<ApiKeyEntry[]> {
    return await window.electronAPI.listApiKeys();
  },

  /** Add a new key. `value` is the raw API key (AIza...) — never stored in plain text. */
  async addKey(label: string, value: string, model?: string): Promise<{ id: string }> {
    return await window.electronAPI.addApiKey(label, value, model);
  },

  /** Delete a key by id */
  async deleteKey(id: string): Promise<boolean> {
    return await window.electronAPI.deleteApiKey(id);
  },

  /** Rename a key */
  async updateKeyLabel(id: string, label: string): Promise<boolean> {
    return await window.electronAPI.updateApiKeyLabel(id, label);
  },

  /** Change the model associated with a key */
  async updateModel(id: string, model: string): Promise<boolean> {
    return await window.electronAPI.updateApiKeyModel(id, model);
  },

  /** Set key as primary (used first in rotation) */
  async setPrimary(id: string): Promise<boolean> {
    return await window.electronAPI.setApiKeyPrimary(id);
  },

  /** Test a single key by id using its stored model */
  async testSingleKey(id: string): Promise<{ ok: boolean; status: string; message: string; latencyMs: number | null; model: string | null; checkedAt: string }> {
    return await window.electronAPI.testSingleApiKey(id);
  },
};
