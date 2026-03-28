'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { PriceChart } from '@/components/price-chart';
import { Skeleton } from '@/components/loading-skeleton';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { CoinDetail } from '@/lib/types/market';

/**
 * Coin detail page — shows price chart, stats, and description
 */
export default function CoinDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [coin, setCoin] = useState<CoinDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /**
     * Fetch coin detail from the API proxy
     */
    async function fetchCoin() {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/market/coin/${id}`);
        if (!response.ok) throw new Error('Failed to fetch coin details');
        const data = await response.json() as CoinDetail;
        setCoin(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    }

    if (id) fetchCoin();
  }, [id]);

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive">
        {error}
      </div>
    );
  }

  if (isLoading || !coin) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  const { market_data } = coin;

  return (
    <div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex items-center gap-4 mb-6">
        <Image
          src={coin.image.large}
          alt={coin.name}
          className="h-12 w-12 rounded-full"
          width={48}
          height={48}
          unoptimized
        />
        <div>
          <h1 className="text-2xl font-display font-bold tracking-wide">{coin.name}</h1>
          <span className="text-muted-foreground uppercase">{coin.symbol}</span>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-bold font-mono">
            {formatCurrency(market_data.current_price.usd)}
          </div>
          <div
            className={`font-mono ${
              market_data.price_change_percentage_24h >= 0
                ? 'text-success'
                : 'text-destructive'
            }`}
          >
            {formatPercent(market_data.price_change_percentage_24h)}
          </div>
        </div>
      </div>

      <PriceChart coinId={id} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <StatCard label="Market Cap" value={formatCurrency(market_data.market_cap.usd, true)} />
        <StatCard label="24h Volume" value={formatCurrency(market_data.total_volume.usd, true)} />
        <StatCard
          label="Circulating Supply"
          value={`${market_data.circulating_supply.toLocaleString()} ${coin.symbol.toUpperCase()}`}
        />
        <StatCard label="All-Time High" value={formatCurrency(market_data.ath.usd)} />
      </div>

      <div className="grid grid-cols-3 gap-4 mt-4">
        <StatCard label="7d Change" value={formatPercent(market_data.price_change_percentage_7d)} colored />
        <StatCard label="30d Change" value={formatPercent(market_data.price_change_percentage_30d)} colored />
        <StatCard label="All-Time Low" value={formatCurrency(market_data.atl.usd)} />
      </div>

      {coin.description.en && (
        <div className="mt-6">
          <h2 className="text-lg font-display font-bold tracking-wide mb-2">About {coin.name}</h2>
          <div
            className="text-sm text-muted-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: coin.description.en.split('. ').slice(0, 5).join('. ') + '.' }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Stat card for displaying a single metric
 * @param label - Metric label
 * @param value - Formatted value string
 * @param colored - Whether to color positive/negative values
 */
function StatCard({ label, value, colored }: { label: string; value: string; colored?: boolean }) {
  const isPositive = value.startsWith('+');
  const isNegative = value.startsWith('-');

  return (
    <div className="score-card rounded-lg border border-border/50 bg-card p-4 overflow-hidden">
      <div className="text-[10px] font-display font-medium uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div
        className={`font-mono text-sm font-medium ${
          colored && isPositive
            ? 'text-success'
            : colored && isNegative
              ? 'text-destructive'
              : ''
        }`}
      >
        {value}
      </div>
    </div>
  );
}
