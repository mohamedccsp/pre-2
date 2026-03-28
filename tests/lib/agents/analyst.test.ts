import { describe, it, expect } from 'vitest';
import { computeRSI, computeSMA, parseAnalysisResponse } from '@/lib/agents/analyst';

describe('computeRSI', () => {
  it('should return null for insufficient data', () => {
    expect(computeRSI([1, 2, 3], 14)).toBeNull();
    expect(computeRSI([], 14)).toBeNull();
  });

  it('should return 100 for a flat price series (no losses)', () => {
    const flat = Array(30).fill(100);
    // No price changes → avgGain and avgLoss both 0
    // avgLoss === 0 is checked first → returns 100 (standard RSI convention)
    const rsi = computeRSI(flat, 14);
    expect(rsi).toBe(100);
  });

  it('should return close to 100 for an all-up series', () => {
    const rising = Array.from({ length: 30 }, (_, i) => 100 + i);
    const rsi = computeRSI(rising, 14);
    expect(rsi).toBe(100);
  });

  it('should return close to 0 for an all-down series', () => {
    const falling = Array.from({ length: 30 }, (_, i) => 200 - i);
    const rsi = computeRSI(falling, 14);
    expect(rsi).toBe(0);
  });

  it('should return a value between 0 and 100 for mixed data', () => {
    const mixed = [44, 44.3, 44.1, 43.6, 44.3, 44.8, 45.1, 45.4, 45.1, 45.4,
                   45.0, 44.5, 44.2, 44.0, 43.5, 43.8, 44.2, 44.6, 44.9, 44.3];
    const rsi = computeRSI(mixed, 14);
    expect(rsi).not.toBeNull();
    expect(rsi!).toBeGreaterThanOrEqual(0);
    expect(rsi!).toBeLessThanOrEqual(100);
  });

  it('should work with a custom period', () => {
    const data = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i) * 10);
    const rsi7 = computeRSI(data, 7);
    expect(rsi7).not.toBeNull();
    expect(rsi7!).toBeGreaterThanOrEqual(0);
    expect(rsi7!).toBeLessThanOrEqual(100);
  });
});

describe('computeSMA', () => {
  it('should return null for insufficient data', () => {
    expect(computeSMA([1, 2], 5)).toBeNull();
    expect(computeSMA([], 1)).toBeNull();
  });

  it('should compute correct SMA for simple data', () => {
    expect(computeSMA([1, 2, 3, 4, 5], 3)).toBeCloseTo(4, 10);
    // Last 3 values: 3, 4, 5 → mean = 4
  });

  it('should compute correct SMA for period equal to array length', () => {
    expect(computeSMA([10, 20, 30], 3)).toBeCloseTo(20, 10);
  });

  it('should use only the last N values', () => {
    expect(computeSMA([100, 1, 2, 3], 3)).toBeCloseTo(2, 10);
    // Last 3: 1, 2, 3 → mean = 2
  });
});

describe('parseAnalysisResponse', () => {
  it('should parse valid JSON response', () => {
    const result = parseAnalysisResponse(
      '{"action":"buy","confidence":75,"reasoning":"Strong bullish signals"}'
    );
    expect(result.action).toBe('buy');
    expect(result.confidence).toBe(75);
    expect(result.reasoning).toBe('Strong bullish signals');
  });

  it('should handle markdown code fences', () => {
    const result = parseAnalysisResponse(
      '```json\n{"action":"sell","confidence":60,"reasoning":"Bearish trend"}\n```'
    );
    expect(result.action).toBe('sell');
    expect(result.confidence).toBe(60);
  });

  it('should fall back on invalid JSON', () => {
    const result = parseAnalysisResponse('This is not JSON at all');
    expect(result.action).toBe('hold');
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toBe('Analysis inconclusive');
  });

  it('should clamp confidence to 0-100', () => {
    const result = parseAnalysisResponse(
      '{"action":"buy","confidence":150,"reasoning":"test"}'
    );
    expect(result.confidence).toBe(100);
  });

  it('should default to hold for invalid action', () => {
    const result = parseAnalysisResponse(
      '{"action":"yolo","confidence":50,"reasoning":"test"}'
    );
    expect(result.action).toBe('hold');
  });
});
