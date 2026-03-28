import { NextResponse } from 'next/server';
import { executeAgent } from '@/lib/agents/orchestrator';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { agentQuerySchema } from '@/lib/maestro/validator';

/**
 * POST /api/agents/research — Execute the researcher agent
 * @param request - Request with JSON body containing query
 * @returns JSON with agent research output
 */
export async function POST(request: Request): Promise<NextResponse> {
  // L4: Rate limit agent calls more strictly (10/min)
  const rateLimited = rateLimitMiddleware(request, 10);
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json();

    // L1/L6: Validate input
    const parsed = agentQuerySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { query } = parsed.data;
    const output = await executeAgent('researcher', { query });

    return NextResponse.json(output);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Agent execution failed';
    const status = message.includes('Blocked') ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
