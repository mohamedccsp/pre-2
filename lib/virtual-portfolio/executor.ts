import { approvePending, markExecuted } from '@/lib/recommendations/lifecycle';
import { updateRecommendationStatus } from '@/lib/recommendations/repository';
import { getOrCreatePortfolio, updatePortfolioBalance, insertTrade } from '@/lib/virtual-portfolio/repository';
import { getSimplePrice } from '@/lib/api/coingecko';
import { logAuditEntry, hashForAudit } from '@/lib/maestro/audit-logger';
import type { PendingRecommendation, ExecutedRecommendation } from '@/lib/types/recommendation';
import type { VirtualTrade } from '@/lib/types/virtual-portfolio';

/** Input for the shared trade executor */
export interface ExecuteTradeInput {
  /** The user ID executing the trade */
  userId: string;
  /** The pending recommendation to execute */
  pending: PendingRecommendation;
  /** Max trade size as fraction of balance (HITL uses 0.20, autonomous uses config value) */
  maxTradePct: number;
}

/** Result of a successful trade execution */
export interface ExecuteTradeResult {
  recommendation: ExecutedRecommendation;
  trade: VirtualTrade;
}

/**
 * Execute a single approved trade against the virtual portfolio.
 * Fetches live price, inserts trade record, updates cash balance,
 * transitions recommendation to executed, and emits L5 audit entry.
 * Callers are responsible for running guardrail checks before calling this.
 * @param input - Pending recommendation and trade size cap
 * @returns ExecuteTradeResult with executed recommendation and trade record
 * @throws Error if price fetch fails or portfolio state is invalid
 */
export async function executeTrade(input: ExecuteTradeInput): Promise<ExecuteTradeResult> {
  const { userId, pending, maxTradePct } = input;

  // Approve the recommendation (state transition: pending → approved)
  const approved = approvePending(pending);

  // Fetch live execution price — fall back to recommendation price if API fails
  let executionPrice = pending.currentPrice;
  try {
    const priceData = await getSimplePrice(pending.coinId);
    executionPrice = priceData[pending.coinId]?.usd ?? pending.currentPrice;
  } catch {
    // CoinGecko rate-limited or unavailable — use the price from the recommendation
  }

  // Clamp trade amount to maxTradePct of current balance
  const portfolio = await getOrCreatePortfolio(userId);
  const maxAmount = portfolio.balanceUsd * maxTradePct;
  const amountUsd = Math.min(pending.suggestedAmountUsd, maxAmount);
  const unitsTraded = amountUsd / executionPrice;

  const isBuy = pending.action === 'buy';
  const balanceBefore = portfolio.balanceUsd;
  const balanceAfter = isBuy
    ? balanceBefore - amountUsd
    : balanceBefore + amountUsd;

  const tradeAction = isBuy ? 'buy' as const : 'sell' as const;

  // Insert trade record
  const trade = await insertTrade(userId, {
    recommendationId: pending.id,
    coinId: pending.coinId,
    coinSymbol: pending.coinSymbol,
    action: tradeAction,
    amountUsd,
    priceAtExecution: executionPrice,
    unitsTraded,
    balanceBefore,
    balanceAfter,
    executedAt: Date.now(),
    auditId: approved.auditId,
  });

  // Update portfolio balance
  await updatePortfolioBalance(userId, balanceAfter);

  // Transition: approved → executed
  const executed = markExecuted(approved, trade.id);
  await updateRecommendationStatus(executed);

  // L5: Audit log
  await logAuditEntry({
    agentName: 'executor',
    action: 'trade_executed',
    inputHash: hashForAudit(pending.id),
    outputHash: hashForAudit(trade.id),
    durationMs: 0,
    success: true,
  });

  return { recommendation: executed, trade };
}
