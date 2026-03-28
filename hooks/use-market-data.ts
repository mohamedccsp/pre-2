'use client';

import { useEffect, useRef } from 'react';
import { useMarketStore } from '@/stores/market-store';
import { createPriceStream, mapFromGeckoId } from '@/lib/api/coincap';
import type { CoinMarket } from '@/lib/types/market';

/**
 * Hook to fetch market data and subscribe to live price updates
 * Fetches top coins on mount and opens WebSocket for real-time prices
 */
export function useMarketData() {
  const { coins, livePrices, isLoading, error, setCoins, updateLivePrices, setLoading, setError } =
    useMarketStore();
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    /**
     * Fetch initial coin data from the API proxy
     */
    async function fetchCoins() {
      setLoading(true);
      const MAX_ATTEMPTS = 3;

      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          const response = await fetch('/api/market/coins');
          if (!response.ok) throw new Error('Failed to fetch coins');
          const data = await response.json() as CoinMarket[];
          if (!cancelled) {
            setCoins(data);

            // Start WebSocket for live prices
            const assets = data.slice(0, 20).map((coin) => mapFromGeckoId(coin.id));
            cleanupRef.current?.();
            cleanupRef.current = createPriceStream(assets, (prices) => {
              updateLivePrices(prices);
            });
          }
          return; // Success — exit retry loop
        } catch (err) {
          if (cancelled) return;
          if (attempt < MAX_ATTEMPTS - 1) {
            await new Promise((r) => setTimeout(r, 2000 * Math.pow(2, attempt)));
            continue;
          }
          setError(err instanceof Error ? err.message : 'Unknown error');
        }
      }
    }

    fetchCoins();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
    };
  }, [setCoins, updateLivePrices, setLoading, setError]);

  return { coins, livePrices, isLoading, error };
}
