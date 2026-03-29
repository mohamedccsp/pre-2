# Agents Logic Review (CryptoMAESTRO)

## Purpose

This document explains, in detail, how each agent works today, how decisions are made, what the LLM is responsible for vs what deterministic code enforces, and what the model is asked at each stage.

Primary goal: help you choose the best model per agent, instead of one model for all.

---

## System Overview

Current chain uses three LLM agents plus one deterministic executor:

- `researcher` (`lib/agents/researcher.ts`)
  - Fetches market context and produces market analysis text.
- `analyst` (`lib/agents/analyst.ts`)
  - Turns indicators + context into structured action/confidence.
- `advisor` (`lib/agents/advisor.ts`)
  - Turns analyst output into risk and position size.
- `executor` (`lib/virtual-portfolio/executor.ts`)
  - Executes approved/autonomous trades (no LLM call).

Today, all LLM agents use the same model string in code: `gpt-4o-mini`.

---

## End-to-End Decision Pipeline

### 1) API entrypoint

- `POST /api/agents/analyze` in `app/api/agents/analyze/route.ts`
- Validates input (`coinId`), enforces rate limit, calls `executeAnalysisChain`.
- Persists resulting recommendation.

### 2) Chain orchestration

`lib/agents/chain.ts` runs:

1. `executeAgent('researcher', ...)`
2. Fetch CoinGecko data and compute indicators
3. Route researcher -> analyst with signed envelope
4. `executeAgent('analyst', ...)`
5. Parse analyst JSON
6. Route analyst -> advisor with signed envelope
7. `executeAgent('advisor', ...)`
8. Parse advisor JSON and convert percent to USD
9. Build `PendingRecommendation`

### 3) Guardrails and execution

Autonomous cycle (`lib/autonomous/cycle.ts`) applies hard checks before execution:

- kill switch
- daily trade limit
- daily loss limit
- per-coin cooldown
- allowlist check
- recommendation expiry
- trade-size limit

It also skips all `hold` recommendations.

Important: LLMs propose; deterministic guardrails decide what is allowed.

---

## MAESTRO Controls in the Agent Path

### L1 (prompt/input security)

- `orchestrator.executeAgent()` runs `checkPromptInjection(input.query)` before agent execution.
- If blocked, execution is aborted and audit is logged.

### L3 (agent framework control)

- Agent registry in `lib/agents/orchestrator.ts`.
- Unknown agent names fail fast.
- Tool allowlists are declared on each agent object.

### L5 (audit and observability)

- Every agent execution success/failure is logged.
- Inter-agent routing events are logged.

### L6 (output sanitization)

- LLM output is sanitized via `sanitizeAgentOutput` before returning.

### L7 (signed inter-agent communication)

- `routeMessage` signs payload hash with HMAC-based identity token.
- `executeAgent` verifies token before processing routed payload.

---

## Agent 1: Researcher

File: `lib/agents/researcher.ts`

### Role

Converts user query + market context into concise market research text. This agent does not directly produce trade action.

### Deterministic logic before the LLM

1. `classifyQuery(query)`:
   - Detects query type: `coin`, `comparison`, or `market`.
   - Uses ticker/full-name alias mapping (`COIN_LOOKUP`), for example BTC -> bitcoin.
2. `fetchContext(classified)`:
   - `coin`: `getCoinDetail`.
   - `comparison`: multiple `getCoinDetail` calls.
   - `market`: `getGlobal`, `getTrending`, `getCoinsMarkets`.
3. Formats numeric context (price, change, market cap, volume, etc.) into prompt-ready text.

### What the model is asked

System prompt (intent):

- You are a crypto market research analyst.
- Provide concise data-driven analysis (2-3 short paragraphs).
- Reference specific numbers from provided data.
- Stay objective (bullish and bearish perspectives).
- Do not give financial advice or buy/sell recommendations.

User prompt (shape):

- `Research query: <query>`
- `Market data: <formatted context block>`

### LLM responsibility

- Synthesize context into readable, grounded analysis text.
- No structured trading decision required here.

### Post-LLM processing

- Sanitization: `sanitizeAgentOutput(rawResult)`.
- Output includes `sources`, `queryType`, and `coinIds`.

### Model quality sensitivity

Most sensitive to:

- summarization quality
- grounding in numbers
- low hallucination tendency

Less sensitive to strict JSON schema reliability.

---

## Agent 2: Analyst

File: `lib/agents/analyst.ts`

### Role

Converts technical data + research context into structured signal:

- `action`: `buy | sell | hold`
- `confidence`: `0-100`
- `reasoning`: short explanation

### Deterministic logic before the LLM

1. Indicator computation:
   - `computeRSI`
   - `computeSMA`
   - plus trend/volume fields from chain context
2. `formatIndicators` generates readable technical snapshot.
3. User prompt combines:
   - coin
   - technical indicators
   - research context

### What the model is asked

System prompt (current behavior):

- interpret indicators and provide signal
- consider RSI/SMA/volume/momentum
- output strict JSON:
  - `{ "action": "buy"|"sell"|"hold", "confidence": 0-100, "reasoning": "..." }`
- currently includes conservative instruction:
  - "default to hold when signals are mixed"

User prompt (shape):

