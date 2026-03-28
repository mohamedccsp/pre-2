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
