import { db } from '@/lib/db';
import { autonomousCycles, virtualTrades } from '@/lib/db/schema';
import { desc, gte, and, eq } from 'drizzle-orm';
import { generateId } from '@/lib/utils';
import { COIN_ALLOWLIST, checkDailyTradeLimit, checkCooldown, checkDailyLossLimit, checkNotExpired, checkCoinAllowlist, checkTradeSize } from '@/lib/maestro/guardrails';
import { logAuditEntry, hashForAudit } from '@/lib/maestro/audit-logger';
import { getAutonomousConfig } from './config-repository';
import { executeAnalysisChain } from '@/lib/agents/chain';
import { executeTrade } from '@/lib/virtual-portfolio/executor';
import { insertRecommendation } from '@/lib/recommendations/repository';
import { getOrCreatePortfolio, getHoldings } from '@/lib/virtual-portfolio/repository';
import { getSimplePrice } from '@/lib/api/coingecko';
import type { ChainOutput } from '@/lib/agents/chain';
import type { ExecuteTradeResult } from '@/lib/virtual-portfolio/executor';

/** Per-coin outcome within a cycle run */
export interface CycleItemResult {
  coinId: string;
  action: 'executed' | 'skipped' | 'failed';
  skipReason?: string;
  recommendationId?: string;
  tradeId?: string;
  amountUsd?: number;
  error?: string;
}

/** Full result of one autonomous cycle */
export interface CycleResult {
  cycleId: string;
  startedAt: number;
  completedAt: number;
  coinsAnalyzed: number;
  tradesExecuted: number;
  tradesSkipped: number;
  totalAmountUsd: number;
  killSwitchTripped: boolean;
  dailyLossTripped: boolean;
  items: CycleItemResult[];
}

/**
 * Get UTC midnight epoch for the current day
 * @returns Epoch milliseconds at 00:00:00 UTC today
 */
