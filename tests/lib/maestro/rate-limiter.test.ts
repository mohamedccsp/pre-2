import { describe, it, expect, beforeEach } from 'vitest';
import { checkRateLimit, clearRateLimits } from '@/lib/maestro/rate-limiter';

describe('Rate Limiter', () => {
  beforeEach(() => {
    clearRateLimits();
  });

  it('should allow requests under the limit', () => {
    const result = checkRateLimit('127.0.0.1', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should track request count per IP', () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit('127.0.0.1', 5, 60000);
    }
    const result = checkRateLimit('127.0.0.1', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('should block requests over the limit', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('127.0.0.1', 5, 60000);
    }
    const result = checkRateLimit('127.0.0.1', 5, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should track different IPs independently', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('127.0.0.1', 5, 60000);
    }

    const result = checkRateLimit('192.168.1.1', 5, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('should include resetAt timestamp', () => {
    const before = Date.now();
    const result = checkRateLimit('127.0.0.1', 5, 60000);
    expect(result.resetAt).toBeGreaterThanOrEqual(before + 60000);
  });
});
