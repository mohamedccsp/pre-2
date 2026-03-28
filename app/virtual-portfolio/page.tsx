'use client';

import { useEffect } from 'react';
import { useVirtualPortfolioStore } from '@/stores/virtual-portfolio-store';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import { Wallet, TrendingUp, TrendingDown, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';

/**
 * Virtual portfolio page — simulated trading portfolio with P&L tracking
 */
export default function VirtualPortfolioPage() {
  const {
    portfolio, holdings, trades, totalValue, totalPnl, totalPnlPercent,
    isLoading, error, fetchPortfolio, clearError,
  } = useVirtualPortfolioStore();

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  if (isLoading && !portfolio) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isProfitable = totalPnl >= 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6 text-primary" />
          Virtual Portfolio
        </h1>
        <p className="text-muted-foreground mt-1">
          Simulated trading with $1,000 starting balance — no real money
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={clearError} className="text-xs underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Summary cards */}
      {portfolio && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Total Value</div>
            <div className="text-xl font-bold font-mono">{formatCurrency(totalValue)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Cash Balance</div>
            <div className="text-xl font-bold font-mono">{formatCurrency(portfolio.balanceUsd)}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Total P&L</div>
            <div className={cn('text-xl font-bold font-mono', isProfitable ? 'text-success' : 'text-destructive')}>
              {isProfitable ? '+' : ''}{formatCurrency(totalPnl)}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="text-xs text-muted-foreground uppercase mb-1">Return</div>
            <div className={cn('text-xl font-bold font-mono flex items-center gap-1', isProfitable ? 'text-success' : 'text-destructive')}>
              {isProfitable ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {formatPercent(totalPnlPercent)}
            </div>
          </div>
        </div>
      )}

      {/* Holdings */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Holdings</h2>
        {holdings.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-3">Coin</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Avg Price</th>
                  <th className="px-4 py-3 text-right">Current Price</th>
                  <th className="px-4 py-3 text-right">Value</th>
                  <th className="px-4 py-3 text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((h) => {
                  const pnl = h.unrealizedPnl ?? 0;
                  const isUp = pnl >= 0;
                  return (
                    <tr key={h.coinId} className="border-t border-border hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">
                        {h.coinSymbol.toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{h.amount.toFixed(6)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(h.averageBuyPrice)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(h.currentPrice ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-mono">{formatCurrency(h.currentValue ?? 0)}</td>
                      <td className={cn('px-4 py-3 text-right font-mono', isUp ? 'text-success' : 'text-destructive')}>
                        {isUp ? '+' : ''}{formatCurrency(pnl)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No holdings yet — approve a trade recommendation to start
          </div>
        )}
      </div>

      {/* Trade history */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">Trade History</h2>
        {trades.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Coin</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Units</th>
                  <th className="px-4 py-3 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr key={t.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(t.executedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-medium">{t.coinSymbol.toUpperCase()}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-xs font-medium',
                        t.action === 'buy' ? 'text-emerald-500' : 'text-red-500'
                      )}>
                        {t.action === 'buy' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {t.action.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(t.amountUsd)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(t.priceAtExecution)}</td>
                    <td className="px-4 py-3 text-right font-mono">{t.unitsTraded.toFixed(6)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(t.balanceAfter)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No trades yet
          </div>
        )}
      </div>
    </div>
  );
}
