import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

/** Portfolio items table — tracks coins the user has added */
export const portfolioItems = sqliteTable('portfolio_items', {
  id: text('id').primaryKey(),
  coinId: text('coin_id').notNull(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  buyPrice: real('buy_price').notNull(),
  addedAt: integer('added_at', { mode: 'timestamp' }).notNull(),
});

/** Agent-generated trade recommendations awaiting user approval */
export const recommendations = sqliteTable('recommendations', {
  id: text('id').primaryKey(),
  coinId: text('coin_id').notNull(),
  coinSymbol: text('coin_symbol').notNull(),
  coinName: text('coin_name').notNull(),
  action: text('action').notNull(),
  status: text('status').notNull().default('pending'),
  confidence: real('confidence').notNull(),
  riskLevel: text('risk_level').notNull(),
  reasoning: text('reasoning').notNull(),
  researchSummary: text('research_summary').notNull(),
  analysisSummary: text('analysis_summary').notNull(),
  indicatorsJson: text('indicators_json').notNull(),
  suggestedAmountUsd: real('suggested_amount_usd').notNull(),
  currentPrice: real('current_price').notNull(),
  auditId: text('audit_id').notNull(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  approvedAt: integer('approved_at'),
  rejectedAt: integer('rejected_at'),
  rejectedReason: text('rejected_reason'),
  executedAt: integer('executed_at'),
  tradeId: text('trade_id'),
});

/** Virtual portfolio — single row, $1,000 starting balance */
export const virtualPortfolio = sqliteTable('virtual_portfolio', {
  id: text('id').primaryKey(),
  balanceUsd: real('balance_usd').notNull().default(1000),
  initialBalanceUsd: real('initial_balance_usd').notNull().default(1000),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** Virtual trades executed against the virtual portfolio */
export const virtualTrades = sqliteTable('virtual_trades', {
  id: text('id').primaryKey(),
  recommendationId: text('recommendation_id').notNull(),
  coinId: text('coin_id').notNull(),
  coinSymbol: text('coin_symbol').notNull(),
  action: text('action').notNull(),
  amountUsd: real('amount_usd').notNull(),
  priceAtExecution: real('price_at_execution').notNull(),
  unitsTraded: real('units_traded').notNull(),
  balanceBefore: real('balance_before').notNull(),
  balanceAfter: real('balance_after').notNull(),
  executedAt: integer('executed_at').notNull(),
  auditId: text('audit_id').notNull(),
});
