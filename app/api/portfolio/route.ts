import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { portfolioItems } from '@/lib/db/schema';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { generateId } from '@/lib/utils';
import { z } from 'zod';

const addItemSchema = z.object({
  coinId: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  amount: z.number().positive(),
  buyPrice: z.number().positive(),
});

/**
 * GET /api/portfolio — List all portfolio items
 * @param request - Incoming request
 * @returns JSON array of portfolio items
 */
export async function GET(request: Request): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request);
  if (rateLimited) return rateLimited;

  try {
    const items = await db.select().from(portfolioItems);
    return NextResponse.json(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/portfolio — Add a coin to the portfolio
 * @param request - Request with JSON body containing coin details
 * @returns JSON with created portfolio item
 */
export async function POST(request: Request): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();
    const parsed = addItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const item = {
      id: generateId(),
      ...parsed.data,
      addedAt: new Date(),
    };

    await db.insert(portfolioItems).values(item);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
