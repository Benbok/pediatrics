/**
 * AI Routing Service (Frontend)
 *
 * Manages per-feature AI provider preference (local LLM vs Gemini API).
 */

export interface AiRoutingEntry {
  id: string;
  label: string;
  provider: 'local' | 'gemini';
}

export const aiRoutingService = {
  /** Get routing config for all features */
  async getAll(): Promise<AiRoutingEntry[]> {
    return await window.electronAPI.getAiRouting();
  },

  /** Set provider for a specific feature */
  async set(featureId: string, provider: 'local' | 'gemini'): Promise<{ ok: boolean }> {
    return await window.electronAPI.setAiRouting(featureId, provider);
  },
};
