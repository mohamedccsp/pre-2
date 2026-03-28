import { describe, it, expect } from 'vitest';
import {
  checkNotExpired,
  checkTradeSize,
  checkCoinAllowlist,
  isKillSwitchActive,
  COIN_ALLOWLIST,
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
  it('should always return false in Phase 3', () => {
    expect(isKillSwitchActive()).toBe(false);
  });
});
