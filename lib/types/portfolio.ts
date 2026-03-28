/** Portfolio item stored in the database */
export interface PortfolioItem {
  id: string;
  coinId: string;
  symbol: string;
  name: string;
  amount: number;
  buyPrice: number;
  addedAt: Date;
}

/** Input for adding a coin to the portfolio */
export interface AddPortfolioInput {
  coinId: string;
  symbol: string;
  name: string;
  amount: number;
  buyPrice: number;
}

/** Portfolio summary with calculated values */
export interface PortfolioSummary {
  items: PortfolioItem[];
  totalValue: number;
  totalCost: number;
  totalPnl: number;
  totalPnlPercent: number;
}
