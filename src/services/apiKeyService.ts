/**
 * API Key Service (Frontend)
 * 
 * Сервис для мониторинга и управления пулом API ключей
 */

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
  /**
   * Получить статус пула ключей
   */
  async getPoolStatus(): Promise<PoolStatus> {
    return await window.electronAPI.getApiKeysPoolStatus();
  },

  /**
   * Сбросить статус конкретного ключа
   */
  async resetKey(keyIndex: number): Promise<boolean> {
    return await window.electronAPI.resetApiKey(keyIndex);
  },

  /**
   * Сбросить статусы всех ключей
   */
  async resetAllKeys(): Promise<boolean> {
    return await window.electronAPI.resetAllApiKeys();
  },

  /**
   * Перезагрузить ключи из .env файла
   */
  async reloadKeysFromEnv(): Promise<{ success: boolean; keysCount: number }> {
    return await window.electronAPI.reloadApiKeysFromEnv();
  },

  /**
   * Проверить доступность Gemini API для ключей пула
   */
  async testConnectivity(options?: { onlyActive?: boolean; timeoutMs?: number }): Promise<ApiKeysConnectivityReport> {
    return await window.electronAPI.testApiKeysConnectivity(options);
  }
};
