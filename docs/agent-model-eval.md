# Agent Model Evaluation Playbook

## Purpose

This file provides a practical framework to benchmark different models per agent (`researcher`, `analyst`, `advisor`) and pick the best model for each role.

Use this with paper trading only.

---

## What to Measure

Evaluate each agent separately, then evaluate end-to-end behavior.

### Researcher metrics

- grounding score (does output reference provided numbers?)
- factual consistency (no invented metrics)
- clarity/compression (useful summary without fluff)
- neutral framing quality (bullish and bearish balance)

### Analyst metrics

- JSON validity rate
- action distribution (`buy/sell/hold`) by scenario type
- confidence calibration (higher confidence should correlate with better forward outcome)
- rationale quality (uses strongest indicators, not random statements)
- decision stability (same input should not flip wildly across runs)

### Advisor metrics

- JSON validity rate
- size-discipline score (within expected confidence/risk bands)
- risk-label consistency
- sensitivity to confidence changes
- tendency to over-zero sizing

### End-to-end metrics

- trades/day
- hold rate
- average suggested size
- win rate
- average return/trade
- max drawdown
- Sharpe-like risk-adjusted score (optional)
- guardrail rejection rate

---

## Test Set Design

Build a fixed evaluation set with labeled market states. Reuse the exact same set for all model candidates.

### Minimum recommended size

- 20 scenarios per state (minimum)
- 4 states:
  - clear bullish trend
  - clear bearish trend
  - choppy/sideways
  - mixed or contradictory signals

Total minimum: 80 scenarios.

### Scenario schema (template)

```json
{
  "id": "case-001",
  "coinId": "bitcoin",
  "stateTag": "bullish",
  "input": {
    "researchQuery": "Analyze bitcoin for trading",
    "researchContext": "...",
    "indicators": {
      "rsi14": 38.2,
      "sma20": 92000.0,
      "sma50": 90500.0,
      "priceAtAnalysis": 92500.0,
      "priceChange7d": 6.1,
      "priceChange30d": 12.7,
      "avgVolume7d": 15400000000.0,
      "currentVolume": 18900000000.0
    },
    "virtualBalance": 10000,
    "currentPrice": 92500.0
  },
  "futureWindow": {
    "horizonHours": 24,
    "priceAfterHorizon": 94120.0
  }
}
```

---

## Candidate Matrix

Create a matrix of candidate models per agent.

Example format:

| Agent | Candidate A | Candidate B | Candidate C |
|---|---|---|---|
| Researcher | model-x-fast | model-y-balanced | model-z-accurate |
| Analyst | model-x-fast | model-y-reasoning | model-z-accurate |
| Advisor | model-x-fast | model-y-rules | model-z-accurate |

Do not tune all three agents at once initially. Tune one agent at a time while others stay fixed.

---

## Evaluation Procedure

## Phase 1: single-agent quality tests

### 1) Researcher only

- Keep analyst/advisor fixed.
- Run all scenarios and score researcher output for grounding and consistency.
- Eliminate models with low grounding or high hallucination.

### 2) Analyst only

- Fix researcher/advisor.
- Run all scenarios.
- Score JSON validity, action quality, confidence calibration, and stability.
- Eliminate models with weak schema compliance or very high hold bias.

### 3) Advisor only

- Fix researcher/analyst.
- Run all scenarios.
- Score risk/size consistency and sizing quality.
- Eliminate models that collapse to zero too often or oversize.

## Phase 2: combined top candidates

Run top 2-3 combinations end-to-end in paper simulation:

- compare PnL and drawdown
- compare trade frequency and guardrail interactions
- compare stability day to day

Choose combination based on risk-adjusted outcomes, not just raw returns.

---

## Scoring Rubric

Use weighted scoring to avoid over-optimizing one metric.

Suggested weights:

- 30% safety/compliance
  - JSON validity
  - guardrail compatibility
  - no invalid outputs
- 30% decision quality
  - confidence calibration
  - action quality in labeled states
- 25% outcome quality
  - return/trade
  - drawdown control
- 15% operational quality
  - latency
  - token/cost efficiency

