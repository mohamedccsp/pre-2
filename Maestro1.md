# Maestro1 MAESTRO Agent Build Report

Date: 2026-03-29
Project: CryptoMAESTRO (`pre-2`)

## What I reviewed

- Agent implementations: `lib/agents/researcher.ts`, `lib/agents/analyst.ts`, `lib/agents/advisor.ts`
- Agent orchestration and messaging: `lib/agents/chain.ts`, `lib/agents/orchestrator.ts`, `lib/agents/message-bus.ts`
- MAESTRO controls: `lib/maestro/validator.ts`, `lib/maestro/rate-limiter.ts`, `lib/maestro/audit-logger.ts`, `lib/maestro/guardrails.ts`
- API workflow entry points: `app/api/agents/research/route.ts`, `app/api/agents/analyze/route.ts`, `app/api/agents/recommendations/route.ts`, `app/api/agents/recommendations/[id]/route.ts`
- NHI documentation: `docs/NHI.md`
- Test suites under `tests/lib/**`

## Current workflow (how the platform runs)

1. Client calls `POST /api/agents/analyze` with `coinId`.
2. Endpoint validates input, rate limits request, and calls `executeAnalysisChain`.
3. Chain runs:
   - `researcher` via orchestrator
   - computes indicators from CoinGecko data
   - routes signed message to `analyst` through message bus (L7)
   - routes signed message to `advisor` through message bus (L7)
4. Orchestrator enforces prompt-injection checks (L1), logs audit (L5), and verifies identity envelope when routed context exists (L7).
5. Recommendation is stored as pending; user can approve/reject via recommendations API.
6. On approval, guardrails (expiry, allowlist, size) are enforced before trade execution.

## Test run status

- Command run: `npm test`
- Result: **11 test files passed, 115 tests passed**

---

## Agent: Researcher

Declared MAESTRO layers in code: `[1, 3, 4, 5, 6]`

### Layer 1 - Foundation model

- Build: Query is checked by orchestrator `checkPromptInjection` before execution; API route uses `agentQuerySchema`.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts`
    - `agentQuerySchema` valid/invalid cases
    - prompt-injection pattern blocking cases

### Layer 2 - Data operations

- Build: Researcher fetches CoinGecko data (`getCoinDetail`, `getCoinsMarkets`, `getTrending`, `getGlobal`) and builds LLM context.
- Tests done:
  - `tests/lib/api/coingecko.test.ts`
    - endpoint fetch and transformation tests
    - cache behavior
    - retry/error behavior
  - `tests/lib/agents/researcher.test.ts`
    - query classification behavior used to select data path

### Layer 3 - Agent framework

- Build: Agent metadata and allowlist are defined (`allowedTools: ['coingecko_read', 'coincap_read']`), and execution is routed through orchestrator registry.
- Tests done:
  - No direct unit test for researcher allowlist enforcement or orchestrator registry path.

### Layer 4 - Infrastructure

- Build: `POST /api/agents/research` applies `rateLimitMiddleware(request, 10)`.
- Tests done:
  - `tests/lib/maestro/rate-limiter.test.ts`
    - per-IP counters
    - threshold blocking
    - reset timestamp behavior

### Layer 5 - Observability

- Build: Orchestrator logs success/failure audit entries; message routing logs `message_routed:*`.
- Tests done:
  - `tests/lib/maestro/audit-logger.test.ts`
    - NDJSON persistence
    - ordering/limit behavior
    - hash consistency/format

### Layer 6 - Security

- Build: Agent output is sanitized with `sanitizeAgentOutput` before returning.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts`
    - script/tag stripping
    - trim and clean pass-through behavior

### Layer 7 - Ecosystem

- Build: Researcher does not declare L7 in its local `maestroLayer`, but its output is routed to analyst through signed message bus envelopes in chain flow.
- Tests done:
  - `tests/lib/agents/message-bus.test.ts`
    - invalid/empty token rejection coverage

---

## Agent: Analyst

Declared MAESTRO layers in code: `[1, 2, 3, 5, 6]`

### Layer 1 - Foundation model

