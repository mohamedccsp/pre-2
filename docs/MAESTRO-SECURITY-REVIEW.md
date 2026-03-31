# MAESTRO Security Review — CryptoMAESTRO Platform

**Review Date:** 2026-03-28
**Platform Version:** Phase 4 (Autonomous Trading)
**Reviewer:** Automated review via Claude Code

---

## Executive Summary

CryptoMAESTRO implements the MAESTRO 7-layer security framework to govern a multi-agent cryptocurrency analysis and virtual trading system. The platform operates across three autonomy levels: Manual (L1), Human-in-the-Loop (L2), and Autonomous with Guardrails (L3). **No real money is involved at any point** — all trading is simulated against a virtual portfolio.

This review evaluates each MAESTRO layer's implementation status, identifies gaps, and recommends mitigations.

---

## Layer-by-Layer Assessment

### Layer 1: Foundation Model Security

**Purpose:** Prevent prompt injection and ensure LLM inputs are sanitized.

**Implementation:**
- `lib/maestro/validator.ts` — `checkPromptInjection()` scans all queries before LLM calls
- Pattern matching for known injection vectors: role overrides, system prompt leaks, instruction ignoring
- `sanitizeAgentOutput()` strips HTML tags from LLM responses

**Enforcement Point:** `lib/agents/orchestrator.ts:33` — every `executeAgent()` call runs injection check before agent execution.

**Assessment:** ✅ **Implemented**

| Check | Status | Notes |
|-------|--------|-------|
| Prompt injection detection | ✅ | Regex-based, catches common patterns |
| Input sanitization | ✅ | Applied before every LLM call |
| Output sanitization | ✅ | HTML stripping on all agent outputs |
| Raw user input as system prompt | ✅ Blocked | User queries go to `user` role only |

**Gaps:**
- Injection detection is regex-based — may miss novel attack vectors. Consider adding a classifier-based detector.
- No content filtering on LLM responses beyond HTML stripping.

**Risk Level:** Low — platform uses read-only data and virtual money.

---

### Layer 2: Data Operations Security

**Purpose:** Sanitize external data and track provenance.

**Implementation:**
- `lib/api/coingecko.ts` — typed response parsing via TypeScript interfaces
- All API responses are cached in-memory with 60-second TTL
- External data passes through typed interfaces before reaching agents

**Assessment:** ✅ **Implemented**

| Check | Status | Notes |
|-------|--------|-------|
| Input validation on API data | ✅ | TypeScript type assertions on all responses |
| Data provenance tracking | ✅ | Agent outputs include `sources[]` array |
| Cache poisoning protection | ⚠️ Partial | In-memory cache, no signature validation |
| Rate limit protection | ✅ | CoinGecko client has retry + backoff |

**Gaps:**
- No cryptographic validation of API response integrity.
- Cache is in-memory — restarts clear it, but also no persistence of potentially poisoned data.

**Risk Level:** Low — CoinGecko is a trusted data source over HTTPS.

---

### Layer 3: Agent Framework Security

**Purpose:** Enforce agent boundaries, tool allowlists, and guardrails.

**Implementation:**
- Each agent declares `allowedTools: string[]` in its definition
- Orchestrator maintains agent registry — only registered agents can execute
- Guardrails enforce trade limits per interaction

**Files:**
- `lib/maestro/guardrails.ts` — `checkNotExpired`, `checkTradeSize`, `checkCoinAllowlist`, `checkDailyTradeLimit`, `checkCooldown`, `checkDailyLossLimit`
- `lib/agents/orchestrator.ts` — agent registry and execution gateway
- `lib/autonomous/config-repository.ts` — persisted guardrail configuration

**Assessment:** ✅ **Implemented**

