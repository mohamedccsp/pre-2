'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { mapFromGeckoId } from '@/lib/api/coincap';
import type { CoinMarket } from '@/lib/types/market';

interface CoinTableProps {
  coins: CoinMarket[];
  livePrices: Record<string, number>;
}

/**
 * Sparkline mini-chart from 7d price data
 * @param prices - Array of price values
 * @param isUp - Whether trend is positive
 */
function Sparkline({ prices, isUp }: { prices?: number[]; isUp: boolean }) {
  if (!prices || prices.length === 0) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const w = 80;
  const h = 28;

  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * w;
    const y = h - ((p - min) / range) * h;
    return `${x},${y}`;
  }).join(' ');

  const color = isUp ? '#00ff88' : '#ff3b5c';

  return (
    <svg width={w} height={h} className="inline-block">
      <defs>
        <linearGradient id={`spark-${isUp ? 'up' : 'down'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${h} ${points} ${w},${h}`}
        fill={`url(#spark-${isUp ? 'up' : 'down'})`}
      />
    </svg>
  );
}

/**
 * Table displaying top coins with live price updates, sparklines, and futuristic styling
 * @param coins - Array of coin market data
 * @param livePrices - Real-time prices from CoinCap WebSocket
 */
export function CoinTable({ coins, livePrices }: CoinTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/50 neon-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/50 bg-muted/30">
            <th className="px-4 py-3 text-left font-display text-[10px] font-medium uppercase tracking-wider text-muted-foreground">#</th>
            <th className="px-4 py-3 text-left font-display text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Coin</th>
            <th className="px-4 py-3 text-right font-display text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Price</th>
            <th className="px-4 py-3 text-right font-display text-[10px] font-medium uppercase tracking-wider text-muted-foreground">24h %</th>
            <th className="px-4 py-3 text-center font-display text-[10px] font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">7d Chart</th>
            <th className="px-4 py-3 text-right font-display text-[10px] font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">
              Market Cap
            </th>
            <th className="px-4 py-3 text-right font-display text-[10px] font-medium uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
              Volume (24h)
            </th>
          </tr>
        </thead>
        <tbody>
          {coins.map((coin, index) => {
            const coincapId = mapFromGeckoId(coin.id);
            const livePrice = livePrices[coincapId];
            const displayPrice = livePrice ?? coin.current_price;
            const priceChange = coin.price_change_percentage_24h;
            const isUp = priceChange >= 0;

            return (
              <tr
                key={coin.id}
                className="border-b border-border/30 hover:bg-primary/5 transition-all duration-200 group"
                style={{ animationDelay: `${index * 30}ms` }}
              >
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {coin.market_cap_rank}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/coin/${coin.id}`}
                    className="flex items-center gap-3 group-hover:text-primary transition-colors"
                  >
                    <div className="relative">
                      <Image
                        src={coin.image}
                        alt={coin.name}
                        className="h-7 w-7 rounded-full ring-1 ring-border/50"
                        width={28}
                        height={28}
                        unoptimized
                      />
                      <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success pulse-dot border border-background" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm">{coin.name}</span>
                      <span className="ml-2 text-muted-foreground font-mono uppercase text-[10px] tracking-wider">
                        {coin.symbol}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm font-medium">
                  {formatCurrency(displayPrice)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono text-sm font-medium ${
                    isUp ? 'text-success' : 'text-destructive'
                  }`}
                >
                  <span className={isUp ? 'neon-text-green' : 'neon-text-red'}>
                    {formatPercent(priceChange)}
                  </span>
                </td>
                <td className="px-4 py-3 text-center hidden lg:table-cell">
                  <Sparkline prices={coin.sparkline_in_7d?.price} isUp={isUp} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm hidden md:table-cell text-muted-foreground">
                  {formatCurrency(coin.market_cap, true)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm hidden lg:table-cell text-muted-foreground">
                  {formatCurrency(coin.total_volume, true)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
