import { db } from '@/lib/db';
import { recommendations } from '@/lib/db/schema';
import { eq, desc, and, lte } from 'drizzle-orm';
import type { Recommendation, PendingRecommendation } from '@/lib/types/recommendation';
import type { TechnicalSnapshot } from '@/lib/types/analysis';

/** Shape of a raw database row from the recommendations table */
type RecommendationRow = typeof recommendations.$inferSelect;

/**
 * Map a raw database row to the correct Recommendation discriminated union member
 * @param row - Raw row from the recommendations table
 * @returns Typed Recommendation based on the row's status
 */
function rowToRecommendation(row: RecommendationRow): Recommendation {
  const indicators: TechnicalSnapshot = JSON.parse(row.indicatorsJson);

  const core = {
    id: row.id,
    coinId: row.coinId,
    coinSymbol: row.coinSymbol,
    coinName: row.coinName,
    action: row.action as Recommendation['action'],
    confidence: row.confidence,
    riskLevel: row.riskLevel as Recommendation['riskLevel'],
    reasoning: row.reasoning,
    researchSummary: row.researchSummary,
    analysisSummary: row.analysisSummary,
    indicators,
    suggestedAmountUsd: row.suggestedAmountUsd,
    currentPrice: row.currentPrice,
    auditId: row.auditId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
  } as const;

  switch (row.status) {
    case 'approved':
      return {
        ...core,
        status: 'approved' as const,
        approvedAt: row.approvedAt!,
      };

    case 'rejected':
      return {
        ...core,
        status: 'rejected' as const,
        rejectedAt: row.rejectedAt!,
        ...(row.rejectedReason ? { rejectedReason: row.rejectedReason } : {}),
      };

    case 'executed':
      return {
        ...core,
        status: 'executed' as const,
        approvedAt: row.approvedAt!,
        executedAt: row.executedAt!,
        tradeId: row.tradeId!,
      };

    case 'expired':
      return {
        ...core,
        status: 'expired' as const,
        expiredAt: row.expiresAt,
      };

    case 'pending':
    default:
      return {
        ...core,
        status: 'pending' as const,
      };
  }
}

/**
 * Insert a new pending recommendation into the database
 * @param rec - The pending recommendation to insert
 * @returns Promise that resolves when the row is inserted
 */
export async function insertRecommendation(rec: PendingRecommendation): Promise<void> {
  await db.insert(recommendations).values({
    id: rec.id,
    coinId: rec.coinId,
    coinSymbol: rec.coinSymbol,
    coinName: rec.coinName,
    action: rec.action,
    status: rec.status,
    confidence: rec.confidence,
    riskLevel: rec.riskLevel,
    reasoning: rec.reasoning,
    researchSummary: rec.researchSummary,
    analysisSummary: rec.analysisSummary,
    indicatorsJson: JSON.stringify(rec.indicators),
    suggestedAmountUsd: rec.suggestedAmountUsd,
    currentPrice: rec.currentPrice,
    auditId: rec.auditId,
    createdAt: rec.createdAt,
    expiresAt: rec.expiresAt,
  });
}

/**
 * Fetch a recommendation by its ID and deserialize to the correct union member
 * @param id - The recommendation ID to look up
 * @returns The typed Recommendation or null if not found
 */
export async function getRecommendationById(id: string): Promise<Recommendation | null> {
  const rows = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.id, id))
    .limit(1);

  if (rows.length === 0) {
    return null;
  }

  return rowToRecommendation(rows[0]);
}

/**
 * Update a recommendation's status and associated timestamps in the database
 * @param rec - The recommendation with its new status and fields
 * @returns Promise that resolves when the update completes
 */
export async function updateRecommendationStatus(rec: Recommendation): Promise<void> {
  switch (rec.status) {
    case 'approved':
      await db
        .update(recommendations)
        .set({
          status: rec.status,
          approvedAt: rec.approvedAt,
        })
        .where(eq(recommendations.id, rec.id));
      break;

    case 'rejected':
      await db
        .update(recommendations)
        .set({
          status: rec.status,
          rejectedAt: rec.rejectedAt,
          rejectedReason: rec.rejectedReason ?? null,
        })
        .where(eq(recommendations.id, rec.id));
      break;

    case 'executed':
      await db
        .update(recommendations)
        .set({
          status: rec.status,
          approvedAt: rec.approvedAt,
          executedAt: rec.executedAt,
          tradeId: rec.tradeId,
        })
        .where(eq(recommendations.id, rec.id));
      break;

    case 'expired':
      await db
        .update(recommendations)
        .set({
          status: rec.status,
        })
        .where(eq(recommendations.id, rec.id));
      break;

    default:
      break;
  }
}

/**
 * Retrieve recommendation history ordered by creation time (newest first)
 * @param limit - Maximum number of recommendations to return (default 20)
 * @returns Array of typed Recommendation objects
 */
export async function getRecommendationHistory(limit: number = 20): Promise<Recommendation[]> {
  const rows = await db
    .select()
    .from(recommendations)
    .orderBy(desc(recommendations.createdAt))
    .limit(limit);

  return rows.map(rowToRecommendation);
}

/**
 * Expire all pending recommendations whose expiresAt timestamp has passed
 * @returns The number of recommendations that were expired
 */
export async function expireStaleRecommendations(): Promise<number> {
  const now = Date.now();

  const result = await db
    .update(recommendations)
    .set({ status: 'expired' })
    .where(
      and(
        eq(recommendations.status, 'pending'),
        lte(recommendations.expiresAt, now)
      )
    );

  return result.rowsAffected;
}