function getUtcMidnight(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * Compute portfolio total value (cash + holdings at current market prices)
 * @param cashBalance - Current USD cash balance
 * @param holdings - Current holdings array
 * @returns Total portfolio value in USD
 */
async function computePortfolioValue(cashBalance: number, holdings: Array<{ coinId: string; amount: number }>): Promise<number> {
  if (holdings.length === 0) return cashBalance;

  const coinIds = holdings.map((h) => h.coinId).join(',');
  const priceData = await getSimplePrice(coinIds);

  const holdingsValue = holdings.reduce((sum, h) => {
    const price = priceData[h.coinId]?.usd ?? 0;
    return sum + h.amount * price;
  }, 0);

  return cashBalance + holdingsValue;
}

/**
 * Run one full autonomous cycle over all allowlisted coins sequentially.
 * Sequential processing is required — concurrent chains would exceed the
 * CoinGecko 30 req/min free-tier limit (each chain makes 4 API calls).
 * Stops early if kill switch is active or daily loss limit is breached.
 * Each coin failure is isolated — one bad coin does not abort the cycle.
 * @param opts - Optional injected dependencies for unit testing
 * @returns CycleResult with full per-coin outcome summary
 */
export async function runAutonomousCycle(userId: string, opts?: {
  chainFn?: (input: { coinId: string; userId: string }) => Promise<ChainOutput>;
  executorFn?: (input: { userId: string; pending: ChainOutput['recommendation']; maxTradePct: number }) => Promise<ExecuteTradeResult>;
}): Promise<CycleResult> {
  const chainFn = opts?.chainFn ?? executeAnalysisChain;
  const executorFn = opts?.executorFn ?? executeTrade;

  const cycleId = generateId();
  const startedAt = Date.now();
  const items: CycleItemResult[] = [];
  let tradesExecuted = 0;
  let tradesSkipped = 0;
  let totalAmountUsd = 0;
  let killSwitchTripped = false;
  let dailyLossTripped = false;

  // Load config
  const config = await getAutonomousConfig(userId);

  // Check kill switch
  if (config.killSwitchActive) {
    killSwitchTripped = true;
    const result: CycleResult = {
      cycleId,
      startedAt,
      completedAt: Date.now(),
      coinsAnalyzed: 0,
      tradesExecuted: 0,
      tradesSkipped: 0,
      totalAmountUsd: 0,
      killSwitchTripped: true,
      dailyLossTripped: false,
      items: [],
    };
    await persistCycle(userId, result);
    return result;
  }

  // Count today's trades and build cooldown map
  const utcMidnight = getUtcMidnight();
  const todaysTrades = await db
    .select()
    .from(virtualTrades)
    .where(and(eq(virtualTrades.userId, userId), gte(virtualTrades.executedAt, utcMidnight)));

  let tradesToday = todaysTrades.length;

  const lastTradeTimes = new Map<string, number>();
  for (const t of todaysTrades) {
    const existing = lastTradeTimes.get(t.coinId) ?? 0;
    if (t.executedAt > existing) {
      lastTradeTimes.set(t.coinId, t.executedAt);
    }
  }

  // Cache portfolio and holdings once — avoid repeated DB/API calls in the loop
  const portfolio = await getOrCreatePortfolio(userId);
  const holdings = await getHoldings(userId);
  let cachedBalance = portfolio.balanceUsd;

  // Compute day-start portfolio value from today's trade deltas
  const currentValue = await computePortfolioValue(cachedBalance, holdings);
  const netCashChange = todaysTrades.reduce(
    (sum, t) => sum + (t.balanceAfter - t.balanceBefore),
    0
  );
  const dayStartCash = cachedBalance - netCashChange;
  const dayStartValue = dayStartCash + (currentValue - cachedBalance);

  // Log cycle start
  await logAuditEntry({
    agentName: 'autonomous',
    action: 'cycle_started',
    inputHash: hashForAudit(cycleId),
    outputHash: '',
    durationMs: 0,
    success: true,
  });

  // Process each coin sequentially
  const coins = Array.from(COIN_ALLOWLIST);
  for (const coinId of coins) {
    // Check daily trade limit
    const tradeLimitCheck = checkDailyTradeLimit(tradesToday, config.maxTradesPerDay);
    if (!tradeLimitCheck.allowed) {
      // Skip all remaining coins
      for (const remaining of coins.slice(coins.indexOf(coinId))) {
        if (remaining === coinId || items.some((i) => i.coinId === remaining)) continue;
        items.push({ coinId: remaining, action: 'skipped', skipReason: tradeLimitCheck.reason });
        tradesSkipped++;
      }
      items.push({ coinId, action: 'skipped', skipReason: tradeLimitCheck.reason });
      tradesSkipped++;
      break;
    }

    // Check daily loss limit — use cached balance + holdings to avoid redundant API calls
    const currentPortfolioValue = await computePortfolioValue(cachedBalance, holdings);
    const lossCheck = checkDailyLossLimit(dayStartValue, currentPortfolioValue, config.dailyLossLimitPct);
    if (!lossCheck.allowed) {
      dailyLossTripped = true;
      items.push({ coinId, action: 'skipped', skipReason: lossCheck.reason });
      tradesSkipped++;
      break;
    }

    try {
      // Run the analysis chain
      const { recommendation } = await chainFn({ coinId, userId });
      await insertRecommendation(userId, recommendation);

      // Skip hold recommendations
      if (recommendation.action === 'hold') {
        items.push({
          coinId,
          action: 'skipped',
          skipReason: 'hold',
          recommendationId: recommendation.id,
        });
        tradesSkipped++;
        continue;
      }

      // Run guardrail checks
      const expiryCheck = checkNotExpired(recommendation);
      if (!expiryCheck.allowed) {
        items.push({ coinId, action: 'skipped', skipReason: expiryCheck.reason, recommendationId: recommendation.id });
        tradesSkipped++;
        continue;
      }

      const allowlistCheck = checkCoinAllowlist(recommendation.coinId);
      if (!allowlistCheck.allowed) {
        items.push({ coinId, action: 'skipped', skipReason: allowlistCheck.reason, recommendationId: recommendation.id });
        tradesSkipped++;
        continue;
      }

      const cooldownCheck = checkCooldown(lastTradeTimes.get(coinId) ?? null, config.cooldownMinutes);
      if (!cooldownCheck.allowed) {
        items.push({ coinId, action: 'skipped', skipReason: cooldownCheck.reason, recommendationId: recommendation.id });
        tradesSkipped++;
        continue;
      }

      // Only check trade size for buy orders (sells return cash)
      if (recommendation.action === 'buy') {
        const sizeCheck = checkTradeSize(recommendation.suggestedAmountUsd, cachedBalance, config.maxTradePct);
        if (!sizeCheck.allowed) {
          items.push({ coinId, action: 'skipped', skipReason: sizeCheck.reason, recommendationId: recommendation.id });
          tradesSkipped++;
          continue;
        }
      }

      // Execute trade
      const result = await executorFn({ userId, pending: recommendation, maxTradePct: config.maxTradePct });

      // Update cached balance so subsequent iterations use fresh data without re-fetching
      cachedBalance = result.trade.balanceAfter;

      lastTradeTimes.set(coinId, Date.now());
      tradesToday++;
      tradesExecuted++;
      totalAmountUsd += result.trade.amountUsd;

      items.push({
        coinId,
        action: 'executed',
        recommendationId: recommendation.id,
        tradeId: result.trade.id,
        amountUsd: result.trade.amountUsd,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      items.push({ coinId, action: 'failed', error: message });
      tradesSkipped++;
    }
  }

  const completedAt = Date.now();
  const cycleResult: CycleResult = {
    cycleId,
    startedAt,
    completedAt,
    coinsAnalyzed: items.length,
    tradesExecuted,
    tradesSkipped,
    totalAmountUsd,
    killSwitchTripped,
    dailyLossTripped,
    items,
  };

  await persistCycle(userId, cycleResult);

  await logAuditEntry({
    agentName: 'autonomous',
    action: 'cycle_complete',
    inputHash: hashForAudit(cycleId),
    outputHash: hashForAudit(JSON.stringify({ tradesExecuted, totalAmountUsd })),
    durationMs: completedAt - startedAt,
    success: true,
  });

  return cycleResult;
}

/**
 * Persist a cycle result to the database
 * @param userId - The user ID who ran this cycle
 * @param result - Cycle result to store
 */
async function persistCycle(userId: string, result: CycleResult): Promise<void> {
  await db.insert(autonomousCycles).values({
    id: result.cycleId,
    userId,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    coinsAnalyzed: result.coinsAnalyzed,
    tradesExecuted: result.tradesExecuted,
    tradesSkipped: result.tradesSkipped,
    totalAmountUsd: result.totalAmountUsd,
    killSwitchTripped: result.killSwitchTripped,
    dailyLossTripped: result.dailyLossTripped,
    summaryJson: JSON.stringify(result.items),
    error: null,
  });
}

/**
 * Fetch the most recent completed cycle for a user
 * @param userId - The user ID to get the last cycle for
 * @returns Most recent CycleResult or null if no cycles have run
 */
export async function getLastCycle(userId: string): Promise<CycleResult | null> {
  const rows = await db
    .select()
    .from(autonomousCycles)
    .where(eq(autonomousCycles.userId, userId))
    .orderBy(desc(autonomousCycles.startedAt))
    .limit(1);

  if (rows.length === 0) return null;
  return rowToCycleResult(rows[0]);
}

/**
 * Fetch recent cycle history for a user
 * @param userId - The user ID to get cycle history for
 * @param limit - Maximum number of cycles to return (default 5)
 * @returns Array of CycleResult objects, newest first
 */
export async function getCycleHistory(userId: string, limit: number = 5): Promise<CycleResult[]> {
  const rows = await db
    .select()
    .from(autonomousCycles)
    .where(eq(autonomousCycles.userId, userId))
    .orderBy(desc(autonomousCycles.startedAt))
    .limit(limit);

  return rows.map(rowToCycleResult);
}

/**
 * Map a database row to a CycleResult
 * @param row - Raw row from the autonomous_cycles table
 * @returns Typed CycleResult
 */
function rowToCycleResult(row: typeof autonomousCycles.$inferSelect): CycleResult {
  return {
    cycleId: row.id,
    startedAt: row.startedAt,
    completedAt: row.completedAt ?? row.startedAt,
    coinsAnalyzed: row.coinsAnalyzed,
    tradesExecuted: row.tradesExecuted,
    tradesSkipped: row.tradesSkipped,
    totalAmountUsd: row.totalAmountUsd,
    killSwitchTripped: row.killSwitchTripped,
    dailyLossTripped: row.dailyLossTripped,
    items: JSON.parse(row.summaryJson) as CycleItemResult[],
  };
}
