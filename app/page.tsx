'use client';

import { useMarketData } from '@/hooks/use-market-data';
import { CoinTable } from '@/components/coin-table';
import { GlobalStats } from '@/components/global-stats';
import { TickerBar } from '@/components/ticker-bar';
import { CoinTableSkeleton } from '@/components/loading-skeleton';
import { Activity } from 'lucide-react';

/**
 * Dashboard home page — top 20 coins with live price updates and ticker
 */
export default function DashboardPage() {
  const { coins, livePrices, isLoading, error } = useMarketData();

  return (
    <div>
      {/* Running ticker bar */}
      <div className="-mx-4 -mt-6 mb-6">
        <TickerBar />
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold tracking-wide">
            Market Overview
          </h1>
        </div>
        <p className="text-muted-foreground text-sm ml-11">
          Top cryptocurrencies by market cap with real-time prices
        </p>
      </div>

      {/* Score cards */}
      <GlobalStats />

      {error && (
        <div className="mb-4 rounded-lg neon-border-red bg-destructive/5 p-4 text-destructive text-sm">
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
