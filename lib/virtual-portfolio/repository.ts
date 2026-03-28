import { db } from '@/lib/db';
import { virtualPortfolio, virtualTrades } from '@/lib/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { generateId } from '@/lib/utils';
import type { VirtualPortfolio, VirtualTrade, VirtualHolding } from '@/lib/types/virtual-portfolio';

/** Default starting balance in USD */
const DEFAULT_BALANCE_USD = 1000;

/**
 * Get the virtual portfolio for a user, creating it with $1,000 balance if it does not exist.
 * Uses onConflictDoNothing for race-safe upsert behaviour.
 * @param userId - The user ID to get/create portfolio for
 * @returns The virtual portfolio record
 */
export async function getOrCreatePortfolio(userId: string): Promise<VirtualPortfolio> {
  const now = Date.now();

  await db
    .insert(virtualPortfolio)
    .values({
      id: userId,
      userId,
      balanceUsd: DEFAULT_BALANCE_USD,
      initialBalanceUsd: DEFAULT_BALANCE_USD,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const rows = await db
    .select()
    .from(virtualPortfolio)
    .where(eq(virtualPortfolio.id, userId))
    .limit(1);

  return rows[0] as VirtualPortfolio;
}

/**
 * Update the cash balance of a user's virtual portfolio
 * @param userId - The user ID whose portfolio to update
 * @param newBalance - The new USD balance to set
 * @returns Promise that resolves when the update completes
 */
export async function updatePortfolioBalance(userId: string, newBalance: number): Promise<void> {
  await db
    .update(virtualPortfolio)
    .set({
      balanceUsd: newBalance,
      updatedAt: Date.now(),
    })
    .where(eq(virtualPortfolio.id, userId));
}

/**
 * Insert a new virtual trade record with a generated ID
 * @param userId - The user ID who owns this trade
 * @param trade - Trade data without the id field
 * @returns The complete VirtualTrade including the generated id
 */
export async function insertTrade(userId: string, trade: Omit<VirtualTrade, 'id'>): Promise<VirtualTrade> {
  const id = generateId();
  const fullTrade: VirtualTrade = { id, ...trade };

  await db.insert(virtualTrades).values({
    id: fullTrade.id,
    userId,
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
 * Retrieve virtual trades for a specific user, ordered by execution time (newest first)
 * @param userId - The user ID to get trades for
 * @param limit - Maximum number of trades to return (default 50)
 * @returns Array of VirtualTrade objects
 */
export async function getTrades(userId: string, limit: number = 50): Promise<VirtualTrade[]> {
  const rows = await db
    .select()
    .from(virtualTrades)
    .where(eq(virtualTrades.userId, userId))
    .orderBy(desc(virtualTrades.executedAt))
    .limit(limit);

  return rows as VirtualTrade[];
}

/**
 * Aggregate all trades by coin to compute current holdings for a user.
 * Buys add units, sells subtract units. Only coins with a positive
 * remaining amount are returned. Average buy price is calculated as
 * total USD spent on buys divided by total units bought.
 * @param userId - The user ID to get holdings for
 * @returns Array of VirtualHolding objects for coins with positive positions
 */
export async function getHoldings(userId: string): Promise<VirtualHolding[]> {
  const allTrades = await db
    .select()
    .from(virtualTrades)
    .where(eq(virtualTrades.userId, userId))
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
