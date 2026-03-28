import { describe, it, expect } from 'vitest';
import { classifyQuery } from '@/lib/agents/researcher';

describe('Researcher — classifyQuery', () => {
  it('should classify single coin queries', () => {
    const result = classifyQuery('What is the price of Bitcoin?');
    expect(result.type).toBe('coin');
    expect(result.coinIds).toContain('bitcoin');
  });

  it('should classify alias-based queries', () => {
    const result = classifyQuery('How is ETH doing?');
    expect(result.type).toBe('coin');
    expect(result.coinIds).toContain('ethereum');
  });

  it('should classify comparison queries with "vs"', () => {
    const result = classifyQuery('Compare BTC vs ETH');
    expect(result.type).toBe('comparison');
    expect(result.coinIds).toContain('bitcoin');
    expect(result.coinIds).toContain('ethereum');
  });

  it('should classify comparison queries with "compare"', () => {
    const result = classifyQuery('Compare Solana and Cardano');
    expect(result.type).toBe('comparison');
    expect(result.coinIds).toContain('solana');
    expect(result.coinIds).toContain('cardano');
  });

  it('should classify general market queries', () => {
    const result = classifyQuery('How is the crypto market doing today?');
    expect(result.type).toBe('market');
    expect(result.coinIds).toHaveLength(0);
  });

  it('should preserve the original query', () => {
    const query = 'Tell me about Dogecoin';
    const result = classifyQuery(query);
    expect(result.originalQuery).toBe(query);
  });

  it('should limit comparison coins to 3', () => {
    const result = classifyQuery('Compare BTC ETH SOL ADA DOT');
    expect(result.coinIds.length).toBeLessThanOrEqual(3);
  });

  it('should handle case-insensitive matching', () => {
    const result = classifyQuery('BITCOIN price');
    expect(result.type).toBe('coin');
    expect(result.coinIds).toContain('bitcoin');
  });
});
