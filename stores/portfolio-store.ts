import { create } from 'zustand';
import { authFetch } from '@/lib/auth-fetch';
import type { PortfolioItem, AddPortfolioInput } from '@/lib/types/portfolio';

interface PortfolioState {
  items: PortfolioItem[];
  isLoading: boolean;
  error: string | null;
  fetchPortfolio: () => Promise<void>;
  addItem: (input: AddPortfolioInput) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}

/**
 * Portfolio store — manages user's portfolio with DB persistence via API
 */
export const usePortfolioStore = create<PortfolioState>((set) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchPortfolio: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await authFetch('/api/portfolio');
      if (!response.ok) throw new Error('Failed to fetch portfolio');
      const data = await response.json() as PortfolioItem[];
      set({ items: data, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message, isLoading: false });
    }
  },

  addItem: async (input) => {
    set({ error: null });
    try {
      const response = await authFetch('/api/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error('Failed to add item');
      const item = await response.json() as PortfolioItem;
      set((state) => ({ items: [...state.items, item] }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },

  removeItem: async (id) => {
    set({ error: null });
    try {
      const response = await authFetch(`/api/portfolio/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to remove item');
      set((state) => ({ items: state.items.filter((item) => item.id !== id) }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      set({ error: message });
    }
  },
}));
