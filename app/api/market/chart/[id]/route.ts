import { NextResponse } from 'next/server';
import { getMarketChart, getOHLC } from '@/lib/api/coingecko';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { coinIdSchema, daysSchema } from '@/lib/maestro/validator';

/**
 * GET /api/market/chart/[id]?days=7&type=line|ohlc — Chart data for a coin
 * @param request - Incoming request with days and type query params
 * @param params - Route params containing coin ID
 * @returns JSON with price chart data
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request);
  if (rateLimited) return rateLimited;

  try {
    const parsedId = coinIdSchema.safeParse(params.id);
    if (!parsedId.success) {
      return NextResponse.json(
        { error: 'Invalid coin ID', details: parsedId.error.flatten() },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const days = searchParams.get('days') || '7';
    const type = searchParams.get('type') || 'line';

    const parsedDays = daysSchema.safeParse(days);
    if (!parsedDays.success) {
      return NextResponse.json(
        { error: 'Invalid days parameter', details: parsedDays.error.flatten() },
        { status: 400 }
      );
    }

    if (type === 'ohlc') {
      const data = await getOHLC(parsedId.data, Number(days));
      return NextResponse.json(data);
    }

    const data = await getMarketChart(parsedId.data, days);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
