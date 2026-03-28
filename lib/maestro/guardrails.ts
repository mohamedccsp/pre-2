import type { PendingRecommendation } from '@/lib/types/recommendation';

/** Top 20 coins by market cap — the only coins agents can recommend */
export const COIN_ALLOWLIST = new Set([
  'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana',
  'ripple', 'usd-coin', 'staked-ether', 'cardano', 'dogecoin',
  'avalanche-2', 'polkadot', 'chainlink', 'matic-network', 'tron',
  'litecoin', 'shiba-inu', 'uniswap', 'stellar', 'cosmos',
]);

/** Max percentage of portfolio balance per trade (20% for Phase 3 HITL) */
const MAX_TRADE_PERCENT = 0.20;

/** Guardrail check result */
export interface GuardrailResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if a recommendation has expired (MAESTRO L3)
 * @param rec - Pending recommendation to check
 * @returns Guardrail result with allowed status
 */
export function checkNotExpired(rec: PendingRecommendation): GuardrailResult {
  if (rec.expiresAt <= Date.now()) {
    return { allowed: false, reason: 'Recommendation has expired' };
  }
  return { allowed: true };
}

/**
 * Validate trade size against portfolio balance (MAESTRO L3)
 * @param amountUsd - Suggested trade amount in USD
 * @param portfolioBalance - Current cash balance
 * @param maxPercent - Maximum allowed percentage (default 20%)
 * @returns Guardrail result with allowed status
 */
export function checkTradeSize(
  amountUsd: number,
  portfolioBalance: number,
  maxPercent: number = MAX_TRADE_PERCENT
): GuardrailResult {
  if (amountUsd <= 0) {
    return { allowed: false, reason: 'Trade amount must be positive' };
  }
  if (amountUsd > portfolioBalance) {
    return { allowed: false, reason: 'Insufficient balance for trade' };
  }
  const maxAmount = portfolioBalance * maxPercent;
  if (amountUsd > maxAmount) {
    return {
      allowed: false,
      reason: `Trade exceeds ${(maxPercent * 100).toFixed(0)}% limit ($${maxAmount.toFixed(2)} max)`,
    };
  }
  return { allowed: true };
}

/**
 * Check if a coin is on the allowlist (MAESTRO L3)
 * @param coinId - CoinGecko coin ID
 * @returns Guardrail result with allowed status
 */
export function checkCoinAllowlist(coinId: string): GuardrailResult {
  if (!COIN_ALLOWLIST.has(coinId)) {
    return { allowed: false, reason: `Coin ${coinId} is not on the allowlist` };
  }
  return { allowed: true };
}

/**
 * Kill switch check — always returns false in Phase 3 HITL flow (MAESTRO L3)
 * Autonomous mode reads from DB via getAutonomousConfig() instead.
 * @returns False (kill switch not active for HITL)
 */
export function isKillSwitchActive(): boolean {
  return false;
}

/** Default guardrail values for autonomous mode (Phase 4) */
export const AUTONOMOUS_DEFAULTS = {
  maxTradePct: 0.10,
  maxTradesPerDay: 5,
  cooldownMinutes: 30,
  dailyLossLimitPct: 0.15,
} as const;

/**
 * Check daily trade count against configured limit (MAESTRO L3)
 * @param tradesToday - Number of trades already executed today
 * @param maxTradesPerDay - Configured daily maximum
 * @returns GuardrailResult — blocked if limit reached
 */
export function checkDailyTradeLimit(
  tradesToday: number,
  maxTradesPerDay: number
): GuardrailResult {
  if (tradesToday >= maxTradesPerDay) {
    return {
      allowed: false,
      reason: `Daily trade limit reached (${tradesToday}/${maxTradesPerDay})`,
    };
  }
  return { allowed: true };
}

/**
 * Check coin-level cooldown — prevents re-trading same coin within window (MAESTRO L3)
 * @param lastTradedAt - Epoch ms of last trade for this coin, or null if never traded
 * @param cooldownMinutes - Required minimum gap in minutes
 * @returns GuardrailResult — blocked if within cooldown window
 */
export function checkCooldown(
  lastTradedAt: number | null,
  cooldownMinutes: number
): GuardrailResult {
  if (lastTradedAt === null) return { allowed: true };
  const elapsedMs = Date.now() - lastTradedAt;
  const cooldownMs = cooldownMinutes * 60 * 1000;
  if (elapsedMs < cooldownMs) {
    const remainingMin = Math.ceil((cooldownMs - elapsedMs) / 60_000);
    return {
      allowed: false,
      reason: `Cooldown active — ${remainingMin} minute(s) remaining`,
    };
  }
  return { allowed: true };
}

/**
 * Check if today's portfolio losses exceed the daily limit (MAESTRO L3)
 * @param dayStartValue - Estimated portfolio total value at UTC midnight
 * @param currentValue - Current portfolio total value (cash + holdings)
 * @param limitPct - Maximum allowed loss fraction (e.g., 0.15 = 15%)
 * @returns GuardrailResult — blocked if loss exceeds limit
 */
export function checkDailyLossLimit(
  dayStartValue: number,
  currentValue: number,
  limitPct: number
): GuardrailResult {
  if (dayStartValue <= 0) return { allowed: true };
  const lossFraction = (dayStartValue - currentValue) / dayStartValue;
  if (lossFraction >= limitPct) {
    return {
      allowed: false,
      reason: `Daily loss limit reached (${(lossFraction * 100).toFixed(1)}% loss, limit ${(limitPct * 100).toFixed(0)}%)`,
    };
  }
  return { allowed: true };
}
