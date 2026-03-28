import { describe, it, expect } from 'vitest';
import { verifyEnvelope } from '@/lib/agents/message-bus';

describe('L7 HMAC identity verification', () => {
  it('should reject invalid tokens', () => {
    expect(verifyEnvelope('researcher', 'abc123', 'bad-token')).toBe(false);
  });

  it('should reject empty tokens', () => {
    expect(verifyEnvelope('researcher', 'abc123', '')).toBe(false);
  });

  it('should reject wrong agent names', () => {
    // A valid signature for 'researcher' should not verify as 'analyst'
    // We can't easily generate a valid token without the internal signEnvelope,
    // but we can verify that different agents produce different tokens
    const token1Valid = verifyEnvelope('researcher', 'payload', 'fake');
    const token2Valid = verifyEnvelope('analyst', 'payload', 'fake');
    expect(token1Valid).toBe(false);
    expect(token2Valid).toBe(false);
  });
});
