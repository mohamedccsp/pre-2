import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/maestro/rate-limiter';
import { runAutonomousCycle, getLastCycle } from '@/lib/autonomous/cycle';
import { getAuthUserId, unauthorized } from '@/lib/auth-guard';

/**
 * POST /api/agents/autonomous/cycle — Trigger one autonomous trading cycle
 * Rate limited to 2 requests per 5 minutes (cycle is expensive: 20 LLM chains)
 * @param request - Incoming request (no body required)
 * @returns JSON CycleResult
 */
export async function POST(request: Request): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return unauthorized();

  const { allowed } = checkRateLimit(`autonomous:${userId}`, 2, 300_000);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Autonomous cycle rate limit — max 2 per 5 minutes' },
      { status: 429 }
    );
  }

  try {
    const result = await runAutonomousCycle(userId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Autonomous cycle failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/agents/autonomous/cycle — Return the most recent cycle result
 * Used by the UI to display monitoring summary
 * @param request - Incoming request
 * @returns JSON CycleResult or null
 */
export async function GET(request: Request): Promise<NextResponse> {
  const userId = await getAuthUserId();
  if (!userId) return unauthorized();

  const { allowed } = checkRateLimit(`autonomous-get:${userId}`, 30, 60_000);
  if (!allowed) {
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
  }

  try {
    const lastCycle = await getLastCycle(userId);
    return NextResponse.json(lastCycle);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch cycle';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