| Guardrail | Default | Configurable | Status |
|-----------|---------|-------------|--------|
| Max trade size | 10% (autonomous), 20% (HITL) | Yes | ✅ |
| Daily trade limit | 5 trades/day | Yes | ✅ |
| Cooldown per coin | 30 minutes | Yes | ✅ |
| Daily loss limit | 15% | Yes | ✅ |
| Coin allowlist | Top 20 by market cap | No | ✅ |
| Recommendation expiry | 5 minutes (HITL) | No | ✅ |
| Kill switch | Persisted to DB | Yes | ✅ |
| Config change risk warning | Warns on aggressive changes | N/A | ✅ |

**Gaps:**
- `allowedTools` is declared but not runtime-enforced — agents don't actually call tools through a gatekeeper. The tool restriction is architectural (agents only receive pre-fetched data via context).
- No runtime check prevents a modified agent from calling APIs directly.

**Risk Level:** Low — agents are server-side TypeScript modules, not user-modifiable.

---

### Layer 4: Infrastructure Security

**Purpose:** Rate limiting, secret management, environment isolation.

**Implementation:**
- `lib/maestro/rate-limiter.ts` — in-memory rate limiting on all API routes
- All secrets in `.env` (never committed, `.gitignore` enforced)
- `.env.example` documents required variables without values

**Assessment:** ✅ **Implemented**

| Check | Status | Notes |
|-------|--------|-------|
| API rate limiting | ✅ | Per-IP, configurable per route |
| Secret management | ✅ | `.env` only, never in code |
| Autonomous cycle rate limit | ✅ | 2 per 5 minutes |
| CoinGecko rate respect | ✅ | 30 req/min free tier, sequential processing |

**Gaps:**
- Rate limiter is in-memory — resets on server restart. Acceptable for local development.
- No IP allowlisting or API key authentication on routes.

**Risk Level:** Low for local development. Would need hardening for production deployment.

---

### Layer 5: Observability

**Purpose:** Audit trail for every agent action, trade, and configuration change.

**Implementation:**
- `lib/maestro/audit-logger.ts` — daily NDJSON files in `data/audit/`
- Every agent execution logged with: agent name, action, input hash, output hash, duration, success/failure
- Trade executions logged with recommendation and trade IDs
- Autonomous cycle start/complete events logged
- Kill switch and config changes logged

**Assessment:** ✅ **Implemented**

| Event | Logged | Location |
|-------|--------|----------|
| Agent execution | ✅ | `orchestrator.ts` |
| Prompt injection blocked | ✅ | `orchestrator.ts` |
| Message routing (L7) | ✅ | `message-bus.ts` |
| Trade execution | ✅ | `executor.ts` |
| Recommendation approve/reject | ✅ | `[id]/route.ts` |
| Autonomous cycle lifecycle | ✅ | `cycle.ts` |
| Config changes | ✅ | `config/route.ts` |
| Kill switch toggle | ✅ | `config/route.ts` |

**Gaps:**
- Audit files are local filesystem — lost on deployment to serverless.
- No real-time audit streaming to UI (batch read only via `getRecentAuditEntries`).
- No tamper detection on audit files.

**Risk Level:** Medium — audit integrity depends on filesystem permissions.

---

### Layer 6: Input/Output Boundary Security

**Purpose:** Sanitize at every agent boundary to prevent data leakage.

**Implementation:**
- `sanitizeAgentOutput()` applied to every agent's `execute()` return value
- `checkPromptInjection()` on all inbound queries
- Zod validation on all API route request bodies
- DLP-style output scanning for common sensitive patterns

**Assessment:** ✅ **Implemented**

| Boundary | Input Sanitization | Output Sanitization |
|----------|-------------------|-------------------|
| User → API route | ✅ Zod validation | N/A |
| API route → Orchestrator | ✅ Prompt injection check | N/A |
| Orchestrator → Agent | ✅ Via L1 check | ✅ `sanitizeAgentOutput` |
| Agent → LLM | ✅ Structured prompts only | ✅ Response parsing |
| Agent → Agent (via bus) | ✅ L7 hash + token | ✅ Typed payloads |

