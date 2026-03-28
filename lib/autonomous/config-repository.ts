import { db } from '@/lib/db';
import { autonomousConfig } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/** Typed autonomous trading configuration */
export interface AutonomousConfig {
  killSwitchActive: boolean;
  maxTradePct: number;
  maxTradesPerDay: number;
  cooldownMinutes: number;
  dailyLossLimitPct: number;
  updatedAt: number;
}

/**
 * Get the persisted autonomous config for a user, seeding defaults if absent.
 * Uses onConflictDoNothing for race-safe upsert (same pattern as virtual-portfolio).
 * @param userId - The user ID to get config for
 * @returns Current AutonomousConfig
 */
export async function getAutonomousConfig(userId: string): Promise<AutonomousConfig> {
  const now = Date.now();

  await db
    .insert(autonomousConfig)
    .values({
      id: userId,
      userId,
      killSwitchActive: false,
      maxTradePct: 0.10,
      maxTradesPerDay: 5,
      cooldownMinutes: 30,
      dailyLossLimitPct: 0.15,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const rows = await db
    .select()
    .from(autonomousConfig)
    .where(eq(autonomousConfig.id, userId))
    .limit(1);

  const row = rows[0];
  return {
    killSwitchActive: row.killSwitchActive,
    maxTradePct: row.maxTradePct,
    maxTradesPerDay: row.maxTradesPerDay,
    cooldownMinutes: row.cooldownMinutes,
    dailyLossLimitPct: row.dailyLossLimitPct,
    updatedAt: row.updatedAt,
  };
}

/**
 * Persist updated config fields for a user, always writing updatedAt = Date.now()
 * @param userId - The user ID to update config for
 * @param patch - Partial config fields to update
 * @returns Updated AutonomousConfig
 */
export async function updateAutonomousConfig(
  userId: string,
  patch: Partial<Omit<AutonomousConfig, 'updatedAt'>>
): Promise<AutonomousConfig> {
  // Ensure the row exists first
  await getAutonomousConfig(userId);

  await db
    .update(autonomousConfig)
    .set({ ...patch, updatedAt: Date.now() })
    .where(eq(autonomousConfig.id, userId));

  return getAutonomousConfig(userId);
}
