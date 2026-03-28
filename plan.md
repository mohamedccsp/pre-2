# CryptoMAESTRO Platform — Development Plan

## Overview

Crypto research & trading platform with multi-agent architecture, MAESTRO-secured, three autonomy levels.

---

## Phase 1: Foundation & Market Dashboard (Level 1 — Manual)

**Branch:** `feature/p1-foundation`
**Goal:** Working Next.js app with live crypto data. No agents yet — pure read-only dashboard.
**MAESTRO Layers Active:** L4 (rate limiting), L6 (input sanitization)

### Tasks

- [ ] P1.1: Initialize Next.js project with TypeScript, Tailwind, ESLint
- [ ] P1.2: Set up project structure per CLAUDE.md spec
- [ ] P1.3: Create CoinGecko API client in `lib/api/coingecko.ts`
  - Base URL: `https://api.coingecko.com/api/v3`
  - Rate limit: 30 calls/min (free tier)
  - GET `/simple/price?ids={ids}&vs_currencies=usd` — quick price lookup
  - GET `/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20` — top coins for dashboard
  - GET `/coins/{id}` — full coin detail, description, links, community data
  - GET `/coins/{id}/market_chart?vs_currency=usd&days={days}` — historical price/volume/market cap
  - GET `/coins/{id}/ohlc?vs_currency=usd&days={days}` — candlestick data for charts
  - GET `/search/trending` — trending coins in last 24h
  - GET `/global` — total market cap, BTC dominance, active coins count
  - GET `/coins/{id}/tickers` — exchange trading pairs and volume
  - Add 60-second response cache to avoid hitting rate limits
  - Add retry logic with exponential backoff on 429 errors
- [ ] P1.4: Create CoinCap WebSocket client in `lib/api/coincap.ts`
  - WebSocket: `wss://ws.coincap.io/prices?assets={comma-separated-ids}`
  - REST GET `https://api.coincap.io/v2/assets` — top assets with supply data
  - REST GET `https://api.coincap.io/v2/assets/{id}/history?interval=h1` — hourly price history
  - Auto-reconnect on WebSocket disconnect
  - Map CoinCap asset IDs to CoinGecko IDs for consistency
- [ ] P1.5: Build API proxy routes in `app/api/market/`
  - Rate limiting middleware (MAESTRO L4)
  - Input validation on query params (MAESTRO L6)
- [ ] P1.6: Build Dashboard page — top 20 coins, price, 24h change, market cap
- [ ] P1.7: Build Coin Detail page — price chart, volume, description
- [ ] P1.8: Build Portfolio page — manual add/remove coins, track value
- [ ] P1.9: Add loading states, error handling, responsive design
- [ ] P1.10: Write tests for API client and proxy routes

### Acceptance Criteria

- Dashboard shows live prices from CoinGecko
- CoinCap WebSocket updates prices in real-time
- All API routes have rate limiting and input validation
- No secrets exposed in frontend code
- All tests pass

### Dependencies

- None (starting from scratch)

---

## Phase 2: Agent Foundation (Level 1 — Manual + Agent Research)

**Branch:** `feature/p2-agent-foundation`
**Goal:** First agent (Researcher) that fetches and summarizes market data. Output is read-only — user sees results but agent takes no actions.
**MAESTRO Layers Active:** L1, L3, L4, L5, L6

### Tasks

- [ ] P2.1: Define Agent interface and types in `lib/types/agent.ts`
- [ ] P2.2: Create MAESTRO validator in `lib/maestro/validator.ts`
  - Input sanitization before LLM calls
  - Output validation after LLM responses
  - Prompt injection detection
- [ ] P2.3: Create audit logger in `lib/maestro/audit-logger.ts`
  - Log agent name, action, input hash, output hash, timestamp
  - Store in local JSON files (upgrade to DB in Phase 5)
- [ ] P2.4: Build Researcher agent in `lib/agents/researcher.ts`
  - Takes a coin ID or market query
  - Fetches data from CoinGecko
  - Sends to LLM with structured prompt for analysis
  - Returns formatted market research summary
  - Allowed tools: coingecko_read, coincap_read
- [ ] P2.5: Create orchestrator in `lib/agents/orchestrator.ts`
  - Single entry point for all agent calls
  - Routes requests to correct agent
  - Enforces MAESTRO controls before/after each call
- [ ] P2.6: Build API route `app/api/agents/research/`
  - POST endpoint with coin ID or query
  - Returns agent research summary
- [ ] P2.7: Build Agent Research UI in `app/agents/`
  - Input form for research queries
  - Display agent response with sources
  - Show audit trail of agent actions
- [ ] P2.8: Write tests for agent, validator, orchestrator

### Acceptance Criteria

- Researcher agent produces coherent market summaries
- All LLM inputs pass through MAESTRO validator
- Every agent action is logged with full audit trail
- Agent has no capability to modify data or execute trades
- Tests cover agent flow, validation, and error cases

### Dependencies

- Phase 1 complete (CoinGecko client, API routes)

---

## Phase 3: Analyst Agent & Recommendations (Level 2 — HITL)

**Branch:** `feature/p3-analyst-hitl`
**Goal:** Analyst agent that generates buy/sell/hold recommendations. User must approve before any simulated trade.
**MAESTRO Layers Active:** L1, L2, L3, L4, L5, L6

