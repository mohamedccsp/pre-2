import { NextResponse } from 'next/server';
import { getGlobal } from '@/lib/api/coingecko';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';

/**
 * GET /api/market/global — Global market statistics
 * @param request - Incoming request
 * @returns JSON with global market data
 */
export async function GET(request: Request): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request);
  if (rateLimited) return rateLimited;

  try {
    const data = await getGlobal();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
