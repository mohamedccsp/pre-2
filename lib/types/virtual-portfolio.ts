/** Virtual portfolio state — single-user, starts at $1,000 */
export interface VirtualPortfolio {
  readonly id: string;
  readonly balanceUsd: number;
  readonly initialBalanceUsd: number;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Derived coin holding from aggregated trades */
export interface VirtualHolding {
  readonly coinId: string;
  readonly coinSymbol: string;
  readonly amount: number;
  readonly averageBuyPrice: number;
  readonly currentPrice?: number;
  readonly currentValue?: number;
  readonly unrealizedPnl?: number;
}

/** Single executed virtual trade */
export interface VirtualTrade {
  readonly id: string;
  readonly recommendationId: string;
  readonly coinId: string;
  readonly coinSymbol: string;
  readonly action: 'buy' | 'sell';
  readonly amountUsd: number;
  readonly priceAtExecution: number;
  readonly unitsTraded: number;
  readonly balanceBefore: number;
  readonly balanceAfter: number;
  readonly executedAt: number;
  readonly auditId: string;
}

/** Full portfolio snapshot with calculated values */
export interface VirtualPortfolioSnapshot {
  readonly portfolio: VirtualPortfolio;
  readonly holdings: VirtualHolding[];
  readonly trades: VirtualTrade[];
  readonly totalValue: number;
  readonly totalPnl: number;
  readonly totalPnlPercent: number;
}
