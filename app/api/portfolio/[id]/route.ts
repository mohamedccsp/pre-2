import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { portfolioItems } from '@/lib/db/schema';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { coinIdSchema } from '@/lib/maestro/validator';

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

  try {
    const parsed = coinIdSchema.safeParse(params.id);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid ID', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await db.delete(portfolioItems).where(eq(portfolioItems.id, parsed.data));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
