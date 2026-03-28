import { create } from 'zustand';
import { authFetch } from '@/lib/auth-fetch';
import type { VirtualPortfolio, VirtualHolding, VirtualTrade } from '@/lib/types/virtual-portfolio';

interface VirtualPortfolioState {
  portfolio: VirtualPortfolio | null;
  holdings: VirtualHolding[];
  trades: VirtualTrade[];
  totalValue: number;
  totalPnl: number;
  totalPnlPercent: number;
  isLoading: boolean;
  error: string | null;
  fetchPortfolio: () => Promise<void>;
  clearError: () => void;
}

/**
 * Virtual portfolio store — manages simulated trading portfolio state
 */
export const useVirtualPortfolioStore = create<VirtualPortfolioState>((set) => ({
  portfolio: null,
  holdings: [],
  trades: [],
  totalValue: 0,
  totalPnl: 0,
  totalPnlPercent: 0,
  isLoading: false,
  error: null,

  fetchPortfolio: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await authFetch('/api/virtual-portfolio');
      if (!response.ok) throw new Error('Failed to fetch virtual portfolio');

      const data = await response.json() as {
        portfolio: VirtualPortfolio;
        holdings: VirtualHolding[];
        trades: VirtualTrade[];
        totalValue: number;
        totalPnl: number;
        totalPnlPercent: number;
      };

      set({
        portfolio: data.portfolio,
        holdings: data.holdings,
        trades: data.trades,
        totalValue: data.totalValue,
        totalPnl: data.totalPnl,
        totalPnlPercent: data.totalPnlPercent,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },

  clearError: () => set({ error: null }),
}));
