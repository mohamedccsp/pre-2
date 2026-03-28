import { describe, it, expect } from 'vitest';
import {
  checkNotExpired,
  checkTradeSize,
  checkCoinAllowlist,
  isKillSwitchActive,
  checkDailyTradeLimit,
  checkCooldown,
  checkDailyLossLimit,
  COIN_ALLOWLIST,
  AUTONOMOUS_DEFAULTS,
} from '@/lib/maestro/guardrails';
import type { PendingRecommendation } from '@/lib/types/recommendation';

/** Helper to create a minimal pending recommendation */
function makePending(overrides: Partial<PendingRecommendation> = {}): PendingRecommendation {
  return {
    id: 'test-id',
    coinId: 'bitcoin',
    coinSymbol: 'BTC',
    coinName: 'Bitcoin',
    action: 'buy',
    confidence: 75,
    riskLevel: 'medium',
    reasoning: 'test',
    researchSummary: 'test',
    analysisSummary: 'test',
    indicators: {
      rsi14: 55,
      sma20: 50000,
      sma50: 48000,
      priceAtAnalysis: 51000,
      priceChange7d: 3.5,
      priceChange30d: -2.1,
      avgVolume7d: 1000000,
      currentVolume: 1200000,
    },
    suggestedAmountUsd: 100,
    currentPrice: 51000,
    auditId: 'audit-1',
    createdAt: Date.now(),
    expiresAt: Date.now() + 300000,
    status: 'pending',
    ...overrides,
  };
}

describe('checkNotExpired', () => {
  it('should allow a recommendation that has not expired', () => {
    const rec = makePending({ expiresAt: Date.now() + 60000 });
    expect(checkNotExpired(rec).allowed).toBe(true);
  });

  it('should block an expired recommendation', () => {
    const rec = makePending({ expiresAt: Date.now() - 1000 });
    const result = checkNotExpired(rec);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('should block a recommendation expiring exactly now', () => {
    const rec = makePending({ expiresAt: Date.now() });
    expect(checkNotExpired(rec).allowed).toBe(false);
  });
});

describe('checkTradeSize', () => {
  it('should allow a trade within limits', () => {
    expect(checkTradeSize(100, 1000).allowed).toBe(true);
  });

  it('should block a trade exceeding balance', () => {
    const result = checkTradeSize(1100, 1000);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Insufficient balance');
  });

  it('should block a trade exceeding max percentage', () => {
    const result = checkTradeSize(250, 1000, 0.20);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('20%');
  });

  it('should allow trade at exactly the max percentage', () => {
    expect(checkTradeSize(200, 1000, 0.20).allowed).toBe(true);
  });

  it('should block zero or negative amounts', () => {
    expect(checkTradeSize(0, 1000).allowed).toBe(false);
    expect(checkTradeSize(-50, 1000).allowed).toBe(false);
  });
});

describe('checkCoinAllowlist', () => {
  it('should allow coins on the list', () => {
    expect(checkCoinAllowlist('bitcoin').allowed).toBe(true);
    expect(checkCoinAllowlist('ethereum').allowed).toBe(true);
    expect(checkCoinAllowlist('solana').allowed).toBe(true);
  });

  it('should block coins not on the list', () => {
    const result = checkCoinAllowlist('some-random-coin');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not on the allowlist');
  });

  it('should have at least 20 coins in the allowlist', () => {
    expect(COIN_ALLOWLIST.size).toBeGreaterThanOrEqual(20);
  });
});

describe('isKillSwitchActive', () => {
  it('should always return false for HITL flow', () => {
    expect(isKillSwitchActive()).toBe(false);
  });
});

describe('AUTONOMOUS_DEFAULTS', () => {
  it('should have the correct default values', () => {
    expect(AUTONOMOUS_DEFAULTS.maxTradePct).toBe(0.10);
    expect(AUTONOMOUS_DEFAULTS.maxTradesPerDay).toBe(5);
    expect(AUTONOMOUS_DEFAULTS.cooldownMinutes).toBe(30);
    expect(AUTONOMOUS_DEFAULTS.dailyLossLimitPct).toBe(0.15);
  });
});

describe('checkDailyTradeLimit', () => {
  it('should allow when under limit', () => {
    expect(checkDailyTradeLimit(3, 5).allowed).toBe(true);
  });

  it('should allow at one below limit', () => {
    expect(checkDailyTradeLimit(4, 5).allowed).toBe(true);
  });

  it('should block when at limit', () => {
    const result = checkDailyTradeLimit(5, 5);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('5/5');
  });

  it('should block when over limit', () => {
    expect(checkDailyTradeLimit(10, 5).allowed).toBe(false);
  });

  it('should allow 0 trades against any positive limit', () => {
    expect(checkDailyTradeLimit(0, 1).allowed).toBe(true);
  });
});

describe('checkCooldown', () => {
  it('should allow when no previous trade', () => {
    expect(checkCooldown(null, 30).allowed).toBe(true);
  });

  it('should allow when cooldown has elapsed', () => {
    const thirtyOneMinutesAgo = Date.now() - 31 * 60 * 1000;
    expect(checkCooldown(thirtyOneMinutesAgo, 30).allowed).toBe(true);
  });

  it('should block when within cooldown', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const result = checkCooldown(fiveMinutesAgo, 30);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cooldown');
    expect(result.reason).toContain('minute');
  });

  it('should allow with 0 minute cooldown', () => {
    const justNow = Date.now() - 1000;
    expect(checkCooldown(justNow, 0).allowed).toBe(true);
  });

  it('should block exact cooldown boundary', () => {
    const exactlyThirtyMinAgo = Date.now() - 30 * 60 * 1000 + 100;
    expect(checkCooldown(exactlyThirtyMinAgo, 30).allowed).toBe(false);
  });
});

describe('checkDailyLossLimit', () => {
  it('should allow when no losses', () => {
    expect(checkDailyLossLimit(1000, 1050, 0.15).allowed).toBe(true);
  });

  it('should allow small losses under limit', () => {
    expect(checkDailyLossLimit(1000, 900, 0.15).allowed).toBe(true);
  });

  it('should block when loss exceeds limit', () => {
    const result = checkDailyLossLimit(1000, 840, 0.15);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('loss limit');
  });

  it('should block at exactly 15% loss', () => {
    expect(checkDailyLossLimit(1000, 850, 0.15).allowed).toBe(false);
  });

  it('should allow when dayStartValue is zero', () => {
    expect(checkDailyLossLimit(0, 100, 0.15).allowed).toBe(true);
  });

  it('should allow when portfolio gained value', () => {
    expect(checkDailyLossLimit(1000, 1200, 0.15).allowed).toBe(true);
  });
});
