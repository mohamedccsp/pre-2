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

- Build: Query is checked by orchestrator `checkPromptInjection`; API route validates body with `agentQuerySchema`.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts` (`agentQuerySchema` + `checkPromptInjection`)
    - Reason of test: ensure only valid query shape/length enters model context and dangerous instruction patterns are blocked early.
    - Attack/risk avoided: prompt injection, jailbreak prompts, role override attacks, malicious instruction hijacking.

### Layer 2 - Data operations

- Build: Researcher fetches CoinGecko data (`getCoinDetail`, `getCoinsMarkets`, `getTrending`, `getGlobal`) and builds grounded context text.
- Tests done:
  - `tests/lib/api/coingecko.test.ts`
    - Reason of test: verify data fetch, parsing, caching, and retry behavior so agent works on trusted structured market data.
    - Attack/risk avoided: cache poisoning side effects from malformed responses, reliability failure under API errors (availability risk), and bad data shape propagation to LLM.
  - `tests/lib/agents/researcher.test.ts` (`classifyQuery`)
    - Reason of test: verify correct routing between `coin`, `comparison`, and `market` research modes.
    - Attack/risk avoided: context confusion attacks where crafted query text forces wrong data path and produces misleading analysis.

### Layer 3 - Agent framework

- Build: Agent metadata and tool policy are declared (`allowedTools: ['coingecko_read', 'coincap_read']`), and execution is centralized through orchestrator registry.
- Tests done:
  - No direct unit test for researcher allowlist enforcement or orchestrator registry checks.

### Layer 4 - Infrastructure

- Build: `POST /api/agents/research` applies `rateLimitMiddleware(request, 10)`.
- Tests done:
  - `tests/lib/maestro/rate-limiter.test.ts`
    - Reason of test: validate per-IP counting, independent buckets, and lockout behavior past threshold.
    - Attack/risk avoided: request flooding, brute-force endpoint abuse, denial-of-service pressure against agent routes.

### Layer 5 - Observability

- Build: Orchestrator logs success/failure audit entries; message bus logs routed message actions.
- Tests done:
  - `tests/lib/maestro/audit-logger.test.ts`
    - Reason of test: verify NDJSON persistence, append behavior, ordering, limits, and hash formatting.
    - Attack/risk avoided: forensic blind spots, log loss/tamper-like inconsistency, inability to trace suspicious agent activity.

### Layer 6 - Security

- Build: LLM output is sanitized with `sanitizeAgentOutput` before returning data to consumers.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts` (`sanitizeAgentOutput`)
    - Reason of test: verify HTML/script stripping and safe plain-text output.
    - Attack/risk avoided: XSS/script injection from model output, unsafe HTML rendering in UI surfaces.

### Layer 7 - Ecosystem

- Build: Researcher does not declare L7 locally, but in chain flow it sends data via signed message bus envelope toward analyst.
- Tests done:
  - `tests/lib/agents/message-bus.test.ts` (`verifyEnvelope` invalid token scenarios)
    - Reason of test: ensure invalid/empty tokens are rejected.
    - Attack/risk avoided: agent impersonation attempts with fake tokens, unauthorized inter-agent message injection.

---

## Agent: Analyst

Declared MAESTRO layers in code: `[1, 2, 3, 5, 6]`

### Layer 1 - Foundation model

- Build: Orchestrator prompt-injection checks run before analyst execution; analyst prompt enforces strict JSON-only response format.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts` (`checkPromptInjection`)
    - Reason of test: shared L1 gate guarantees suspicious instructions are blocked before entering model call.
    - Attack/risk avoided: prompt takeover, instruction overwrite, jailbreak chains.

### Layer 2 - Data operations

- Build: Analyst consumes technical snapshot + research context and produces action/confidence/reasoning.
- Tests done:
  - `tests/lib/agents/analyst.test.ts`
    - `computeRSI`
      - Reason of test: validate indicator math boundaries and behavior for rising/falling/mixed datasets.
      - Attack/risk avoided: signal integrity failure (bad math causing unsafe trade signal decisions).
    - `computeSMA`
      - Reason of test: ensure moving average uses correct windows and edge handling.
      - Attack/risk avoided: data-window manipulation risk and incorrect trend calculations.
    - `parseAnalysisResponse`
      - Reason of test: enforce safe parsing, fallback defaults, and confidence clamping.
      - Attack/risk avoided: malformed LLM JSON causing runtime crashes, confidence inflation attacks, invalid action injection.
  - `tests/lib/api/coingecko.test.ts` (`getMarketChart`, `getOHLC`)
    - Reason of test: ensure raw API arrays are transformed to typed structures before indicator computation.
    - Attack/risk avoided: malformed upstream payloads breaking analyst pipeline or distorting derived indicators.

### Layer 3 - Agent framework

- Build: Analyst allowlist and metadata declared (`allowedTools: ['coingecko_read', 'research_read']`), orchestrator mediates execution.
- Tests done:
  - No direct unit test for analyst allowlist enforcement in orchestrator.

### Layer 4 - Infrastructure

- Build: Analyst runs via `POST /api/agents/analyze`, which is rate limited and authenticated.
- Tests done:
  - `tests/lib/maestro/rate-limiter.test.ts`
    - Reason of test: verify throttling behavior for expensive multi-agent calls.
    - Attack/risk avoided: chain-level resource exhaustion and repeated expensive API abuse.

### Layer 5 - Observability

- Build: Orchestrator logs analyst execution and durations; message routing emits audit entries.
- Tests done:
  - `tests/lib/maestro/audit-logger.test.ts`
    - Reason of test: confirm execution traces are stored and retrievable.
    - Attack/risk avoided: non-repudiation gaps and inability to audit suspicious analyst behavior.

### Layer 6 - Security

- Build: Analyst output is sanitized with `sanitizeAgentOutput`.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts` (`sanitizeAgentOutput`)
    - Reason of test: verify post-LLM sanitization for output safety.
    - Attack/risk avoided: reflected/stored UI script injection through agent responses.

