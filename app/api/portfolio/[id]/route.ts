import { NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { portfolioItems } from '@/lib/db/schema';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { coinIdSchema } from '@/lib/maestro/validator';
import { getAuthUserId, unauthorized } from '@/lib/auth-guard';

/**
 * DELETE /api/portfolio/[id] — Remove a coin from the portfolio
 * @param request - Incoming request
 * @param params - Route params containing portfolio item ID
 * @returns Empty 204 on success
 */
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request);
  if (rateLimited) return rateLimited;

  const userId = await getAuthUserId();
  if (!userId) return unauthorized();

  try {
    const parsed = coinIdSchema.safeParse(params.id);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid ID', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await db.delete(portfolioItems).where(and(eq(portfolioItems.id, parsed.data), eq(portfolioItems.userId, userId)));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
