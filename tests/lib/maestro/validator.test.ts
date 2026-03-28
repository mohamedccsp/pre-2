import { describe, it, expect } from 'vitest';
import { coinIdSchema, coinIdsSchema, daysSchema, sanitizeInput } from '@/lib/maestro/validator';

describe('MAESTRO Validator', () => {
  describe('coinIdSchema', () => {
    it('should accept valid coin IDs', () => {
      expect(coinIdSchema.safeParse('bitcoin').success).toBe(true);
      expect(coinIdSchema.safeParse('bitcoin-cash').success).toBe(true);
      expect(coinIdSchema.safeParse('usd-coin').success).toBe(true);
    });

    it('should reject invalid coin IDs', () => {
      expect(coinIdSchema.safeParse('').success).toBe(false);
      expect(coinIdSchema.safeParse('Bitcoin').success).toBe(false);
      expect(coinIdSchema.safeParse('bit coin').success).toBe(false);
      expect(coinIdSchema.safeParse('<script>').success).toBe(false);
    });
  });

  describe('coinIdsSchema', () => {
    it('should accept comma-separated valid IDs', () => {
      expect(coinIdsSchema.safeParse('bitcoin,ethereum').success).toBe(true);
      expect(coinIdsSchema.safeParse('bitcoin').success).toBe(true);
    });

    it('should reject invalid entries in list', () => {
      expect(coinIdsSchema.safeParse('bitcoin,<script>').success).toBe(false);
      expect(coinIdsSchema.safeParse('').success).toBe(false);
    });
  });

  describe('daysSchema', () => {
    it('should accept valid day values', () => {
      expect(daysSchema.safeParse('1').success).toBe(true);
      expect(daysSchema.safeParse('7').success).toBe(true);
      expect(daysSchema.safeParse('365').success).toBe(true);
      expect(daysSchema.safeParse('max').success).toBe(true);
    });

    it('should reject invalid day values', () => {
      expect(daysSchema.safeParse('0').success).toBe(false);
      expect(daysSchema.safeParse('2').success).toBe(false);
      expect(daysSchema.safeParse('abc').success).toBe(false);
    });
  });

  describe('sanitizeInput', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeInput('<script>alert("xss")</script>')).toBe('scriptalertxss/script');
      expect(sanitizeInput('hello; rm -rf /')).toBe('hello rm -rf /');
      expect(sanitizeInput('normal-input')).toBe('normal-input');
    });

    it('should trim whitespace', () => {
      expect(sanitizeInput('  hello  ')).toBe('hello');
    });

    it('should truncate long strings', () => {
      const long = 'a'.repeat(300);
      expect(sanitizeInput(long).length).toBe(200);
    });
  });
});
