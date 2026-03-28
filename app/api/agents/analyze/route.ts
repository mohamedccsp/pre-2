import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { coinIdSchema } from '@/lib/maestro/validator';
import { executeAnalysisChain } from '@/lib/agents/chain';
import { insertRecommendation, expireStaleRecommendations } from '@/lib/recommendations/repository';
import { getAuthUserId, unauthorized } from '@/lib/auth-guard';

/** Request body schema for the analyze endpoint */
const analyzeSchema = z.object({
  coinId: coinIdSchema,
});

/**
 * POST /api/agents/analyze — Run the full Researcher → Analyst → Advisor chain
 * @param request - Request with JSON body containing coinId
 * @returns JSON with the pending trade recommendation
 */
export async function POST(request: Request): Promise<NextResponse> {
  // L4: Stricter rate limit — chain is expensive (3 LLM calls)
  const rateLimited = rateLimitMiddleware(request, 5);
  if (rateLimited) return rateLimited;

  const userId = await getAuthUserId();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();

    // L1/L6: Validate input
    const parsed = analyzeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Expire stale recommendations in background
    expireStaleRecommendations(userId).catch(() => {});

    // Execute the full agent chain
    const { recommendation } = await executeAnalysisChain({
      coinId: parsed.data.coinId,
      userId,
    });

    // Persist recommendation to DB
    await insertRecommendation(userId, recommendation);

    return NextResponse.json(recommendation, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analysis chain failed';
    const status = message.includes('Blocked') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
