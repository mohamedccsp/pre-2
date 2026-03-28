import { describe, it, expect } from 'vitest';
import {
  isExpired,
  approvePending,
  rejectPending,
  expirePending,
  markExecuted,
} from '@/lib/recommendations/lifecycle';
import type { PendingRecommendation, ApprovedRecommendation } from '@/lib/types/recommendation';

/** Helper to create a minimal pending recommendation */
function makePending(overrides: Partial<PendingRecommendation> = {}): PendingRecommendation {
  return {
    id: 'rec-1',
    coinId: 'bitcoin',
    coinSymbol: 'BTC',
    coinName: 'Bitcoin',
    action: 'buy',
    confidence: 75,
    riskLevel: 'medium',
    reasoning: 'test reasoning',
    researchSummary: 'research',
    analysisSummary: 'analysis',
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

describe('isExpired', () => {
  it('should return true when expiresAt is in the past', () => {
    expect(isExpired(makePending({ expiresAt: Date.now() - 1 }))).toBe(true);
  });

  it('should return false when expiresAt is in the future', () => {
    expect(isExpired(makePending({ expiresAt: Date.now() + 60000 }))).toBe(false);
  });
});

describe('approvePending', () => {
  it('should transition to approved with timestamp', () => {
    const pending = makePending();
    const approved = approvePending(pending);
    expect(approved.status).toBe('approved');
    expect(approved.approvedAt).toBeGreaterThan(0);
    expect(approved.id).toBe(pending.id);
    expect(approved.coinId).toBe(pending.coinId);
  });
});

describe('rejectPending', () => {
  it('should transition to rejected with timestamp', () => {
    const rejected = rejectPending(makePending());
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectedAt).toBeGreaterThan(0);
  });

  it('should include reason if provided', () => {
    const rejected = rejectPending(makePending(), 'Too risky');
    expect(rejected.rejectedReason).toBe('Too risky');
  });

  it('should not include rejectedReason when not provided', () => {
    const rejected = rejectPending(makePending());
    expect(rejected).not.toHaveProperty('rejectedReason');
  });
});

describe('expirePending', () => {
  it('should transition to expired with timestamp', () => {
    const expired = expirePending(makePending());
    expect(expired.status).toBe('expired');
    expect(expired.expiredAt).toBeGreaterThan(0);
  });
});

describe('markExecuted', () => {
  it('should transition approved to executed with trade ID', () => {
    const approved: ApprovedRecommendation = {
      ...makePending(),
      status: 'approved',
      approvedAt: Date.now(),
    };
    const executed = markExecuted(approved, 'trade-123');
    expect(executed.status).toBe('executed');
    expect(executed.tradeId).toBe('trade-123');
    expect(executed.executedAt).toBeGreaterThan(0);
    expect(executed.approvedAt).toBe(approved.approvedAt);
  });
});
