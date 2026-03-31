# AGENTS Persona Guide

## Purpose

This guide defines each agent's function, rules, communication path, KPIs, and algorithms in the CryptoMAESTRO platform.

---

## Shared Multi-Agent Rules

- All agent execution must go through `lib/agents/orchestrator.ts`.
- Agents never call each other directly.
- All handoffs must go through `lib/agents/message-bus.ts`.
- Prompt injection checks run before execution (MAESTRO L1).
- Output sanitization runs before results return (MAESTRO L6).
- Every execution and message route is audited (MAESTRO L5).
- Routed payloads require identity signing/verification (MAESTRO L7).

---

## Researcher Agent

### Function

- Converts user research intent into market context and summary.
- Classifies query type: `coin`, `comparison`, `market`.
- Fetches contextual data from market APIs and produces a concise analysis.

### Rules

- Must be objective and data-grounded.
- Must include bullish and bearish context where relevant.
- Must not recommend direct buy/sell execution.
- Must avoid unsupported claims outside provided data.

### Communication

- Input: user query from orchestrator.
- Output: research summary to analyst through message bus.
- Typical message type in chain: `research_complete`.

### KPIs

- Query classification quality.
- Execution success rate.
- Latency p50/p95.
- Numeric grounding score (mentions concrete data points).
- Hallucination/error rate.
- Downstream usefulness (analyst confidence stability).

### Algorithms Used

- Deterministic:
  - query classification via alias map.
  - data retrieval from CoinGecko endpoints.
  - structured context formatting.
- LLM:
  - synthesis and explanation of market context.

---

## Analyst Agent

### Function

- Converts indicators + research context into structured signal JSON:
  - `action`: `buy|sell|hold`
  - `confidence`: `0-100`
  - `reasoning`

### Rules

- Must return strict JSON schema.
- Must align action with technical evidence.
- Must keep reasoning concise and signal-focused.
- Must avoid unsupported directional claims.

### Communication

- Input: routed payload from researcher + computed indicators.
- Output: analysis payload to advisor through message bus.
- Typical message type in chain: `analysis_complete`.

### KPIs

- JSON validity rate.
- Action mix (`buy/sell/hold`) and hold-rate control.
- Confidence calibration by bucket.
- Decision flip-rate (stability).
- Outcome quality by confidence band.
- Latency p50/p95.

### Algorithms Used

- Deterministic:
  - RSI (`computeRSI`) using Wilder smoothing.
  - SMA (`computeSMA`) for trend context.
  - parser validation, clamping, fallback on invalid output.
- LLM:
  - multi-signal reasoning.
  - confidence scoring.
  - concise rationale generation.

---

## Advisor Agent

### Function

- Converts analyst signal into risk + position size guidance:
  - `riskLevel`: `low|medium|high`
  - `suggestedPercentOfBalance`: `0.0-0.2`
  - `reasoning`

### Rules

- Must return strict JSON schema.
- Must keep suggested size within platform cap.
- Must map confidence and risk to coherent sizing.
- Must not return negative/invalid sizing.

### Communication

- Input: analyst output + indicators + research + balance context.
- Output: final recommendation payload consumed by chain assembly.
- Output is parsed and converted to USD suggestion.

### KPIs

- JSON validity rate.
- Zero-size rate.
- Size-confidence consistency.
- Risk-level distribution quality.
- Cap-hit rate and oversizing prevention.
- Latency p50/p95.

### Algorithms Used

- Deterministic:
  - percent clamp `[0, 0.2]`.
  - conversion to USD using virtual balance.
  - parser fallback to safe default on invalid output.
- LLM:
  - risk assessment.
  - position sizing recommendation.

---

## Executor Module (Trade Execution Agent Role)

### Function

- Executes approved/autonomous recommendations against virtual portfolio.
- Applies final trade amount clamp, writes trade records, updates balance.
- Transitions recommendation lifecycle to executed.

### Rules

- Must not execute without required lifecycle/guardrail checks upstream.
- Must preserve ledger integrity (`balanceBefore`, `balanceAfter`).
- Must audit every execution.

### Communication

- Input: pending/approved recommendation from lifecycle/cycle flow.
- Output: trade record + executed recommendation state.
- Integrates with recommendations repository and portfolio repository.

### KPIs

- Execution success rate.
- Execution latency.
- Slippage proxy (`execution price` vs recommendation price).
- Fill ratio (`executed amount` / `suggested amount`).
- Trade write integrity errors.

### Algorithms Used

- Deterministic:
  - lifecycle transition (`pending -> approved -> executed`).
  - amount clamp via `maxTradePct`.
  - price fetch with fallback.
  - balance and holdings updates.
- LLM:
  - none (executor is deterministic).

---

## Orchestrator Persona (System Brain)

### Function

- Central coordinator for all agent execution.
- Enforces security, verification, and audit before/after each call.

### Rules

- Must reject unknown agent names.
- Must block unsafe prompt patterns.
- Must verify routed identity tokens when present.
- Must log success/failure with hashes and duration.

### Communication

- Receives direct requests and routed payloads.
- Dispatches to registered agents only.
- Writes audit entries for observability.

### KPIs

- Dispatch success rate.
- Blocked injection count.
- Verification failure count.
- Per-agent execution duration and error rate.

### Algorithms Used

- Deterministic:
  - registry lookup.
  - prompt injection pattern checks.
  - message signature verification.
  - audit hashing and logging.

---

## Message Bus Persona (Trusted Transport Layer)

### Function

- Provides signed agent-to-agent routing envelopes.
- Preserves integrity and source identity across handoffs.

### Rules

- Every routed payload must include signed hash token.
- Receiver must verify token before processing.
- Routing must be auditable.

### Communication

- Used between researcher -> analyst and analyst -> advisor.
- Annotates context with `_messageFrom`, `_messageType`, `_identityToken`, `_payloadHash`.

### KPIs

- Routing success rate.
- Verification pass/fail rate.
- Message latency.
- Payload mismatch incidents.

### Algorithms Used

- Deterministic:
  - HMAC signing/verification over payload hash.
  - audited routing events.

---

## Autonomy Safety Persona (Guardrails + Cycle)

### Function

- Runs autonomous cycles and enforces hard risk constraints.
- Stops/blocks execution when limits are hit.

### Rules

- Must enforce kill switch, daily loss limit, cooldown, allowlist, and trade-size caps.
- Must skip expired or invalid recommendations.
- Must isolate per-coin failures (one coin failure should not crash full cycle).

### Communication

- Pulls recommendations from analysis chain.
- Applies guardrail checks before executor call.
- Persists cycle summary and skip reasons.

### KPIs

- Cycle success rate.
- Trades executed vs skipped.
- Guardrail intervention rate.
- Daily loss trip count.
- Kill-switch trip count.
- Cycle duration p50/p95.

### Algorithms Used

- Deterministic:
  - daily trade limit checks.
  - cooldown windows.
  - daily loss computation.
  - allowlist validation.
  - trade size validation.

---

## Recommended Persona-to-KPI Ownership Matrix

- Research quality: Researcher
- Direction quality: Analyst
- Risk/size quality: Advisor
- Fill/execution quality: Executor
- Security/compliance: Orchestrator + Message Bus + Guardrails
- Autonomy scale reliability: Autonomous Cycle Controller

---

## Notes for Model Selection

- Use stronger reasoning model on Analyst first (highest decision sensitivity).
- Use stricter, stable model for Advisor (schema and sizing discipline).
- Researcher can prioritize factual summarization quality over complex reasoning.
- Keep Executor/Guardrails deterministic regardless of model changes.