Total score out of 100.

---

## Agent-Specific Expected Behaviors

Use these to detect model mismatch quickly.

### Researcher expected behavior

- cites concrete metrics from provided context
- does not invent data fields
- stays neutral and concise

### Analyst expected behavior

- returns valid JSON every time
- does not always default to hold in directional setups
- confidence increases with stronger indicator alignment

### Advisor expected behavior

- returns valid JSON every time
- risk level maps logically to setup quality
- size stays within policy and scales with confidence

---

## Prompt and Temperature Tuning Guidance

Keep prompts role-specific and explicit.

Starting ranges:

- Researcher: `temperature 0.2-0.4`
- Analyst: `temperature 0.3-0.45`
- Advisor: `temperature 0.2-0.35`

Rules:

- If JSON breaks: lower temperature and tighten schema language.
- If output is too repetitive/flat: slightly increase temperature.
- If hold rate is too high: reduce conservative language and add directional rubric.
- If drawdown rises: tighten confidence floor and size rules in deterministic guardrails.

---

## Logging and Traceability Requirements

For each run, capture:

- model name and version
- full prompt template version
- temperature, max tokens
- input scenario id
- raw LLM output
- parsed output
- guardrail outcomes
- execution outcome

Store in a table or JSONL so results are reproducible.

---

## Suggested Result Tables

### Table A: analyst quality

| Model | JSON valid % | Hold rate % | Avg confidence | Calibration score | Notes |
|---|---:|---:|---:|---:|---|
| model-1 | 99.5 | 62 | 44.1 | 0.58 | too conservative |
| model-2 | 100.0 | 41 | 57.6 | 0.71 | balanced |

### Table B: advisor quality

| Model | JSON valid % | Avg size % | Zero-size % | Risk consistency | Notes |
|---|---:|---:|---:|---:|---|
| model-1 | 100.0 | 3.2 | 54 | 0.69 | over-zeroing |
| model-2 | 100.0 | 6.8 | 29 | 0.78 | better scaling |

### Table C: end-to-end paper outcomes

| Combo (R/A/Adv) | Trades | Win rate % | Avg return % | Max drawdown % | Total score |
|---|---:|---:|---:|---:|---:|
| C1 | 48 | 54.2 | 0.84 | 6.9 | 78.3 |
| C2 | 61 | 51.0 | 0.80 | 9.8 | 72.6 |

---

## Decision Template

Use this template when finalizing model assignment:

- Researcher model:
  - chosen:
  - reason:
  - tradeoff accepted:
- Analyst model:
  - chosen:
  - reason:
  - tradeoff accepted:
- Advisor model:
  - chosen:
  - reason:
  - tradeoff accepted:
- Final chain combination:
  - chosen:
  - reason:
  - expected impact:

---

## Rollout Plan

1. Shadow mode
   - New model outputs logged, old model still drives decisions.
2. Partial rollout
   - Small user segment or paper-only for 1-2 weeks.
3. Full rollout
   - Monitor drawdown, hold rate, and sizing drift daily.
4. Rollback criteria
   - Trigger rollback if drawdown, schema failure, or guardrail errors exceed threshold.

---

## Common Failure Patterns and Fixes

### Failure: analyst always returns hold

- reduce conservative prompt wording
- increase analyst temperature slightly
- add explicit buy/sell rubric

### Failure: advisor often outputs 0 size

- remove hard zero rules except for `hold`
- use confidence bands instead of binary cutoffs
- keep deterministic trade-size cap in code

### Failure: inconsistent risk labels

- define deterministic risk rubric in prompt
- lower advisor temperature
- add examples in prompt if needed

### Failure: JSON formatting breaks

- repeat exact schema once
- tighten "JSON only" instruction
- lower temperature and test again

---

## Minimal Weekly Review Checklist

- compare this week vs last week:
  - hold rate
  - trade frequency
  - average confidence
  - average position size
  - realized PnL and drawdown
- inspect 10 random trades:
  - did reasoning match indicators?
  - did size match risk/confidence?
- decide:
  - keep
  - retune prompt
  - retune temperature
  - switch model
