import { z } from 'zod';

/** Valid coin ID pattern — alphanumeric with hyphens */
const COIN_ID_PATTERN = /^[a-z0-9-]+$/;

/** Maximum query parameter length */
const MAX_PARAM_LENGTH = 200;

/** Schema for coin ID validation */
export const coinIdSchema = z
  .string()
  .min(1, 'Coin ID is required')
  .max(MAX_PARAM_LENGTH, 'Coin ID too long')
  .regex(COIN_ID_PATTERN, 'Invalid coin ID format');

/** Schema for comma-separated coin IDs */
export const coinIdsSchema = z
  .string()
  .min(1, 'At least one coin ID is required')
  .max(MAX_PARAM_LENGTH * 10, 'Input too long')
  .refine(
    (val) => val.split(',').every((id) => COIN_ID_PATTERN.test(id.trim())),
    'Invalid coin ID format in list'
  );

/** Schema for days parameter */
export const daysSchema = z
  .string()
  .refine(
    (val) => ['1', '7', '14', '30', '90', '180', '365', 'max'].includes(val),
    'Invalid days value. Use: 1, 7, 14, 30, 90, 180, 365, or max'
  );

/** Schema for pagination */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(100).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Sanitize a string by removing potential injection characters
 * @param input - Raw input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>'";&|`$(){}]/g, '')
    .trim()
    .slice(0, MAX_PARAM_LENGTH);
}

/**
 * Validate and sanitize query parameters from a request URL
 * @param url - Request URL string
 * @param params - Parameter names to extract
 * @returns Object with validated parameter values
 */
export function extractParams(
  url: string,
  params: string[]
): Record<string, string | null> {
  const searchParams = new URL(url).searchParams;
  const result: Record<string, string | null> = {};

  for (const param of params) {
    const value = searchParams.get(param);
    result[param] = value ? sanitizeInput(value) : null;
  }

  return result;
}

// ─── MAESTRO L1: Agent Input Validation ─────────────────────────

/** Maximum allowed agent query length */
const MAX_QUERY_LENGTH = 500;

/** Patterns that indicate prompt injection attempts */
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+(instructions|prompts)/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /\bpretend\s+(you|to\s+be)/i,
  /\bforget\s+(everything|all|your)/i,
  /\bjailbreak/i,
  /\bDAN\b/,
  /do\s+anything\s+now/i,
  /\broleplay\s+as\b/i,
  /\bnew\s+instructions?\s*:/i,
  /\boverride\b.*\binstructions?\b/i,
];

/** Schema for agent research query input */
export const agentQuerySchema = z.object({
  query: z
    .string()
    .min(3, 'Query must be at least 3 characters')
    .max(MAX_QUERY_LENGTH, `Query must be under ${MAX_QUERY_LENGTH} characters`),
});

/**
 * Check if a query contains prompt injection patterns (MAESTRO L1)
 * @param query - User query string
 * @returns Object with safe status and matched pattern if unsafe
 */
export function checkPromptInjection(query: string): { safe: boolean; reason?: string } {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(query)) {
      return { safe: false, reason: `Blocked: query matches restricted pattern` };
    }
  }
  return { safe: true };
}

/**
 * Sanitize agent output before returning to user (MAESTRO L6)
 * @param output - Raw LLM output string
 * @returns Sanitized output string
 */
export function sanitizeAgentOutput(output: string): string {
  return output
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}
