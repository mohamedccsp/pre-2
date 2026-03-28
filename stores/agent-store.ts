import { create } from 'zustand';
import { authFetch } from '@/lib/auth-fetch';
import type { ResearchHistoryItem } from '@/lib/types/agent';

interface AgentState {
  history: ResearchHistoryItem[];
  isLoading: boolean;
  error: string | null;
  submitQuery: (query: string) => Promise<void>;
  clearHistory: () => void;
  clearError: () => void;
}

/**
 * Agent store — manages research query history and loading state
 */
export const useAgentStore = create<AgentState>((set) => ({
  history: [],
  isLoading: false,
  error: null,

  submitQuery: async (query: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await authFetch('/api/agents/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const data = await response.json() as { error: string };
        throw new Error(data.error || 'Research request failed');
      }

      const data = await response.json() as {
        agentName: string;
        result: string;
        sources: string[];
        timestamp: number;
        auditId: string;
        queryType: string;
        coinIds: string[];
      };

      const item: ResearchHistoryItem = {
        id: data.auditId || crypto.randomUUID(),
        query,
        queryType: data.queryType as ResearchHistoryItem['queryType'],
        result: data.result,
        sources: data.sources,
        timestamp: data.timestamp,
        auditId: data.auditId,
      };

      set((state) => ({
        history: [item, ...state.history],
        isLoading: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },

  clearHistory: () => set({ history: [] }),
  clearError: () => set({ error: null }),
}));
