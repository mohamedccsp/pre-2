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
