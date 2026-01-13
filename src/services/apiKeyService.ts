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
  }
};
