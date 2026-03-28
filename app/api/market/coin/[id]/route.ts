import { NextResponse } from 'next/server';
import { getCoinDetail } from '@/lib/api/coingecko';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { coinIdSchema } from '@/lib/maestro/validator';

/**
 * GET /api/market/coin/[id] — Full detail for a single coin
 * @param request - Incoming request
 * @param params - Route params containing coin ID
 * @returns JSON with detailed coin data
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request);
  if (rateLimited) return rateLimited;

  try {
    const parsed = coinIdSchema.safeParse(params.id);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid coin ID', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = await getCoinDetail(parsed.data);
    const headers = { 'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=60' };
    return NextResponse.json(data, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
