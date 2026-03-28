'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '@/lib/utils';
import { TrendingUp, DollarSign, BarChart3, Coins } from 'lucide-react';
import type { GlobalData } from '@/lib/types/market';

/**
 * Global market statistics — futuristic score cards with neon accents
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
        // Silently fail — supplementary data
      }
    }

    fetchGlobal();
  }, []);

  if (!data) return null;

  const stats = [
    {
      label: 'Market Cap',
      value: formatCurrency(data.total_market_cap.usd, true),
      icon: DollarSign,
      accent: 'text-primary',
      border: 'border-primary/20',
    },
    {
      label: '24h Volume',
      value: formatCurrency(data.total_volume.usd, true),
      icon: BarChart3,
      accent: 'text-[#a855f7]',
      border: 'border-[#a855f7]/20',
    },
    {
      label: 'BTC Dominance',
      value: `${data.market_cap_percentage.btc.toFixed(1)}%`,
      icon: TrendingUp,
      accent: 'text-[#f59e0b]',
      border: 'border-[#f59e0b]/20',
    },
    {
      label: 'Active Coins',
      value: data.active_cryptocurrencies.toLocaleString(),
      icon: Coins,
      accent: 'text-success',
      border: 'border-success/20',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 stagger-children">
      {stats.map(({ label, value, icon: Icon, accent, border }) => (
        <div
          key={label}
          className={`score-card rounded-lg ${border} border bg-card p-4 overflow-hidden`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-display font-medium uppercase tracking-wider text-muted-foreground">
              {label}
            </span>
            <Icon className={`h-4 w-4 ${accent} opacity-60`} />
          </div>
          <div className="text-lg font-bold font-mono">
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