### Layer 7 - Ecosystem

- Build: Analyst receives researcher handoff and sends advisor handoff through signed envelopes; orchestrator verifies identity fields if present.
- Tests done:
  - `tests/lib/agents/message-bus.test.ts`
    - Reason of test: verify signature validation fails closed when token is wrong/missing.
    - Attack/risk avoided: forged internal routing messages and trust-boundary bypass between agents.

---

## Agent: Advisor

Declared MAESTRO layers in code: `[1, 3, 5, 6]`

### Layer 1 - Foundation model

- Build: Orchestrator prompt injection gate applies to advisor input; advisor prompt restricts output contract to strict JSON schema.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts` (`agentQuerySchema`, `checkPromptInjection`)
    - Reason of test: maintain controlled input path into recommendation model.
    - Attack/risk avoided: malicious prompt payloads steering risk model behavior.

### Layer 2 - Data operations

- Build: Not declared in advisor `maestroLayer`; advisor consumes analysis + portfolio context and computes recommendation sizing.
- Tests done:
  - `tests/lib/agents/advisor.test.ts` (`parseAdvisorResponse`)
    - Reason of test: verify safe JSON parsing, fallback defaults, risk normalization, and 20% cap enforcement.
    - Attack/risk avoided: oversized position suggestion attacks, malformed LLM payload crashes, invalid risk-level injection.

### Layer 3 - Agent framework

- Build: Advisor metadata and tool allowlist declared (`allowedTools: ['analyst_read', 'portfolio_read']`); recommendation execution path applies guardrails.
- Tests done:
  - `tests/lib/maestro/guardrails.test.ts`
    - `checkNotExpired`
      - Reason of test: block stale pending recommendations.
      - Attack/risk avoided: replay/late-execution of outdated signals.
    - `checkTradeSize`
      - Reason of test: enforce positive amount, balance bound, and max percentage cap.
      - Attack/risk avoided: overspending, capital-drain trades, allocation bypass.
    - `checkCoinAllowlist`
      - Reason of test: ensure only approved assets are tradable.
      - Attack/risk avoided: unauthorized-asset execution and asset-scope escalation.
    - `checkDailyTradeLimit`, `checkCooldown`, `checkDailyLossLimit`
      - Reason of test: enforce trade frequency and risk brakes.
      - Attack/risk avoided: high-frequency abuse loops, rapid re-entry churn, cascading loss amplification.
  - No direct unit test for advisor allowlist enforcement in orchestrator.

### Layer 4 - Infrastructure

- Build: Advisor itself does not declare L4, but recommendation/approval API endpoints are rate limited.
- Tests done:
  - `tests/lib/maestro/rate-limiter.test.ts`
    - Reason of test: ensure recommendation endpoints can throttle abusive clients.
    - Attack/risk avoided: endpoint flooding and forced repeated approval attempts.

### Layer 5 - Observability

- Build: Orchestrator logs advisor execution; recommendation state changes and autonomous config changes also log audit events.
- Tests done:
  - `tests/lib/maestro/audit-logger.test.ts`
    - Reason of test: verify append-only audit event storage and retrieval.
    - Attack/risk avoided: missing traceability for recommendation acceptance/rejection/execution actions.

### Layer 6 - Security

- Build: Advisor reasoning is sanitized with `sanitizeAgentOutput`.
- Tests done:
  - `tests/lib/maestro/agent-validator.test.ts` (`sanitizeAgentOutput`)
    - Reason of test: protect any UI/API consumer from unsafe model text.
    - Attack/risk avoided: XSS from malicious HTML/script embedded in advisor reasoning.

### Layer 7 - Ecosystem

- Build: Advisor receives analyst message via signed envelope; orchestrator verifies message identity token before execution path continues.
- Tests done:
  - `tests/lib/agents/message-bus.test.ts`
    - Reason of test: ensure only validly signed inter-agent envelopes are accepted.
    - Attack/risk avoided: spoofed analyst identity and unauthorized message injection to advisor.

---

## Cross-cutting test coverage note

These additional tests support agent security and reliability even if they are not agent-specific:

- `tests/lib/recommendations/lifecycle.test.ts`
  - Reason: verifies pending -> approved/rejected/expired/executed transitions.
  - Attack/risk avoided: invalid state transition bugs that can bypass human approval controls.
- `tests/lib/maestro/validator.test.ts`
  - Reason: validates coin IDs, day parameters, and input sanitization.
  - Attack/risk avoided: parameter tampering, query injection through malformed route params.

---

## Gaps found (future hardening)

- Missing direct integration tests for:
  - orchestrator happy-path execution per agent (`executeAgent`)
  - runtime enforcement of `allowedTools` policy (L3)
  - positive-path message signature verification with known-valid tokens (L7)
  - full end-to-end chain test (`researcher -> analyst -> advisor`) with mocked OpenAI/CoinGecko
- Current tests are strong on helpers and controls, but should be complemented with orchestration integration tests for full attack-path confidence.
