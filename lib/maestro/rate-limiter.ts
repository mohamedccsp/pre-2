import { NextResponse } from 'next/server';

/** Rate limit entry tracking request count per window */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** In-memory rate limit store keyed by IP */
const store = new Map<string, RateLimitEntry>();

/** Default: 30 requests per 60 seconds (matches CoinGecko free tier) */
const DEFAULT_MAX_REQUESTS = 30;
const DEFAULT_WINDOW_MS = 60_000;

/**
 * Check if a request should be rate limited
 * @param ip - Client IP address
 * @param maxRequests - Maximum requests per window
 * @param windowMs - Window duration in milliseconds
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  ip: string,
  maxRequests = DEFAULT_MAX_REQUESTS,
  windowMs = DEFAULT_WINDOW_MS
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || entry.resetAt <= now) {
    store.set(ip, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  entry.count++;
  const remaining = Math.max(0, maxRequests - entry.count);

  return {
    allowed: entry.count <= maxRequests,
    remaining,
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limiting middleware for Next.js API routes
 * @param request - Incoming request
 * @param maxRequests - Maximum requests per window
 * @returns NextResponse with 429 if rate limited, or null if allowed
 */
export function rateLimitMiddleware(
  request: Request,
  maxRequests = DEFAULT_MAX_REQUESTS
): NextResponse | null {
  const ip = request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'unknown';

  const { allowed, remaining, resetAt } = checkRateLimit(ip, maxRequests);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
          'Retry-After': String(Math.ceil((resetAt - Date.now()) / 1000)),
        },
      }
    );
  }

  // Attach rate limit headers — caller adds these to the success response
  void remaining; // used by callers who need header info
  return null;
}

/**
 * Clear the rate limit store (useful for testing)
 */
export function clearRateLimits(): void {
  store.clear();
}
