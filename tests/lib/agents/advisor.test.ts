import { describe, it, expect } from 'vitest';
import { parseAdvisorResponse } from '@/lib/agents/advisor';

describe('parseAdvisorResponse', () => {
  const balance = 1000;

  it('should parse valid JSON response', () => {
    const result = parseAdvisorResponse(
      '{"riskLevel":"low","reasoning":"Low risk setup","suggestedPercentOfBalance":0.1}',
      balance
    );
    expect(result.riskLevel).toBe('low');
    expect(result.reasoning).toBe('Low risk setup');
    expect(result.suggestedAmountUsd).toBeCloseTo(100, 2);
  });

  it('should handle markdown code fences', () => {
    const result = parseAdvisorResponse(
      '```json\n{"riskLevel":"medium","reasoning":"Moderate signals","suggestedPercentOfBalance":0.15}\n```',
      balance
    );
    expect(result.riskLevel).toBe('medium');
    expect(result.suggestedAmountUsd).toBeCloseTo(150, 2);
  });

  it('should cap suggestedPercentOfBalance at 20%', () => {
    const result = parseAdvisorResponse(
      '{"riskLevel":"low","reasoning":"test","suggestedPercentOfBalance":0.5}',
      balance
    );
    expect(result.suggestedAmountUsd).toBeCloseTo(200, 2); // 20% of 1000
  });

  it('should fall back on invalid JSON', () => {
    const result = parseAdvisorResponse('Not valid JSON', balance);
    expect(result.riskLevel).toBe('high');
    expect(result.suggestedAmountUsd).toBe(0);
    expect(result.reasoning).toBe('Recommendation inconclusive');
  });

  it('should default to high risk for invalid riskLevel', () => {
    const result = parseAdvisorResponse(
      '{"riskLevel":"extreme","reasoning":"test","suggestedPercentOfBalance":0.1}',
      balance
    );
    expect(result.riskLevel).toBe('high');
  });

  it('should handle zero balance', () => {
    const result = parseAdvisorResponse(
      '{"riskLevel":"low","reasoning":"test","suggestedPercentOfBalance":0.1}',
      0
    );
    expect(result.suggestedAmountUsd).toBe(0);
  });
});
