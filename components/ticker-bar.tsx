'use client';

import { useMarketStore } from '@/stores/market-store';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { mapFromGeckoId } from '@/lib/api/coincap';

/**
 * Running stock-market style red ticker bar with live coin data
 * Scrolls infinitely with coin name, price, and 24h change
 */
export function TickerBar() {
  const { coins, livePrices } = useMarketStore();

  if (coins.length === 0) return null;

  const tickerCoins = coins.slice(0, 20);

  return (
    <div className="w-full overflow-hidden bg-gradient-to-r from-red-700 via-red-600 to-red-700 dark:from-red-900/90 dark:via-red-800/90 dark:to-red-900/90 border-y border-red-500/30">
      <div className="ticker-animate flex whitespace-nowrap py-1.5">
        {[0, 1].map((pass) => (
          <div key={pass} className="flex shrink-0">
            {tickerCoins.map((coin) => {
              const coincapId = mapFromGeckoId(coin.id);
              const livePrice = livePrices[coincapId];
              const displayPrice = livePrice ?? coin.current_price;
              const change = coin.price_change_percentage_24h;
              const isUp = change >= 0;

              return (
                <div
                  key={`${pass}-${coin.id}`}
                  className="flex items-center gap-2 px-5 text-xs font-mono"
                >
                  <span className="font-display font-bold text-white/95 tracking-wider">
                    {coin.symbol.toUpperCase()}
                  </span>
                  <span className="text-white/80">
                    {formatCurrency(displayPrice)}
                  </span>
                  <span className={isUp ? 'text-green-300 font-medium' : 'text-white/60 font-medium'}>
                    {formatPercent(change)}
                  </span>
                  <span className="text-red-300/30 mx-1">|</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
