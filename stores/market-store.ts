import { create } from 'zustand';
import type { CoinMarket, GlobalData } from '@/lib/types/market';

interface MarketState {
  coins: CoinMarket[];
  globalData: GlobalData | null;
  livePrices: Record<string, number>;
  isLoading: boolean;
  error: string | null;
  setCoins: (coins: CoinMarket[]) => void;
  setGlobalData: (data: GlobalData) => void;
  updateLivePrice: (coinId: string, price: number) => void;
  updateLivePrices: (prices: Record<string, string>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Market data store — manages coin list, global stats, and live prices
 */
export const useMarketStore = create<MarketState>((set) => ({
  coins: [],
  globalData: null,
  livePrices: {},
  isLoading: false,
  error: null,

  setCoins: (coins) => set({ coins, isLoading: false, error: null }),

  setGlobalData: (data) => set({ globalData: data }),

  updateLivePrice: (coinId, price) =>
    set((state) => ({
      livePrices: { ...state.livePrices, [coinId]: price },
    })),

  updateLivePrices: (prices) =>
    set((state) => {
      const updated = { ...state.livePrices };
      for (const [id, price] of Object.entries(prices)) {
        updated[id] = parseFloat(price);
      }
      return { livePrices: updated };
    }),

  setLoading: (loading) => set({ isLoading: loading }),

  setError: (error) => set({ error, isLoading: false }),
}));
