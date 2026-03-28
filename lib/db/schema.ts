import { sqliteTable, text, real, integer, index } from 'drizzle-orm/sqlite-core';

/** Registered users with hashed passwords */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  hashedPassword: text('hashed_password').notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at').notNull(),
});

/** Portfolio items table — tracks coins the user has added */
export const portfolioItems = sqliteTable('portfolio_items', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default('default'),
  coinId: text('coin_id').notNull(),
  symbol: text('symbol').notNull(),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  buyPrice: real('buy_price').notNull(),
  addedAt: integer('added_at', { mode: 'timestamp' }).notNull(),
}, (table) => [
  index('idx_portfolio_items_user').on(table.userId),
]);

/** Agent-generated trade recommendations awaiting user approval */
export const recommendations = sqliteTable('recommendations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default('default'),
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
}, (table) => [
  index('idx_recommendations_user').on(table.userId),
  index('idx_recommendations_status').on(table.status),
  index('idx_recommendations_created').on(table.createdAt),
  index('idx_recommendations_coin').on(table.coinId),
]);

/** Virtual portfolio — single row, $1,000 starting balance */
export const virtualPortfolio = sqliteTable('virtual_portfolio', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default('default'),
  balanceUsd: real('balance_usd').notNull().default(1000),
  initialBalanceUsd: real('initial_balance_usd').notNull().default(1000),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => [
  index('idx_virtual_portfolio_user').on(table.userId),
]);

/** Virtual trades executed against the virtual portfolio */
export const virtualTrades = sqliteTable('virtual_trades', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default('default'),
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
}, (table) => [
  index('idx_virtual_trades_user').on(table.userId),
  index('idx_virtual_trades_executed').on(table.executedAt),
  index('idx_virtual_trades_coin').on(table.coinId),
]);

/** Persisted autonomous trading configuration — single row, id = 'default' */
export const autonomousConfig = sqliteTable('autonomous_config', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default('default'),
  killSwitchActive: integer('kill_switch_active', { mode: 'boolean' }).notNull().default(false),
  maxTradePct: real('max_trade_pct').notNull().default(0.10),
  maxTradesPerDay: integer('max_trades_per_day').notNull().default(5),
  cooldownMinutes: integer('cooldown_minutes').notNull().default(30),
  dailyLossLimitPct: real('daily_loss_limit_pct').notNull().default(0.15),
  updatedAt: integer('updated_at').notNull(),
});

/** One row per autonomous cycle run — full audit record */
export const autonomousCycles = sqliteTable('autonomous_cycles', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().default('default'),
  startedAt: integer('started_at').notNull(),
  completedAt: integer('completed_at'),
  coinsAnalyzed: integer('coins_analyzed').notNull().default(0),
  tradesExecuted: integer('trades_executed').notNull().default(0),
  tradesSkipped: integer('trades_skipped').notNull().default(0),
  totalAmountUsd: real('total_amount_usd').notNull().default(0),
  killSwitchTripped: integer('kill_switch_tripped', { mode: 'boolean' }).notNull().default(false),
  dailyLossTripped: integer('daily_loss_tripped', { mode: 'boolean' }).notNull().default(false),
  summaryJson: text('summary_json').notNull().default('[]'),
  error: text('error'),
}, (table) => [
  index('idx_autonomous_cycles_user').on(table.userId),
  index('idx_autonomous_cycles_started').on(table.startedAt),
]);
