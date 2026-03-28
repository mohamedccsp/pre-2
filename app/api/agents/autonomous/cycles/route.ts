import { NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { getCycleHistory } from '@/lib/autonomous/cycle';
import { getAuthUserId, unauthorized } from '@/lib/auth-guard';

/**
 * GET /api/agents/autonomous/cycles — List recent autonomous cycle runs
 * Query param: limit (default 5, max 20)
 * @param request - Incoming request
 * @returns Array of CycleResult summaries
 */
export async function GET(request: Request): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request, 30);
  if (rateLimited) return rateLimited;

  const userId = await getAuthUserId();
  if (!userId) return unauthorized();

  try {
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = Math.min(Math.max(1, parseInt(limitParam ?? '5', 10) || 5), 20);

    const cycles = await getCycleHistory(userId, limit);
    return NextResponse.json(cycles);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch cycles';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