- Build: Orchestrator performs prompt-injection checks before analyst execution; analyst uses a constrained JSON-only system prompt.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts`
    - shared prompt-injection checks used by orchestrator

### Layer 2 - Data operations

- Build: Analyst consumes technical snapshot (RSI/SMA/volume/price deltas) and research context to produce structured signal text.
- Tests done:
  - `tests/lib/agents/analyst.test.ts`
    - `computeRSI` behavior and boundaries
    - `computeSMA` calculations
    - `parseAnalysisResponse` JSON parsing/fallback/clamping
  - `tests/lib/api/coingecko.test.ts`
    - market chart and OHLC transforms that feed indicator computations

### Layer 3 - Agent framework

- Build: Analyst allowlist and metadata are defined (`allowedTools: ['coingecko_read', 'research_read']`), execution mediated by orchestrator.
- Tests done:
  - No direct test for analyst allowlist enforcement in orchestrator.

### Layer 4 - Infrastructure

- Build: Analyst is used via chain endpoint `POST /api/agents/analyze`, which is rate limited (`5/min`) and authenticated.
- Tests done:
  - `tests/lib/maestro/rate-limiter.test.ts` (shared middleware mechanics)

### Layer 5 - Observability

- Build: Orchestrator logs analyst execute events; message bus logs handoff metadata.
- Tests done:
  - `tests/lib/maestro/audit-logger.test.ts` (shared audit layer tests)

### Layer 6 - Security

- Build: Analyst result is sanitized (`sanitizeAgentOutput`) before final output.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts`
    - output sanitization coverage (shared across agents)

### Layer 7 - Ecosystem

- Build: Analyst receives researcher payload from signed envelope and sends advisor payload through signed envelope; orchestrator verifies token when identity context exists.
- Tests done:
  - `tests/lib/agents/message-bus.test.ts`
    - `verifyEnvelope` negative-path tests

---

## Agent: Advisor

Declared MAESTRO layers in code: `[1, 3, 5, 6]`

### Layer 1 - Foundation model

- Build: Orchestrator prompt-injection checks apply before advisor execution; advisor prompt constrains output to strict JSON.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts`
    - shared input schema and injection checks

### Layer 2 - Data operations

- Build: Not declared in advisor `maestroLayer`. Advisor consumes upstream outputs (analysis, indicators, portfolio balance) and does not directly fetch market APIs.
- Tests done:
  - `tests/lib/agents/advisor.test.ts`
    - `parseAdvisorResponse` JSON parsing and fallback behavior
    - max allocation cap (20%) logic
    - risk level normalization

### Layer 3 - Agent framework

- Build: Advisor allowlist and metadata are defined (`allowedTools: ['analyst_read', 'portfolio_read']`), execution and registration managed by orchestrator.
- Tests done:
  - No direct unit test for advisor allowlist enforcement in orchestrator.
  - Related framework guardrails for recommendation execution are tested in `tests/lib/maestro/guardrails.test.ts`.

### Layer 4 - Infrastructure

- Build: Not declared in advisor `maestroLayer`; operational infrastructure controls still exist at API layer (`/recommendations` endpoints rate limited).
- Tests done:
  - `tests/lib/maestro/rate-limiter.test.ts` (shared middleware mechanics)

### Layer 5 - Observability

- Build: Orchestrator logs advisor execution and attaches `auditId` to output; recommendation actions also log audit events.
- Tests done:
  - `tests/lib/maestro/audit-logger.test.ts` (shared L5 behavior)

### Layer 6 - Security

- Build: Advisor reasoning is sanitized with `sanitizeAgentOutput`.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts`
    - output sanitization coverage (shared across agents)

### Layer 7 - Ecosystem

- Build: Advisor receives analyst message via signed envelope in chain flow; orchestrator validates identity token when present.
- Tests done:
  - `tests/lib/agents/message-bus.test.ts`
    - token rejection behavior

---

## Gaps found (important for future hardening)

- No direct integration tests for:
  - orchestrator happy-path execution per agent (`executeAgent` for researcher/analyst/advisor)
  - allowlist enforcement in runtime (L3)
  - positive-path envelope verification with known-valid signed token (L7)
  - full end-to-end chain test (`researcher -> analyst -> advisor`) with mocked OpenAI/CoinGecko
- Agent unit tests focus on deterministic helper logic and validators, which is good, but do not yet fully cover runtime orchestration behavior.
