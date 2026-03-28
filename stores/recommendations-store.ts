import { create } from 'zustand';
import { authFetch } from '@/lib/auth-fetch';
import type { Recommendation } from '@/lib/types/recommendation';
import type { CycleResult } from '@/lib/autonomous/cycle';

interface RecommendationsState {
  recommendations: Recommendation[];
  isLoading: boolean;
  isAnalyzing: boolean;
  error: string | null;
  isRunningCycle: boolean;
  cycleResult: CycleResult | null;
  cycleError: string | null;
  fetchRecommendations: () => Promise<void>;
  analyzeCoin: (coinId: string) => Promise<void>;
  approveRecommendation: (id: string) => Promise<void>;
  rejectRecommendation: (id: string, reason?: string) => Promise<void>;
  runAutonomousCycle: () => Promise<void>;
  clearError: () => void;
  clearCycleError: () => void;
}

/**
 * Recommendations store — manages HITL recommendation lifecycle
 */
export const useRecommendationsStore = create<RecommendationsState>((set, get) => ({
  recommendations: [],
  isLoading: false,
  isAnalyzing: false,
  error: null,
  isRunningCycle: false,
  cycleResult: null,
  cycleError: null,

  fetchRecommendations: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await authFetch('/api/agents/recommendations');
      if (!response.ok) throw new Error('Failed to fetch recommendations');
      const data = await response.json() as Recommendation[];
      set({ recommendations: data, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },

  analyzeCoin: async (coinId: string) => {
    set({ isAnalyzing: true, error: null });
    try {
      const response = await authFetch('/api/agents/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coinId }),
      });

      if (!response.ok) {
        const data = await response.json() as { error: string };
        throw new Error(data.error || 'Analysis failed');
      }

      const recommendation = await response.json() as Recommendation;
      set((state) => ({
        recommendations: [recommendation, ...state.recommendations],
        isAnalyzing: false,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, isAnalyzing: false });
    }
  },

  approveRecommendation: async (id: string) => {
    set({ error: null });
    try {
      const response = await authFetch(`/api/agents/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      if (!response.ok) {
        const data = await response.json() as { error: string };
        throw new Error(data.error || 'Approval failed');
      }

      const data = await response.json() as { recommendation: Recommendation };
      set((state) => ({
        recommendations: state.recommendations.map((r) =>
          r.id === id ? data.recommendation : r
        ),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  rejectRecommendation: async (id: string, reason?: string) => {
    set({ error: null });
    try {
      const response = await authFetch(`/api/agents/recommendations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason }),
      });

      if (!response.ok) {
        const data = await response.json() as { error: string };
        throw new Error(data.error || 'Rejection failed');
      }

      const rejected = await response.json() as Recommendation;
      set((state) => ({
        recommendations: state.recommendations.map((r) =>
          r.id === id ? rejected : r
        ),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  runAutonomousCycle: async () => {
    set({ isRunningCycle: true, cycleError: null });
    try {
      const response = await authFetch('/api/agents/autonomous/cycle', { method: 'POST' });
      if (!response.ok) {
        const data = await response.json() as { error: string };
        throw new Error(data.error || 'Autonomous cycle failed');
      }
      const result = await response.json() as CycleResult;
      set({ cycleResult: result, isRunningCycle: false });
      // Refresh recommendations so newly created recs appear
      get().fetchRecommendations();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cycle failed';
      set({ cycleError: message, isRunningCycle: false });
    }
  },

  clearError: () => set({ error: null }),
  clearCycleError: () => set({ cycleError: null }),
}));
