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
 * Table displaying top coins with live price updates
 * @param coins - Array of coin market data
 * @param livePrices - Real-time prices from CoinCap WebSocket
 */
export function CoinTable({ coins, livePrices }: CoinTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Coin</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground">24h %</th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden md:table-cell">
              Market Cap
            </th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground hidden lg:table-cell">
              Volume (24h)
            </th>
          </tr>
        </thead>
        <tbody>
          {coins.map((coin) => {
            const coincapId = mapFromGeckoId(coin.id);
            const livePrice = livePrices[coincapId];
            const displayPrice = livePrice ?? coin.current_price;
            const priceChange = coin.price_change_percentage_24h;

            return (
              <tr
                key={coin.id}
                className="border-b border-border hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-3 text-muted-foreground">
                  {coin.market_cap_rank}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/coin/${coin.id}`}
                    className="flex items-center gap-3 hover:text-primary transition-colors"
                  >
                    <Image
                      src={coin.image}
                      alt={coin.name}
                      className="h-6 w-6 rounded-full"
                      width={24}
                      height={24}
                      unoptimized
                    />
                    <div>
                      <span className="font-medium">{coin.name}</span>
                      <span className="ml-2 text-muted-foreground uppercase text-xs">
                        {coin.symbol}
                      </span>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {formatCurrency(displayPrice)}
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono ${
                    priceChange >= 0 ? 'text-success' : 'text-destructive'
                  }`}
                >
                  {formatPercent(priceChange)}
                </td>
                <td className="px-4 py-3 text-right font-mono hidden md:table-cell">
                  {formatCurrency(coin.market_cap, true)}
                </td>
                <td className="px-4 py-3 text-right font-mono hidden lg:table-cell">
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