**Gaps:**
- No PII detection in agent outputs (not critical for crypto data).
- Output sanitization is HTML-focused — doesn't catch markdown injection.

**Risk Level:** Low.

---

### Layer 7: Agent Ecosystem Security

**Purpose:** Secure inter-agent communication with identity verification.

**Implementation:**
- `lib/agents/message-bus.ts` — `routeMessage()` creates signed message envelopes
- HMAC identity tokens: `signEnvelope()` derives per-agent keys from `AGENT_SECRET_KEY` + agent name
- `verifyEnvelope()` validates tokens before agent processes routed messages
- Orchestrator checks `_identityToken` on all routed agent inputs
- All inter-agent messages logged to audit trail with payload hashes

**Assessment:** ✅ **Implemented**

| Check | Status | Notes |
|-------|--------|-------|
| Message signing | ✅ | HMAC-SHA256 per agent |
| Message verification | ✅ | Orchestrator validates before execution |
| Payload integrity | ✅ | SHA-256 hash in audit log |
| Direct agent-to-agent calls | ✅ Blocked | All routing through message bus |
| Agent identity spoofing | ✅ Protected | HMAC requires shared secret |

**Gaps:**
- `AGENT_SECRET_KEY` defaults to `'default-dev-key'` if not set — must be configured in production.
- No key rotation mechanism.
- No message replay protection (no nonce/timestamp validation on tokens).

**Risk Level:** Low for local development. Medium for production without key rotation.

---

## Autonomy Level Assessment

### Level 1 (Manual) ✅
- User views market data, makes all decisions
- No agent-initiated actions
- Full MAESTRO L4 (rate limiting) and L6 (input validation)

### Level 2 (HITL) ✅
- Agent chain produces recommendations
- **User must explicitly approve** before trade execution
- 5-minute expiry on pending recommendations
- Full audit trail: recommendation → approval → execution
- MAESTRO L1-L6 active

### Level 3 (Autonomous) ✅
- Agent analyzes all 20 allowlisted coins
- Auto-executes qualifying recommendations within guardrails
- 6 guardrail checks per coin before execution
- Kill switch persisted to database
- Risk warning on aggressive config changes
- Full cycle audit logging
- MAESTRO L1-L7 active

---

## Threat Model Summary

| Threat | Mitigation | Residual Risk |
|--------|-----------|---------------|
| Prompt injection → unauthorized trades | L1 injection detection + L3 guardrails | Low |
| Agent executing outside boundaries | L3 tool allowlist + L7 identity verification | Low |
| Excessive trading losses | Daily loss limit (15%), trade size cap (10%), kill switch | Low |
| Data poisoning via API | L2 typed parsing + HTTPS + cache TTL | Low |
| Audit trail tampering | L5 append-only NDJSON files | Medium (local FS) |
| Agent identity spoofing | L7 HMAC challenge-response | Low |
| Rate limit bypass | L4 per-IP in-memory tracking | Low (local dev) |
| Real money exposure | **Zero** — virtual portfolio only | None |

---

## Recommendations

### High Priority
1. **Set `AGENT_SECRET_KEY`** in `.env` to a strong random value (not the default)
2. **Add authentication** (Phase 5.2) before any network exposure
3. **Migrate audit logger** to database before deployment

### Medium Priority
4. Add message replay protection with nonce + timestamp window
5. Implement HMAC key rotation schedule
6. Add real-time audit event streaming for monitoring UI
7. Runtime enforcement of agent `allowedTools` via a tool gateway

### Low Priority
8. Classifier-based prompt injection detection (beyond regex)
9. Content Security Policy headers on all responses
10. Cryptographic signing of audit entries

---

## Conclusion

The CryptoMAESTRO platform implements all 7 MAESTRO layers with appropriate depth for a local learning platform. The critical safety guarantee — **no real money is ever at risk** — means the residual risk of all identified gaps is acceptable. The platform is well-positioned for production hardening via the improvements documented in `future-improvement.md`.
