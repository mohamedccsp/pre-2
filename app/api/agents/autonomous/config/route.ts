import { NextResponse } from 'next/server';
import { z } from 'zod';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { logAuditEntry, hashForAudit } from '@/lib/maestro/audit-logger';
import { getAutonomousConfig, updateAutonomousConfig } from '@/lib/autonomous/config-repository';
import { getAuthUserId, unauthorized } from '@/lib/auth-guard';

/** Zod schema for config PATCH body */
const configPatchSchema = z.object({
  killSwitchActive: z.boolean().optional(),
  maxTradePct: z.number().min(0.01).max(0.50).optional(),
  maxTradesPerDay: z.number().int().min(1).max(50).optional(),
  cooldownMinutes: z.number().int().min(0).max(1440).optional(),
  dailyLossLimitPct: z.number().min(0.01).max(0.50).optional(),
}).strict();

/**
 * GET /api/agents/autonomous/config — Return current guardrail configuration
 * @param request - Incoming request
 * @returns JSON AutonomousConfig
 */
export async function GET(request: Request): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request, 30);
  if (rateLimited) return rateLimited;

  const userId = await getAuthUserId();
  if (!userId) return unauthorized();

  try {
    const config = await getAutonomousConfig(userId);
    return NextResponse.json(config);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/agents/autonomous/config — Update guardrail configuration
 * Validates all fields; partial updates allowed.
 * Kill switch toggle goes through this endpoint.
 * @param request - Partial AutonomousConfig JSON body
 * @returns Updated AutonomousConfig
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request, 10);
  if (rateLimited) return rateLimited;

  const userId = await getAuthUserId();
  if (!userId) return unauthorized();

  try {
    const body = await request.json();
    const parsed = configPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid config', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await updateAutonomousConfig(userId, parsed.data);

    // L5: Audit log config changes, especially kill switch
    const action = parsed.data.killSwitchActive !== undefined
      ? `kill_switch_${parsed.data.killSwitchActive ? 'activated' : 'deactivated'}`
      : 'config_updated';

    await logAuditEntry({
      agentName: 'system',
      action,
      inputHash: hashForAudit(JSON.stringify(parsed.data)),
      outputHash: hashForAudit(JSON.stringify(updated)),
      durationMs: 0,
      success: true,
    });

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update config';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
