import { db } from '@/lib/db';
import { virtualPortfolio, virtualTrades } from '@/lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { generateId } from '@/lib/utils';
import type { VirtualPortfolio, VirtualTrade, VirtualHolding } from '@/lib/types/virtual-portfolio';

/** The fixed ID used for the single default portfolio row */
const DEFAULT_PORTFOLIO_ID = 'default';

/** Default starting balance in USD */
const DEFAULT_BALANCE_USD = 1000;

/**
 * Get the default virtual portfolio, creating it with $1,000 balance if it does not exist.
 * Uses onConflictDoNothing for race-safe upsert behaviour.
 * @returns The virtual portfolio record
 */
export async function getOrCreatePortfolio(): Promise<VirtualPortfolio> {
  const now = Date.now();

  await db
    .insert(virtualPortfolio)
    .values({
      id: DEFAULT_PORTFOLIO_ID,
      balanceUsd: DEFAULT_BALANCE_USD,
      initialBalanceUsd: DEFAULT_BALANCE_USD,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const rows = await db
    .select()
    .from(virtualPortfolio)
    .where(eq(virtualPortfolio.id, DEFAULT_PORTFOLIO_ID))
    .limit(1);

  return rows[0] as VirtualPortfolio;
}

/**
 * Update the cash balance of the default virtual portfolio
 * @param newBalance - The new USD balance to set
 * @returns Promise that resolves when the update completes
 */
export async function updatePortfolioBalance(newBalance: number): Promise<void> {
  await db
    .update(virtualPortfolio)
    .set({
      balanceUsd: newBalance,
      updatedAt: Date.now(),
    })
    .where(eq(virtualPortfolio.id, DEFAULT_PORTFOLIO_ID));
}

/**
 * Insert a new virtual trade record with a generated ID
 * @param trade - Trade data without the id field
 * @returns The complete VirtualTrade including the generated id
 */
export async function insertTrade(trade: Omit<VirtualTrade, 'id'>): Promise<VirtualTrade> {
  const id = generateId();
  const fullTrade: VirtualTrade = { id, ...trade };

  await db.insert(virtualTrades).values({
    id: fullTrade.id,
    recommendationId: fullTrade.recommendationId,
    coinId: fullTrade.coinId,
    coinSymbol: fullTrade.coinSymbol,
    action: fullTrade.action,
    amountUsd: fullTrade.amountUsd,
    priceAtExecution: fullTrade.priceAtExecution,
    unitsTraded: fullTrade.unitsTraded,
    balanceBefore: fullTrade.balanceBefore,
    balanceAfter: fullTrade.balanceAfter,
    executedAt: fullTrade.executedAt,
    auditId: fullTrade.auditId,
  });

  return fullTrade;
}

/**
 * Retrieve virtual trades ordered by execution time (newest first)
 * @param limit - Maximum number of trades to return (default 50)
 * @returns Array of VirtualTrade objects
 */
export async function getTrades(limit: number = 50): Promise<VirtualTrade[]> {
  const rows = await db
    .select()
    .from(virtualTrades)
    .orderBy(desc(virtualTrades.executedAt))
    .limit(limit);

  return rows as VirtualTrade[];
}

/**
 * Aggregate all trades by coin to compute current holdings.
 * Buys add units, sells subtract units. Only coins with a positive
 * remaining amount are returned. Average buy price is calculated as
 * total USD spent on buys divided by total units bought.
 * @returns Array of VirtualHolding objects for coins with positive positions
 */
export async function getHoldings(): Promise<VirtualHolding[]> {
  const allTrades = await db
    .select()
    .from(virtualTrades)
    .orderBy(virtualTrades.executedAt);

  /** Accumulator keyed by coinId */
  const acc = new Map<
    string,
    {
      coinSymbol: string;
      totalBuyUsd: number;
      totalBuyUnits: number;
      netUnits: number;
    }
  >();

  for (const t of allTrades) {
    let entry = acc.get(t.coinId);
    if (!entry) {
      entry = {
        coinSymbol: t.coinSymbol,
        totalBuyUsd: 0,
        totalBuyUnits: 0,
        netUnits: 0,
      };
      acc.set(t.coinId, entry);
    }

    if (t.action === 'buy') {
      entry.totalBuyUsd += t.amountUsd;
      entry.totalBuyUnits += t.unitsTraded;
      entry.netUnits += t.unitsTraded;
    } else {
      entry.netUnits -= t.unitsTraded;
    }
  }

  const holdings: VirtualHolding[] = [];

  for (const [coinId, entry] of Array.from(acc.entries())) {
    if (entry.netUnits > 0) {
      const averageBuyPrice =
        entry.totalBuyUnits > 0 ? entry.totalBuyUsd / entry.totalBuyUnits : 0;

      holdings.push({
        coinId,
        coinSymbol: entry.coinSymbol,
        amount: entry.netUnits,
        averageBuyPrice,
      });
    }
  }

  return holdings;
}
