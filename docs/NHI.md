# Non-Human Identity (NHI) Verification & Agent-to-Agent Communication Security

> CryptoMAESTRO Platform -- MAESTRO Security Framework, Layer 7 (Ecosystem)

---

## Table of Contents

1. [Overview](#overview)
2. [Non-Human Identity (NHI) Model](#non-human-identity-nhi-model)
3. [Agent Identity Lifecycle](#agent-identity-lifecycle)
4. [Agent-to-Agent Communication Protocol](#agent-to-agent-communication-protocol)
5. [Cryptographic Algorithms](#cryptographic-algorithms)
6. [Message Envelope Structure](#message-envelope-structure)
7. [Key Derivation & Management](#key-derivation--management)
8. [Verification Flow](#verification-flow)
9. [Audit Trail & Integrity](#audit-trail--integrity)
10. [Threat Model](#threat-model)
11. [Implementation Reference](#implementation-reference)
12. [Future Considerations](#future-considerations)

---

## Overview

CryptoMAESTRO employs a multi-agent architecture where autonomous software agents (Researcher, Analyst, Advisor) collaborate to produce trade recommendations. Because these agents operate without human operators, traditional identity verification (passwords, biometrics, MFA) does not apply. Instead, the platform implements a **Non-Human Identity (NHI)** framework -- a cryptographic identity system purpose-built for machine-to-machine trust within the MAESTRO security model.

### Core Principles

- **Zero Direct Communication**: Agents never call each other directly. All messages route through a centralized message bus that enforces identity verification at every hop.
- **Cryptographic Identity**: Each agent possesses a unique, derived signing key. Identity is proven through cryptographic signatures, not shared secrets or tokens.
- **Least Privilege**: Each agent has a strict tool allowlist. Even with a valid identity, an agent cannot access tools outside its scope.
- **Immutable Auditability**: Every message, every verification, and every failed attempt is logged to a tamper-evident audit trail.

---

## Non-Human Identity (NHI) Model

### What is a Non-Human Identity?

A Non-Human Identity (NHI) is a cryptographically verifiable identity assigned to a software agent, service, or automated process. Unlike human identities (which rely on knowledge factors like passwords or inherence factors like biometrics), NHIs rely exclusively on **possession factors** -- specifically, access to cryptographic key material.

### NHI Properties in CryptoMAESTRO

| Property | Description |
|----------|-------------|
| **Identity Anchor** | Agent name string (e.g., `researcher`, `analyst`, `advisor`) |
| **Identity Proof** | HMAC-SHA256 signature derived from agent-specific key material |
| **Scope** | Tool allowlist defining what the agent can access |
| **Lifetime** | Per-message; identity must be proven on every communication |
| **Revocability** | Rotating `AGENT_SECRET_KEY` invalidates all agent identities |
| **Non-transferability** | Key derivation binds the signing key to the agent name |

### NHI vs Human Identity Comparison

| Aspect | Human Identity | Non-Human Identity (NHI) |
|--------|---------------|--------------------------|
| Authentication | Password, MFA, biometrics | Cryptographic signature |
| Session | Stateful (JWT, cookies) | Stateless (per-message proof) |
| Credential rotation | User-initiated | Operator-initiated (key rotation) |
| Behavioral analysis | Login patterns, IP, device | Message frequency, payload anomalies |
| Revocation | Account disable | Secret key rotation |
| Scalability | Hundreds to thousands | Thousands to millions |
| Trust establishment | Identity provider (IdP) | Key derivation function (KDF) |
---

## Agent Identity Lifecycle

### 1. Provisioning

Agent identities are provisioned at system startup through the orchestrator agent registry:

```
Orchestrator boots
  -> Loads agent registry: { researcher, analyst, advisor }
  -> Each agent identity is bound to AGENT_SECRET_KEY + agent name
  -> No separate provisioning step -- identity is derived, not issued
```

### 2. Authentication (Per-Message)

Every time an agent sends a message through the message bus:

```
Agent A wants to send message to Agent B
  -> Message bus computes payloadHash = SHA-256(JSON(payload))
  -> Derives signing key = AGENT_SECRET_KEY + ":" + agentName
  -> Computes identityToken = HMAC-SHA256(signingKey, payloadHash)
  -> Attaches identityToken + payloadHash to message envelope
```

### 3. Verification (Per-Message)

Before delivering a message to the recipient agent:

```
Message bus receives routed message
  -> Extracts fromAgent, payloadHash, identityToken
  -> Recomputes expected = HMAC-SHA256(derivedKey(fromAgent), payloadHash)
  -> Compares expected === identityToken
  -> If mismatch: reject message, log security event
  -> If match: deliver to recipient agent
```

### 4. Revocation

Agent identities are revoked by rotating `AGENT_SECRET_KEY`:

```
Operator rotates AGENT_SECRET_KEY
  -> All previously derived signing keys become invalid
  -> All in-flight messages with old signatures are rejected
  -> New messages use signatures derived from the new key
```

---

## Agent-to-Agent Communication Protocol

### Architecture

```
+----------+                                           +----------+
|          |   (1) Sign Envelope                       |          |
|Researcher|--------------+                            | Analyst  |
|  Agent   |              |                            |  Agent   |
+----------+              v                            +----------+
                 +-----------------+                        ^
                 |                 |   (3) Deliver           |
                 |   Message Bus   |------------------------+
                 |   (MAESTRO L7)  |
                 |                 |   (2) Verify Identity
                 +-----------------+   (2) Verify Payload Hash
                          |            (2) Log to Audit Trail
                          |
                          v
                 +-----------------+
                 |  Audit Logger   |
                 |  (MAESTRO L5)   |
                 |  NDJSON Files   |
                 +-----------------+
```

### Communication Rules

1. **No Direct Calls**: Agents NEVER invoke each other's `execute()` method directly. All communication flows through `routeMessage()` on the message bus.

2. **Unidirectional Pipeline**: The analysis chain enforces a strict order:
   ```
   Researcher -> Analyst -> Advisor
   ```
   The Advisor cannot send messages back to the Researcher. The Analyst cannot invoke the Advisor. Only the chain orchestrator drives the sequence.

3. **Signed Envelopes**: Every routed message includes:
   - `_messageFrom` -- sender agent identity
   - `_messageType` -- message classification enum
   - `_identityToken` -- HMAC-SHA256 proof of sender identity
   - `_payloadHash` -- SHA-256 digest of the payload

4. **Fail-Closed**: If signature verification fails, the message is **dropped** and a security event is logged. The pipeline halts -- no fallback, no retry.

### Message Types

| Type | Direction | Purpose |
|------|-----------|---------|
| `RESEARCH_COMPLETE` | Researcher -> Analyst | Market research data handoff |
| `ANALYSIS_COMPLETE` | Analyst -> Advisor | Technical analysis results handoff |
| `RECOMMENDATION_READY` | Advisor -> Orchestrator | Final trade recommendation |
---

## Cryptographic Algorithms

### Primary Algorithms

#### 1. HMAC-SHA256 (Agent Identity Signing)

- **Algorithm**: HMAC (Hash-based Message Authentication Code) with SHA-256
- **RFC**: [RFC 2104](https://datatracker.ietf.org/doc/html/rfc2104) (HMAC), [FIPS 180-4](https://csrc.nist.gov/publications/detail/fips/180/4/final) (SHA-256)
- **Purpose**: Agent identity verification on every inter-agent message
- **Key Size**: 256 bits (derived from `AGENT_SECRET_KEY` + agent name)
- **Output Size**: 256 bits (64 hex characters)
- **Security Level**: 128-bit security against collision attacks

**Why HMAC-SHA256?**

- **Symmetric efficiency**: Agent-to-agent communication is internal. No need for asymmetric cryptography (RSA, ECDSA) because both signing and verification happen within the same trust boundary (the server process).
- **Speed**: HMAC-SHA256 computes in microseconds, critical for a real-time trading pipeline where latency matters.
- **Key binding**: HMAC naturally binds the message to a specific key, preventing an agent from forging another agent's signature without knowing that agent's derived key.
- **Industry standard**: Used in JWT (HS256), AWS Signature V4, Stripe webhook verification, and countless authentication protocols.

**Construction**:

```
HMAC-SHA256(K, m) = SHA-256((K_prime XOR opad) || SHA-256((K_prime XOR ipad) || m))

Where:
  K       = signing key (AGENT_SECRET_KEY:agentName)
  m       = payload hash (SHA-256 digest of the message body)
  K_prime = key padded/hashed to block size (512 bits for SHA-256)
  ipad    = 0x36 repeated to block size
  opad    = 0x5C repeated to block size
```

#### 2. SHA-256 (Payload Hashing & Audit Integrity)

- **Algorithm**: SHA-256 (Secure Hash Algorithm, 256-bit)
- **Standard**: [FIPS 180-4](https://csrc.nist.gov/publications/detail/fips/180/4/final)
- **Purpose**: Payload integrity verification, audit trail hashing
- **Output Size**: 256 bits (64 hex characters; truncated to 16 chars for audit IDs)
- **Collision Resistance**: 128-bit security
- **Preimage Resistance**: 256-bit security

**Usage in CryptoMAESTRO**:

| Context | Input | Output | Truncation |
|---------|-------|--------|------------|
| Message payload hash | `JSON.stringify(payload)` | 64 hex chars | None |
| Audit input hash | Agent input string | 16 hex chars | First 16 chars |
| Audit output hash | Agent output string | 16 hex chars | First 16 chars |

**Why SHA-256?**

- **Deterministic**: Same input always produces same hash -- essential for verification on both sides of a message exchange.
- **Avalanche effect**: A single bit change in input produces a completely different hash -- detects even subtle message tampering.
- **Non-reversible**: Cannot reconstruct the original message from the hash -- protects sensitive trading data in audit logs.

#### 3. bcrypt (User Authentication -- Separate from NHI)

- **Algorithm**: bcrypt (Blowfish-based adaptive hash function)
- **Standard**: Based on the Blowfish cipher (Provos and Mazieres, 1999)
- **Purpose**: Human user password hashing (NOT used for agent identity)
- **Cost Factor**: Configurable (typically 10-12 rounds)
- **Salt**: 128-bit random salt auto-generated per hash

**Note**: bcrypt is used exclusively for human identity (NextAuth credentials provider). Agent NHI uses HMAC-SHA256. These are separate trust domains.

### Algorithm Comparison Matrix

| Algorithm | Type | Speed | Purpose in Platform | Trust Domain |
|-----------|------|-------|---------------------|-------------|
| HMAC-SHA256 | MAC | ~500ns | Agent identity proof | Machine-to-machine |
| SHA-256 | Hash | ~300ns | Payload integrity, audit hashing | Data integrity |
| bcrypt | KDF | ~100ms | User password hashing | Human-to-system |

### Cryptographic Library

All cryptographic operations use **Node.js built-in `crypto` module**, which wraps OpenSSL:

```typescript
import { createHmac, createHash } from 'crypto'
```

- No third-party cryptographic dependencies for agent identity
- OpenSSL provides FIPS-validated implementations
- `bcryptjs` (pure JavaScript bcrypt) is used separately for user auth
---

## Message Envelope Structure

### Envelope Fields

Every inter-agent message is wrapped in an envelope before transmission:

```typescript
interface MessageEnvelope {
  // Original payload from the sending agent
  query: string
  context: Record<string, unknown>

  // Envelope metadata (injected by message bus)
  _messageFrom: string        // Sender agent name (e.g., "researcher")
  _messageType: MessageType   // Enum: RESEARCH_COMPLETE, ANALYSIS_COMPLETE, etc.
  _identityToken: string      // HMAC-SHA256 signature (64 hex chars)
  _payloadHash: string        // SHA-256 of JSON-serialized payload (64 hex chars)
}
```

### Envelope Construction

```
Step 1: Serialize payload
  payloadString = JSON.stringify(payload)

Step 2: Hash payload
  payloadHash = SHA-256(payloadString)  ->  64 hex chars

Step 3: Derive agent signing key
  signingKey = AGENT_SECRET_KEY + ":" + fromAgentName

Step 4: Sign
  identityToken = HMAC-SHA256(signingKey, payloadHash)  ->  64 hex chars

Step 5: Attach to message
  message._messageFrom = fromAgentName
  message._messageType = messageType
  message._identityToken = identityToken
  message._payloadHash = payloadHash
```

### Envelope Verification

```
Step 1: Extract claims
  fromAgent    = message._messageFrom
  claimedHash  = message._payloadHash
  claimedToken = message._identityToken

Step 2: Recompute expected signature
  expectedToken = HMAC-SHA256(AGENT_SECRET_KEY + ":" + fromAgent, claimedHash)

Step 3: Compare (constant-time in production)
  if expectedToken !== claimedToken -> REJECT, log security event
  if expectedToken === claimedToken -> ACCEPT, deliver to recipient
```

---

## Key Derivation & Management

### Key Hierarchy

```
AGENT_SECRET_KEY (root secret, environment variable)
  |
  +-- AGENT_SECRET_KEY:researcher  ->  Researcher signing key
  +-- AGENT_SECRET_KEY:analyst     ->  Analyst signing key
  +-- AGENT_SECRET_KEY:advisor     ->  Advisor signing key
```

### Derivation Method

The current implementation uses **string concatenation** for key derivation:

```typescript
const signingKey = `:`
```

This is a simplified KDF suitable for the current single-process deployment. Each agent signing key is unique because the agent name is bound into the key material.

### Key Properties

| Property | Value |
|----------|-------|
| Root key source | `AGENT_SECRET_KEY` environment variable |
| Derivation | Concatenation: `rootKey:agentName` |
| Key uniqueness | Guaranteed by unique agent names |
| Key storage | Environment variable (never in code, never in git) |
| Key rotation | Rotate `AGENT_SECRET_KEY` -> all derived keys rotate |
| Default (dev only) | `default-dev-key` fallback for local development |

### Key Rotation Procedure

```
1. Generate new AGENT_SECRET_KEY (32+ bytes of cryptographic randomness)
   $ openssl rand -hex 32

2. Update environment variable
   $ export AGENT_SECRET_KEY="new-key-value"

3. Restart application
   -> All agents derive new signing keys
   -> All old signatures become invalid
   -> No migration needed (stateless per-message signing)
```

### Production Recommendations

For production deployments, the key derivation should be upgraded to **HKDF** (HMAC-based Key Derivation Function):

```
HKDF-SHA256:
  PRK      = HMAC-SHA256(salt, AGENT_SECRET_KEY)       // Extract
  agentKey = HMAC-SHA256(PRK, agentName || 0x01)       // Expand

Where:
  salt      = random 256-bit value, stored alongside the root key
  agentName = UTF-8 encoding of the agent identifier
  0x01      = single byte counter for the first derived key
```

- **Standard**: [RFC 5869](https://datatracker.ietf.org/doc/html/rfc5869)
- **Why**: HKDF provides formal security guarantees for key derivation that simple concatenation does not. It separates the "extract" phase (concentrating entropy) from the "expand" phase (generating multiple keys), making it resistant to related-key attacks.
---

## Verification Flow

### Complete Message Routing Sequence

```
                    +---------------------------------------------+
                    |              MESSAGE BUS (L7)                |
                    |                                              |
 Researcher         |  (1) Receive routeMessage(from,to,type,q,p) |
 Agent ------------>|  (2) Compute payloadHash = SHA-256(payload)  |
                    |  (3) Sign: token=HMAC-SHA256(key:from,hash)  |
                    |  (4) Inject _messageFrom, _messageType,      |
                    |      _identityToken, _payloadHash            |
                    |  (5) Log audit entry (action:message_routed) |       Analyst
                    |  (6) Call orchestrator.executeAgent(to, env) |------> Agent
                    |                                              |
                    +---------------------------------------------+
                                                                     |
                    +---------------------------------------------+  |
                    |              ORCHESTRATOR                    |  |
                    |                                              |<-+
                    |  (7) Lookup agent in registry                |
                    |  (8) L1: Check prompt injection on input     |
                    |  (9) L3: Verify agent has required tools     |
                    |  (10) Execute agent.execute(input)           |
                    |  (11) L5: Log audit with input/output hashes |
                    |  (12) Return AgentOutput with auditId        |
                    |                                              |
                    +---------------------------------------------+
```

### Verification Decision Matrix

| Condition | Action | Log Level |
|-----------|--------|-----------|
| Valid signature + valid payload hash | Deliver message | INFO |
| Invalid signature | Reject message, halt pipeline | CRITICAL |
| Valid signature + tampered payload | Reject (hash mismatch) | CRITICAL |
| Unknown sender agent | Reject (not in registry) | WARNING |
| Missing envelope fields | Reject (malformed message) | ERROR |

---

## Audit Trail & Integrity

### Audit Entry Structure

Every agent action, message routing, and security event generates an audit entry:

```typescript
{
  id: "uuid-v4",                    // Unique entry identifier
  agentName: "researcher",          // Acting agent
  action: "message_routed",         // What happened
  inputHash: "a3f2b1c4d5e6f7g8",   // SHA-256 of input (first 16 chars)
  outputHash: "h9i0j1k2l3m4n5o6",  // SHA-256 of output (first 16 chars)
  timestamp: 1711670400000,         // Unix epoch milliseconds
  durationMs: 1234,                 // Operation duration
  success: true,                    // Whether the operation succeeded
  error: undefined                  // Error message if failed
}
```

### Integrity Properties

1. **Hash Linkage**: Input and output hashes create a verifiable chain. Given the raw input, anyone can recompute `SHA-256(input).slice(0,16)` and compare against the audit log.

2. **Atomic Writes**: Audit entries are appended atomically to NDJSON files using `fs.appendFileSync()`, preventing partial writes or corruption from concurrent operations.

3. **Daily Segmentation**: Audit files are segmented by date (`data/audit/YYYY-MM-DD.ndjson`), enabling efficient retention policies and forensic analysis.

4. **Tamper Detection**: Because each entry includes SHA-256 hashes of inputs and outputs, any modification to historical data would produce mismatched hashes during forensic review.

### Audit Actions

| Action | Trigger | MAESTRO Layer |
|--------|---------|---------------|
| `execute` | Agent completes work | L5 |
| `blocked_injection` | Prompt injection detected | L1 |
| `message_routed` | Inter-agent message sent | L7 |
| `verification_failed` | Identity token mismatch | L7 |
| `rate_limited` | API rate limit exceeded | L4 |
| `guardrail_blocked` | Trade guardrail triggered | L3 |