- coin id
- technical indicators block
- research context block

### LLM responsibility

This is the first major decision point:

- direction (`buy`/`sell`/`hold`)
- confidence scoring
- concise rationale

### Post-LLM parsing and safeguards

`parseAnalysisResponse`:

- strips markdown code fences
- parses JSON
- clamps confidence to `[0, 100]`
- invalid action -> defaults to `hold`
- invalid JSON -> fallback `{ hold, 0, "Analysis inconclusive" }`

### Model quality sensitivity

Most sensitive to:

- multi-signal reasoning consistency
- confidence calibration
- stable JSON schema adherence

If model quality is weak, this agent can become over-conservative (too many `hold`) or unstable.

---

## Agent 3: Advisor

File: `lib/agents/advisor.ts`

### Role

Converts analyst output into risk + size recommendation:

- `riskLevel`: `low | medium | high`
- `suggestedPercentOfBalance`: `0.0-0.2`
- `reasoning`

### Deterministic logic before the LLM

Input context includes:

- analyst action/confidence/reasoning
- indicators
- research summary
- current price
- virtual balance
- max allocation cap information (20%)

### What the model is asked

System prompt (current behavior):

- assess risk and suggest position size
- output strict JSON:
  - `{ "riskLevel": "...", "reasoning": "...", "suggestedPercentOfBalance": 0.0-0.2 }`
- currently includes hard rule:
  - if action is `hold` or confidence `< 40`, suggest `0`
- also includes conservative framing

User prompt (shape):

- coin identity and market context
- analyst output
- account balance and cap info

### LLM responsibility

- classify risk
- select size percentage under cap
- explain risk/size rationale

### Post-LLM parsing and safeguards

`parseAdvisorResponse(raw, virtualBalance)`:

- strips markdown code fences
- parses JSON
- invalid risk level -> defaults to `high`
- clamps size percent to `[0, 0.2]`
- computes `suggestedAmountUsd = percent * virtualBalance`
- invalid JSON -> fallback high risk, 0 amount

### Model quality sensitivity

Most sensitive to:

- policy-following and numeric discipline
- deterministic schema output
- coherent risk-to-size mapping

---

## Executor (Non-LLM but decision-critical)

File: `lib/virtual-portfolio/executor.ts`

### Role

Executes approved/autonomous recommendations safely.

### Deterministic flow

- approve recommendation state
- fetch live price with fallback
- clamp amount by `maxTradePct`
- insert trade record
- update portfolio balance
- mark recommendation executed
- write audit entry

### Why this matters for model selection

Even with stronger LLM models, hard portfolio controls remain deterministic and authoritative.

---

## Current Prompt Inputs and Outputs by Stage

### Researcher

- Input to model:
  - natural-language query
  - structured market data text
- Output from model:
  - free-form analysis text

### Analyst

- Input to model:
  - computed indicators
  - research text
- Output from model:
  - strict JSON (`action`, `confidence`, `reasoning`)

### Advisor

- Input to model:
  - analyst output
  - indicators + research
  - price + balance
- Output from model:
  - strict JSON (`riskLevel`, `reasoning`, `suggestedPercentOfBalance`)

---

## Where Decisions Are Actually Made

### LLM-driven decisions

- research narrative quality
- trade direction and confidence
- risk and suggested size

### Deterministic decisions

- input validation and injection blocking
- message identity verification
- output sanitization
- schema parsing and fallback defaults
- trade eligibility and hard guardrails
- actual trade execution mechanics

---

## Practical Guidance for Per-Agent Model Selection

### Researcher (narrative synthesis)

Prefer model traits:

- strong summarization
- number-grounded explanation
- low hallucination

Typical temperature range:

- `0.2-0.4`

### Analyst (reasoning heavy)

Prefer model traits:

- strong cross-signal reasoning
- robust structured output
- stable confidence behavior

Typical temperature range:

- `0.3-0.45`

### Advisor (policy and sizing discipline)

Prefer model traits:

- strict instruction following
- consistent numeric output
- high JSON reliability

Typical temperature range:

- `0.2-0.35`

### Executor

No LLM required.

---

## Known Decision Bottlenecks in Current Logic

1. Analyst prompt includes conservative default-to-hold language.
2. Advisor prompt hard-zeros all confidence below 40.
3. Same model is used for three different cognitive workloads.
4. Invalid JSON fallback path is intentionally conservative (safe, but reduces activity).

---

## Core Reference Files

- Agent logic:
  - `lib/agents/researcher.ts`
  - `lib/agents/analyst.ts`
  - `lib/agents/advisor.ts`
- Orchestration and security:
  - `lib/agents/chain.ts`
  - `lib/agents/orchestrator.ts`
  - `lib/agents/message-bus.ts`
  - `lib/maestro/validator.ts`
  - `lib/maestro/guardrails.ts`
- Lifecycle and execution:
  - `lib/virtual-portfolio/executor.ts`
  - `lib/autonomous/cycle.ts`
  - `lib/recommendations/lifecycle.ts`
  - `lib/types/recommendation.ts`
- API:
  - `app/api/agents/analyze/route.ts`
  - `app/api/agents/research/route.ts`
  - `app/api/agents/autonomous/cycle/route.ts`
