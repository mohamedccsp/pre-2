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
 * Kill switch check — always returns false in Phase 3 (MAESTRO L3)
 * @returns False (kill switch not active)
 */
export function isKillSwitchActive(): boolean {
  return false;
}
