import { NextResponse } from 'next/server';
import { getCoinsMarkets } from '@/lib/api/coingecko';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { paginationSchema } from '@/lib/maestro/validator';

/**
 * GET /api/market/coins — Top coins by market cap
 * @param request - Incoming request with optional page/perPage params
 * @returns JSON array of coin market data
 */
export async function GET(request: Request): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request);
  if (rateLimited) return rateLimited;

  try {
    const { searchParams } = new URL(request.url);
    const parsed = paginationSchema.safeParse({
      page: searchParams.get('page') || '1',
      perPage: searchParams.get('perPage') || '20',
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { page, perPage } = parsed.data;
    const data = await getCoinsMarkets(perPage, page);

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
