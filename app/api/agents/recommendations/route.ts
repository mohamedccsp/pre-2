import { NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { getRecommendationHistory, expireStaleRecommendations } from '@/lib/recommendations/repository';
import { getAuthUserId, unauthorized } from '@/lib/auth-guard';

/**
 * GET /api/agents/recommendations — List all recommendations for the authenticated user
 * Marks stale pending recommendations as expired before returning.
 * @param request - Incoming request
 * @returns JSON array of recommendations, newest first
 */
export async function GET(request: Request): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request, 30);
  if (rateLimited) return rateLimited;

  const userId = await getAuthUserId();
  if (!userId) return unauthorized();

  try {
    // Expire stale pending recommendations before listing
    await expireStaleRecommendations(userId);
    const recommendations = await getRecommendationHistory(userId, 50);
    return NextResponse.json(recommendations);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch recommendations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
