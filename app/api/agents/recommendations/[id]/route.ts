import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { logAuditEntry, hashForAudit } from '@/lib/maestro/audit-logger';
import { getRecommendationById, updateRecommendationStatus } from '@/lib/recommendations/repository';
import { rejectPending, expirePending } from '@/lib/recommendations/lifecycle';
import { checkNotExpired, checkTradeSize, checkCoinAllowlist } from '@/lib/maestro/guardrails';
import { getOrCreatePortfolio } from '@/lib/virtual-portfolio/repository';
import { executeTrade } from '@/lib/virtual-portfolio/executor';
import { getAuthUserId, unauthorized } from '@/lib/auth-guard';
import type { PendingRecommendation } from '@/lib/types/recommendation';

/** Request body schema for approve/reject */
const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve') }),
  z.object({ action: z.literal('reject'), reason: z.string().optional() }),
]);

/**
 * GET /api/agents/recommendations/[id] — Get a single recommendation
 * @param request - Incoming request
 * @param params - Route params containing recommendation ID
 * @returns JSON with the recommendation
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request, 30);
  if (rateLimited) return rateLimited;

  const userId = await getAuthUserId();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const rec = await getRecommendationById(id);
    if (!rec) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }
    return NextResponse.json(rec);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch recommendation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/agents/recommendations/[id] — Approve or reject a recommendation
 * @param request - Request with JSON body containing action
 * @param params - Route params containing recommendation ID
 * @returns JSON with the updated recommendation and optional trade
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request, 10);
  if (rateLimited) return rateLimited;

  const userId = await getAuthUserId();
  if (!userId) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();

    // Validate action
    const parsed = actionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid action', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Fetch recommendation
    const rec = await getRecommendationById(id);
    if (!rec) {
      return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
    }
    if (rec.status !== 'pending') {
      return NextResponse.json(
        { error: `Recommendation is already ${rec.status}` },
        { status: 409 }
      );
    }

    const pending = rec as PendingRecommendation;

    // Handle rejection
    if (parsed.data.action === 'reject') {
      const reason = 'reason' in parsed.data ? parsed.data.reason : undefined;
      const rejected = rejectPending(pending, reason);
      await updateRecommendationStatus(rejected);

      await logAuditEntry({
        agentName: 'system',
        action: 'recommendation_rejected',
        inputHash: hashForAudit(id),
        outputHash: '',
        durationMs: 0,
        success: true,
      });

      return NextResponse.json(rejected);
    }

    // Handle approval — check guardrails first
    const expiryCheck = checkNotExpired(pending);
    if (!expiryCheck.allowed) {
      const expired = expirePending(pending);
      await updateRecommendationStatus(expired);
      return NextResponse.json(
        { error: 'Recommendation has expired', recommendation: expired },
        { status: 410 }
      );
    }

    // Block approval of hold recommendations — nothing to execute
    if (pending.action === 'hold') {
      return NextResponse.json(
        { error: 'Cannot execute a hold recommendation' },
        { status: 400 }
      );
    }

    const allowlistCheck = checkCoinAllowlist(pending.coinId);
    if (!allowlistCheck.allowed) {
      return NextResponse.json({ error: allowlistCheck.reason }, { status: 400 });
    }

    // Get current portfolio and validate trade size
    const portfolio = await getOrCreatePortfolio(userId);
    const isBuy = pending.action === 'buy';

    // Only validate trade size against cash balance for buy orders
    if (isBuy) {
      const tradeSizeCheck = checkTradeSize(pending.suggestedAmountUsd, portfolio.balanceUsd);
      if (!tradeSizeCheck.allowed) {
        return NextResponse.json({ error: tradeSizeCheck.reason }, { status: 400 });
      }
    }

    // Execute trade via shared executor (HITL uses 20% max trade cap)
    const result = await executeTrade({ userId, pending, maxTradePct: 0.20 });
    return NextResponse.json({ recommendation: result.recommendation, trade: result.trade });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process recommendation';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
