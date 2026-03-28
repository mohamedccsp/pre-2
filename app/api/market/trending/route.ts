import { NextResponse } from 'next/server';
import { getTrending } from '@/lib/api/coingecko';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';

/**
 * GET /api/market/trending — Trending coins in last 24h
 * @param request - Incoming request
 * @returns JSON array of trending coins
 */
export async function GET(request: Request): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request);
  if (rateLimited) return rateLimited;

  try {
    const data = await getTrending();
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
