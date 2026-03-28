# CryptoMAESTRO — Future Improvements

Items deferred from Phase 5 for future implementation.

---

## 1. Supabase Migration (P5.1)

**Current State:** SQLite via libsql + Drizzle ORM, stored locally at `data/cryptomaestro.db`.

**Why Migrate:**
- Multi-user support with row-level security (RLS)
- Cloud-hosted database accessible from deployed environments
- Real-time subscriptions for live portfolio updates
- Built-in auth integration with Supabase Auth

**Migration Path:**
1. Switch Drizzle dialect from `sqlite` to `pg` in `drizzle.config.ts`
2. Update `lib/db/index.ts` to use `drizzle-orm/postgres-js` with Supabase connection string
3. Convert `integer` timestamp columns to `timestamp` type
4. Convert `integer(..., { mode: 'boolean' })` to native `boolean`
5. Add RLS policies for per-user data isolation on `recommendations`, `virtual_trades`, `virtual_portfolio`, `autonomous_config`, `autonomous_cycles`
6. Run `drizzle-kit push` against Supabase
7. Update all repository files to use the new schema types

**Estimated Effort:** 1–2 days (schema conversion + testing)

---

## 2. Anthropic SDK Migration (P5.3)

**Current State:** All agents use OpenAI `gpt-4o-mini` via the `openai` npm package.

**Why Migrate:**
- Claude models offer stronger reasoning for complex analysis tasks
- Native tool use / function calling support
- Better structured output handling
- Alignment with the Anthropic ecosystem

**Migration Path:**
1. Install `@anthropic-ai/sdk`
2. Replace lazy `getOpenAI()` pattern with lazy `getAnthropic()` in each agent
3. Convert `chat.completions.create()` calls to `messages.create()` format
4. Update system prompts (Anthropic uses a `system` parameter, not a system message)
5. Update response parsing — `content[0].text` instead of `choices[0].message.content`
6. Update `.env` to use `ANTHROPIC_API_KEY` instead of `OPENAI_API_KEY`
7. Test all agents with Claude Haiku (fast/cheap) and Claude Sonnet (higher quality)

**Files to Modify:**
- `lib/agents/researcher.ts`
- `lib/agents/analyst.ts`
- `lib/agents/advisor.ts`

**Estimated Effort:** 0.5–1 day

---

## 3. Additional Data Sources (P5.4)

**Current State:** CoinGecko (primary, 30 calls/min free) + CoinCap WebSocket (real-time, unlimited).

**Candidates:**

### CoinMarketCap
- Free tier: 333 calls/day, 10,000/month
- Endpoints: `/cryptocurrency/listings/latest`, `/cryptocurrency/quotes/latest`
- Value: More granular supply data, CMC rank, platform metadata
- API key required: Yes (free at [coinmarketcap.com/api](https://coinmarketcap.com/api))

### CryptoCompare
- Free tier: 100,000 calls/month
- Endpoints: `/data/pricemultifull`, `/data/v2/histohour`, `/data/top/mktcapfull`
- Value: Social stats, exchange-level OHLCV, mining data
- API key required: Yes (free at [cryptocompare.com/cryptopian/api-keys](https://www.cryptocompare.com/cryptopian/api-keys))

### Messari
- Free tier: Limited
- Value: Fundamental metrics, on-chain data, sector classification
- Good for enriching researcher agent context

**Integration Pattern:**
1. Create client in `lib/api/<source>.ts` following CoinGecko client pattern
2. Add to researcher agent's allowed tools
3. Add data source toggle in agent config
4. Implement fallback chain: CoinGecko → CoinMarketCap → CryptoCompare

**Estimated Effort:** 1–2 days per source

---

## 4. Vercel Deployment (P5.5)

**Current State:** Runs locally on `http://localhost:3000`.

**Prerequisites:**
- Authentication (P5.2) must be complete
- Environment variables configured in Vercel dashboard
- SQLite must be replaced with a cloud database (Supabase, Turso, or PlanetScale) since Vercel's serverless functions don't persist local files

**Deployment Steps:**
1. Create Vercel project linked to the Git repository
2. Set environment variables: `OPENAI_API_KEY`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AGENT_SECRET_KEY`
3. Replace local SQLite with Turso (libsql-compatible cloud) or Supabase (Postgres)
4. Migrate audit logger from local NDJSON files to database table
5. Configure `next.config.js` for serverless-compatible settings
6. Set up preview deployments for branches
7. Add custom domain (optional)

**Critical Blocker:** The audit logger writes to local filesystem (`data/audit/*.ndjson`). This must be migrated to a database table before deploying to a serverless environment where filesystem writes are ephemeral.

**Estimated Effort:** 1–2 days (including database migration)

---

## 5. Additional Future Enhancements

### Real Exchange Integration (Testnet)
- Connect to Binance Testnet or Coinbase Sandbox for realistic paper trading
- Use real order book data for execution simulation
- Implement slippage modeling

### Advanced Technical Analysis
- Add Bollinger Bands, MACD, Fibonacci retracements to analyst agent
- Implement multi-timeframe analysis (1h, 4h, 1d, 1w)
- On-chain metrics integration (whale tracking, exchange flows)

### Multi-User Portfolios
- Leaderboard comparing virtual portfolio performance
- Shared recommendations with social features
- Portfolio strategy templates

### Agent Improvements
- Agent memory — remember past analyses and outcomes for learning
- Sentiment analysis agent — social media, news, fear & greed index
- Risk management agent — portfolio rebalancing suggestions
- Backtesting agent — test strategies against historical data

### Observability
- Grafana dashboard for agent performance metrics
- Alert system for guardrail triggers via email/Slack
- Cost tracking for LLM API usage per agent
