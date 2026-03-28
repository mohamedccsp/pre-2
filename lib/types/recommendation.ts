import type { TradeAction, RiskLevel, TechnicalSnapshot } from './analysis';

/** Core fields shared by all recommendation states */
export interface RecommendationCore {
  readonly id: string;
  readonly coinId: string;
  readonly coinSymbol: string;
  readonly coinName: string;
  readonly action: TradeAction;
  readonly confidence: number;
  readonly riskLevel: RiskLevel;
  readonly reasoning: string;
  readonly researchSummary: string;
  readonly analysisSummary: string;
  readonly indicators: TechnicalSnapshot;
  readonly suggestedAmountUsd: number;
  readonly currentPrice: number;
  readonly auditId: string;
  readonly createdAt: number;
  readonly expiresAt: number;
}

/** Recommendation awaiting user decision */
export type PendingRecommendation = RecommendationCore & {
  readonly status: 'pending';
};

/** User approved the recommendation */
export type ApprovedRecommendation = RecommendationCore & {
  readonly status: 'approved';
  readonly approvedAt: number;
};

/** User rejected the recommendation */
export type RejectedRecommendation = RecommendationCore & {
  readonly status: 'rejected';
  readonly rejectedAt: number;
  readonly rejectedReason?: string;
};

/** Approved recommendation that has been executed as a trade */
export type ExecutedRecommendation = RecommendationCore & {
  readonly status: 'executed';
  readonly approvedAt: number;
  readonly executedAt: number;
  readonly tradeId: string;
};

/** Recommendation that expired without user action */
export type ExpiredRecommendation = RecommendationCore & {
  readonly status: 'expired';
  readonly expiredAt: number;
};

/** Discriminated union of all recommendation states */
export type Recommendation =
  | PendingRecommendation
  | ApprovedRecommendation
  | RejectedRecommendation
  | ExecutedRecommendation
  | ExpiredRecommendation;

/** All possible recommendation statuses */
export type RecommendationStatus = Recommendation['status'];