### Tasks

- [ ] P3.1: Build Analyst agent in `lib/agents/analyst.ts`
  - Receives research data from Researcher
  - Performs technical analysis (price trends, volume, RSI concept)
  - Generates buy/sell/hold recommendation with confidence score
  - Allowed tools: coingecko_read, research_read
- [ ] P3.2: Build Advisor agent in `lib/agents/advisor.ts`
  - Takes Analyst recommendation + portfolio context
  - Provides actionable advice with risk assessment
  - Outputs: action, coin, amount, reasoning, risk_level
  - Allowed tools: analyst_read, portfolio_read
- [ ] P3.3: Create approval workflow in `lib/maestro/guardrails.ts`
  - Recommendations require user approval before execution
  - Show full reasoning and risk before approval button
  - Timeout after 5 minutes — auto-reject
- [ ] P3.4: Create message bus in `lib/agents/message-bus.ts`
  - Agents communicate through typed messages
  - Each message is signed with agent ID (MAESTRO L7)
  - Message validation before delivery
- [ ] P3.5: Build HITL UI in `app/agents/recommendations/`
  - Show recommendation with full reasoning
  - Approve / Reject buttons
  - History of past recommendations and outcomes
- [ ] P3.6: Implement simulated trade execution
  - Virtual portfolio with fake balance (no real money)
  - Record buy/sell as simulated trades
  - Track P&L on simulated portfolio
- [ ] P3.7: Write tests for analyst, advisor, approval flow

### Acceptance Criteria

- Agent chain: Researcher → Analyst → Advisor produces recommendations
- Every recommendation requires explicit user approval
- Simulated trades update virtual portfolio
- Full audit trail of recommendation → approval → execution
- No real API calls to any exchange
- Tests cover the full HITL flow

### Dependencies

- Phase 2 complete (Researcher agent, orchestrator, MAESTRO validator)

---

## Phase 4: Autonomous Trading (Level 3 — Guardrailed)

**Branch:** `feature/p4-autonomous`
**Goal:** Agent can execute simulated trades autonomously within strict guardrails. Learning mode only.
**MAESTRO Layers Active:** All 7 layers

### Tasks

- [ ] P4.1: Build Executor agent in `lib/agents/executor.ts`
  - Receives approved recommendations (auto or manual)
  - Executes simulated trades against virtual portfolio
  - Allowed tools: portfolio_write, trade_simulate
  - HARD LIMITS: max trade 10% of portfolio, max 5 trades/day
- [ ] P4.2: Implement guardrails in `lib/maestro/guardrails.ts`
  - Max trade size (configurable, default 10% of virtual balance)
  - Daily loss limit (stop if virtual portfolio drops 15%)
  - Allowlisted coins only (top 20 by market cap)
  - Cooldown between trades (minimum 30 minutes)
  - Kill switch — user can disable autonomous mode instantly
- [ ] P4.3: Implement agent ecosystem controls (MAESTRO L7)
  - Agent identity verification on every message
  - Prevent agent collusion (no circular recommendation chains)
  - Rate limit agent-to-agent communication
- [ ] P4.4: Build autonomy settings UI
  - Toggle between Level 1 / Level 2 / Level 3
  - Configure guardrail parameters
  - Kill switch button (prominent, always visible)
  - Real-time agent activity monitor
- [ ] P4.5: Build monitoring dashboard
  - Live agent actions feed
  - Virtual P&L tracking
  - Guardrail trigger log (every time a limit is hit)
  - Alert system for anomalies
- [ ] P4.6: Comprehensive testing
  - Unit tests for all guardrails
  - Integration tests for full autonomous flow
  - Edge case tests: what happens when limits are hit
  - Chaos tests: malformed data, API failures, timeout

### Acceptance Criteria

- Autonomous mode executes simulated trades within all guardrails
- Kill switch stops all autonomous activity within 1 second
- Every guardrail trigger is logged and visible in monitoring
- All 7 MAESTRO layers are active and enforced
- Zero real money involved at any point
- Full test coverage on guardrails and edge cases

### Dependencies

- Phase 3 complete (full agent chain, HITL workflow, simulated trading)

---

## Phase 5: Polish & Scale (Post-MVP)

**Branch:** `feature/p5-polish`
**Goal:** Production readiness — database, auth, deployment.

### Tasks

- [ ] P5.1: Add Supabase for persistent storage (replace JSON files)
- [ ] P5.2: Add authentication (NextAuth or Supabase Auth)
- [ ] P5.3: Migrate from OpenAI to Anthropic SDK
- [ ] P5.4: Add more data sources (CoinMarketCap, CryptoCompare)
- [ ] P5.5: Deploy to Vercel
- [ ] P5.6: Performance optimization and caching
- [ ] P5.7: Write MAESTRO security review document

### Dependencies

- Phase 4 complete

---

## How to use this plan with feature-dev plugin

In Claude Code, start a feature by referencing the phase:

```
Implement P1.1 from plan.md
```

Or start an entire phase:

```
Start Phase 1 from plan.md
```

The feature-dev plugin will read this file, create the appropriate branch, and work through tasks sequentially.
