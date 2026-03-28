import type {
  PendingRecommendation,
  ApprovedRecommendation,
  RejectedRecommendation,
  ExecutedRecommendation,
  ExpiredRecommendation,
} from '@/lib/types/recommendation';

/**
 * Check if a pending recommendation has expired
 * @param rec - Pending recommendation to check
 * @returns True if the recommendation's expiry time has passed
 */
export function isExpired(rec: PendingRecommendation): boolean {
  return rec.expiresAt <= Date.now();
}

/**
 * Transition a pending recommendation to approved
 * @param rec - Pending recommendation to approve
 * @returns Approved recommendation with timestamp
 */
export function approvePending(rec: PendingRecommendation): ApprovedRecommendation {
  return { ...rec, status: 'approved', approvedAt: Date.now() };
}

/**
 * Transition a pending recommendation to rejected
 * @param rec - Pending recommendation to reject
 * @param reason - Optional rejection reason
 * @returns Rejected recommendation with timestamp
 */
export function rejectPending(
  rec: PendingRecommendation,
  reason?: string
): RejectedRecommendation {
  return {
    ...rec,
    status: 'rejected',
    rejectedAt: Date.now(),
    ...(reason ? { rejectedReason: reason } : {}),
  };
}

/**
 * Transition a pending recommendation to expired
 * @param rec - Pending recommendation to expire
 * @returns Expired recommendation with timestamp
 */
export function expirePending(rec: PendingRecommendation): ExpiredRecommendation {
  return { ...rec, status: 'expired', expiredAt: Date.now() };
}

/**
 * Transition an approved recommendation to executed
 * @param rec - Approved recommendation to mark as executed
 * @param tradeId - ID of the executed trade
 * @returns Executed recommendation with trade reference
 */
export function markExecuted(
  rec: ApprovedRecommendation,
  tradeId: string
): ExecutedRecommendation {
  return { ...rec, status: 'executed', executedAt: Date.now(), tradeId };
}
