# CryptoMAESTRO Platform

Crypto research & trading platform with multi-agent architecture, secured by the MAESTRO framework. Built for learning with free/testnet coins only.

## Stack

- Next.js 14+ (App Router) with TypeScript
- OpenAI API (via openai SDK) — will migrate to Anthropic SDK later
- CoinGecko API (free tier, no key) + CoinCap WebSocket
- Tailwind CSS for styling
- Supabase (when ready) for persistence

## API data sources

CoinGecko (primary, free 30 calls/min): `api.coingecko.com/api/v3`
- `/simple/price` — current price, volume, market cap (dashboard)
- `/coins/markets` — top coins ranked by market cap (dashboard)
- `/coins/{id}` — full coin detail, description, links (researcher agent)
- `/coins/{id}/market_chart` — historical price/volume (analyst agent)
- `/coins/{id}/ohlc` — candlestick data (analyst agent)
- `/search/trending` — trending coins 24h (researcher agent)
- `/global` — total market cap, BTC dominance (researcher agent)
- `/coins/{id}/tickers` — exchange pairs & volume (analyst agent)

CoinCap (real-time, free, unlimited): `api.coincap.io/v2`
- `ws://prices.coincap.io` — WebSocket live price stream (dashboard)
- `/assets` — top assets with supply data (dashboard)
- `/assets/{id}/history` — price history at intervals (analyst agent)

Rate limit strategy: Dashboard uses CoinCap WebSocket for live updates. Agents use CoinGecko on-demand. Proxy in `app/api/market/` caches responses for 60 seconds.

## Commands

- `npm run dev` — start dev server on port 3000
- `npm run build` — production build
- `npm run lint` — ESLint check
- `npm run test` — run tests
- `npm run test:single <file>` — run a single test file

## Code style

- Use ES modules (import/export), never CommonJS (require)
- Destructure imports: `import { useState } from 'react'`
- Use TypeScript strict mode; no `any` types without explicit justification
- Prefer `const` over `let`; never use `var`
- Name files in kebab-case: `market-data.ts`, not `marketData.ts`
- Name components in PascalCase: `MarketDashboard.tsx`
- All API routes go in `app/api/` using Route Handlers
- Every function must have JSDoc comments with @param and @return

## Project structure

```
cryptomaestro/
├── CLAUDE.md
├── plan.md                    # Feature development plan (used by feature-dev plugin)
├── .env                       # Secrets (NEVER commit)
├── .env.example               # Template (commit this)
├── app/
│   ├── layout.tsx
│   ├── page.tsx               # Dashboard home
│   ├── api/
│   │   ├── market/            # CoinGecko proxy endpoints
│   │   ├── agents/            # Agent orchestration endpoints
│   │   └── trades/            # Trade execution endpoints
│   ├── dashboard/             # Market overview pages
│   ├── portfolio/             # Portfolio tracking pages
│   └── agents/                # Agent management UI
├── lib/
│   ├── agents/                # Agent definitions & orchestration
│   │   ├── researcher.ts      # Market research agent
│   │   ├── analyst.ts         # Technical analysis agent
│   │   ├── advisor.ts         # Trade recommendation agent
│   │   └── executor.ts        # Trade execution agent (Level 3 only)
│   ├── api/                   # External API clients
│   │   ├── coingecko.ts       # CoinGecko client
│   │   └── coincap.ts         # CoinCap WebSocket client
│   ├── maestro/               # MAESTRO security framework
│   │   ├── validator.ts       # Input/output validation (L3)
│   │   ├── audit-logger.ts    # Audit logging (L5)
│   │   ├── rate-limiter.ts    # Rate limiting (L4)
│   │   └── guardrails.ts      # Agent guardrails (L6)
│   └── types/                 # Shared TypeScript types
├── components/                # React UI components
├── hooks/                     # Custom React hooks
└── tests/                     # Test files mirror src structure
```

## MAESTRO security rules — IMPORTANT

Every agent interaction MUST follow these rules:

- L1 (Foundation Model): Validate all prompts before sending to LLM. Never pass raw user input as system prompt.
- L2 (Data Operations): Sanitize all data from CoinGecko/CoinCap before using in agent context. Track data provenance.
- L3 (Agent Framework): Every agent has a strict tool allowlist. No agent can invoke tools outside its scope.
- L4 (Infrastructure): Rate limit all API routes. Use environment variables for all secrets.
- L5 (Observability): Log every agent action, every API call, every trade decision to audit trail.
- L6 (Security): Input/output sanitization on all agent boundaries. DLP checks on agent responses.
- L7 (Ecosystem): Agents communicate through a message bus with signed messages. No direct agent-to-agent calls.

## Three autonomy levels

- Level 1 (Manual): User views data, makes all decisions, clicks to execute.
- Level 2 (HITL): Agent analyzes and recommends. User approves/rejects before execution.
- Level 3 (Autonomous): Agent executes within guardrails — max trade size, daily loss limit, allowlisted coins, kill switch.

IMPORTANT: Default to Level 1 for all new features. Level 2 and 3 require explicit implementation with full MAESTRO controls.

## Agent architecture

Each agent is a TypeScript module in `lib/agents/` with this interface:

```typescript
interface Agent {
  name: string;
  role: string;
  maestroLayer: number[];
  allowedTools: string[];
  execute(input: AgentInput): Promise<AgentOutput>;
}
```

Agents do NOT call each other directly. All inter-agent communication goes through the orchestrator in `lib/agents/orchestrator.ts`.

## Git workflow

- Branch naming: `feature/<plan-phase>-<feature-name>` (e.g., `feature/p1-market-dashboard`)
- Commit messages: `type(scope): description` (e.g., `feat(api): add CoinGecko price endpoint`)
- Always run lint and tests before committing
- Never commit .env, node_modules, or .next/

## When compacting

Preserve: current plan phase, list of modified files, active MAESTRO controls, test status, and which autonomy level is being implemented.
