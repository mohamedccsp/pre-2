'use client';

import { useEffect, useState } from 'react';
import { usePortfolioStore } from '@/stores/portfolio-store';
import { useMarketStore } from '@/stores/market-store';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Plus, Trash2 } from 'lucide-react';
import type { AddPortfolioInput } from '@/lib/types/portfolio';
import type { CoinMarket } from '@/lib/types/market';

/**
 * Portfolio page — manage and track coin holdings
 */
export default function PortfolioPage() {
  const { items, isLoading, error, fetchPortfolio, addItem, removeItem } = usePortfolioStore();
  const { coins } = useMarketStore();
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchPortfolio();
  }, [fetchPortfolio]);

  /** Calculate total portfolio value using current market prices */
  const totalValue = items.reduce((sum, item) => {
    const coin = coins.find((c) => c.id === item.coinId);
    const price = coin?.current_price ?? item.buyPrice;
    return sum + item.amount * price;
  }, 0);

  const totalCost = items.reduce((sum, item) => sum + item.amount * item.buyPrice, 0);
  const pnl = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (pnl / totalCost) * 100 : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Portfolio</h1>
          <p className="text-muted-foreground mt-1">Track your holdings and performance</p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Coin
        </button>
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Value</div>
          <div className="text-lg font-bold font-mono">{formatCurrency(totalValue)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Cost</div>
          <div className="text-lg font-bold font-mono">{formatCurrency(totalCost)}</div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">P&L</div>
          <div className={`text-lg font-bold font-mono ${pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatCurrency(pnl)}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground mb-1">P&L %</div>
          <div className={`text-lg font-bold font-mono ${pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
            {formatPercent(pnlPercent)}
          </div>
        </div>
      </div>

      {showAddForm && (
        <AddCoinForm
          coins={coins}
          onAdd={async (input) => {
            await addItem(input);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading portfolio...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No coins in your portfolio yet. Click &quot;Add Coin&quot; to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Coin</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Buy Price</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Current</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">P&L</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const coin = coins.find((c) => c.id === item.coinId);
                const currentPrice = coin?.current_price ?? item.buyPrice;
                const itemPnl = (currentPrice - item.buyPrice) * item.amount;
                const itemPnlPercent = ((currentPrice - item.buyPrice) / item.buyPrice) * 100;

                return (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground uppercase">{item.symbol}</div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{item.amount}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(item.buyPrice)}</td>
                    <td className="px-4 py-3 text-right font-mono">{formatCurrency(currentPrice)}</td>
                    <td className={`px-4 py-3 text-right font-mono ${itemPnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                      {formatCurrency(itemPnl)} ({formatPercent(itemPnlPercent)})
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeItem(item.id)}
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label={`Remove ${item.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Form for adding a new coin to the portfolio
 * @param coins - Available coins from market data
 * @param onAdd - Callback when form is submitted
 * @param onCancel - Callback to close the form
 */
function AddCoinForm({
  coins,
  onAdd,
  onCancel,
}: {
  coins: CoinMarket[];
  onAdd: (input: AddPortfolioInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [coinId, setCoinId] = useState('');
  const [amount, setAmount] = useState('');
  const [buyPrice, setBuyPrice] = useState('');

  const selectedCoin = coins.find((c) => c.id === coinId);

  /**
   * Handle form submission
   */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCoin || !amount || !buyPrice) return;

    await onAdd({
      coinId: selectedCoin.id,
      symbol: selectedCoin.symbol,
      name: selectedCoin.name,
      amount: parseFloat(amount),
      buyPrice: parseFloat(buyPrice),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mb-6 rounded-lg border border-border bg-card p-4">
      <h3 className="font-medium mb-4">Add Coin to Portfolio</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Coin</label>
          <select
            value={coinId}
            onChange={(e) => {
              setCoinId(e.target.value);
              const coin = coins.find((c) => c.id === e.target.value);
              if (coin) setBuyPrice(coin.current_price.toString());
            }}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            required
          >
            <option value="">Select a coin</option>
            {coins.map((coin) => (
              <option key={coin.id} value={coin.id}>
                {coin.name} ({coin.symbol.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Amount</label>
          <input
            type="number"
            step="any"
            min="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="0.5"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-muted-foreground mb-1">Buy Price (USD)</label>
          <input
            type="number"
            step="any"
            min="0"
            value={buyPrice}
            onChange={(e) => setBuyPrice(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="50000"
            required
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Add
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
