'use client';

import { useMarketData } from '@/hooks/use-market-data';
import { CoinTable } from '@/components/coin-table';
import { GlobalStats } from '@/components/global-stats';
import { CoinTableSkeleton } from '@/components/loading-skeleton';

/**
 * Dashboard home page — top 20 coins with live price updates
 */
export default function DashboardPage() {
  const { coins, livePrices, isLoading, error } = useMarketData();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Market Overview</h1>
        <p className="text-muted-foreground mt-1">
          Top cryptocurrencies by market cap with real-time prices
        </p>
      </div>

      <GlobalStats />

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <CoinTableSkeleton />
      ) : (
        <CoinTable coins={coins} livePrices={livePrices} />
      )}
    </div>
  );
}
