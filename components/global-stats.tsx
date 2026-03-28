'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import type { GlobalData } from '@/lib/types/market';

/**
 * Global market statistics bar — total market cap, volume, BTC dominance
 */
export function GlobalStats() {
  const [data, setData] = useState<GlobalData | null>(null);

  useEffect(() => {
    /**
     * Fetch global market data from the API proxy
     */
    async function fetchGlobal() {
      try {
        const response = await fetch('/api/market/global');
        if (response.ok) {
          const result = await response.json() as GlobalData;
          setData(result);
        }
      } catch {
        // Silently fail — this is supplementary data
      }
    }

    fetchGlobal();
  }, []);

  if (!data) return null;

  return (
    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-6">
      <div>
        <span className="font-medium text-foreground">Market Cap: </span>
        {formatCurrency(data.total_market_cap.usd, true)}
      </div>
      <div>
        <span className="font-medium text-foreground">24h Volume: </span>
        {formatCurrency(data.total_volume.usd, true)}
      </div>
      <div>
        <span className="font-medium text-foreground">BTC Dominance: </span>
        {data.market_cap_percentage.btc.toFixed(1)}%
      </div>
      <div>
        <span className="font-medium text-foreground">Coins: </span>
        {data.active_cryptocurrencies.toLocaleString()}
      </div>
    </div>
  );
}
