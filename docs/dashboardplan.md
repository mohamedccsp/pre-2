# Dashboard Implementation Plan: Performance + Full Autonomy Safety + Scalability

## Goal

Build a multi-page dashboard for CryptoMAESTRO that supports:

1. Performance tracking (portfolio and strategy outcomes)
2. Full autonomy safety monitoring (guardrails, incidents, interventions)
3. Scalability control (cycle throughput, latency, reliability, cost)
4. Storytelling-based visual analytics for decision-making
5. Brand consistency with existing product theme and color system

This plan is intended to be implemented with the feature-dev plugin and should explicitly leverage the frontend-design plugin for UI system quality and visual consistency.

---

## Plugin Execution Requirement

### Required plugins

- feature-dev: implementation workflow, task decomposition, code integration, testing
- frontend-design: visual system, layout hierarchy, chart aesthetics, responsive behavior, interaction quality

### Instruction to implementation agent

Use feature-dev as the primary execution plugin and invoke frontend-design for all dashboard layout and component styling tasks to ensure high-quality branded UI.

---

## Existing Brand and Design Constraints (must follow)

Use the current visual identity defined in `app/globals.css` and related components.

### Core palette tokens (existing)

- Primary: `--color-primary: #00d4ff` (cyan)
- Success: `--color-success: #00ff88` (green)
- Destructive: `--color-destructive: #ff3b5c` (red)
- Warning: `--color-warning: #ffa726` (amber)
- Agent colors:
  - Researcher: `--color-agent-researcher: #00d4ff`
  - Analyst: `--color-agent-analyst: #a855f7`
  - Advisor: `--color-agent-advisor: #f59e0b`
  - Executor: `--color-agent-executor: #ff3b5c`
  - Orchestrator: `--color-agent-orchestrator: #00ff88`

### Typography and style

- Display font: Orbitron
- Sans: Exo 2
- Mono: JetBrains Mono
- Neon accents, subtle glow, futuristic card styling
- Dark/light mode parity must be maintained

### UI consistency requirements

- Reuse existing card language and neon accents
- Reuse navigation style patterns from `components/navbar.tsx`
- Avoid introducing a conflicting chart color palette
- Chart colors must map to semantic + agent token colors

---

## Navigation Order (must be implemented exactly)

1. `/dashboard/overview`
2. `/dashboard/risk`
3. `/dashboard/performance`
4. `/dashboard/autonomy/cycles`
5. `/dashboard/autonomy/guardrails`
6. `/dashboard/agents/researcher`
7. `/dashboard/agents/analyst`
8. `/dashboard/agents/advisor`
9. `/dashboard/agents/executor`
10. `/dashboard/scalability`
11. `/dashboard/model-evals`

This order tells the right story:
Safety -> Performance -> Autonomy behavior -> Agent quality -> Scalability -> Model optimization

---

## Information Architecture and Page Specs

## 1) Overview page (`/dashboard/overview`)

### Purpose
Single-screen control center for executive health.

### KPI cards
- Current portfolio value
- Cumulative return %
- Rolling max drawdown
- Cycle success rate
- Guardrail intervention rate
- Kill-switch status

### Charts
- Equity curve + drawdown overlay (line + area)
- Interventions over time (stacked column)
- 24h/7d/30d summary sparkline row

---

## 2) Risk page (`/dashboard/risk`)

### Purpose
Primary risk governance panel for autonomous mode.

### KPIs
- Max DD (24h, 7d, 30d)
- Loss streak
- Exposure % of portfolio
- Concentration (top coin exposure share)
- Daily loss threshold proximity

### Charts
- Drawdown curve
- Exposure heatmap by hour/day
- Concentration treemap
- Threshold proximity histogram

---

## 3) Performance page (`/dashboard/performance`)

### Purpose
Outcome truth: profitability and quality of returns.

### KPIs
- Daily/weekly/monthly PnL
- Win rate
- Profit factor
- Average return per trade
- Expectancy

### Charts
- Cumulative PnL line
- Daily PnL bars
- Returns distribution histogram
- PnL by coin horizontal bar

---

## 4) Autonomous Cycles page (`/dashboard/autonomy/cycles`)

### Purpose
Monitor cycle throughput and reliability as cycle count increases.

### KPIs
- Cycles/hour and cycles/day
- Cycle duration p50/p95
- Executed vs skipped vs failed
- Average trades per cycle

### Charts
- Throughput trend line
- Stacked cycle outcome bars
- Cycle duration box plot

---

## 5) Guardrails page (`/dashboard/autonomy/guardrails`)

### Purpose
Safety intervention intelligence and scaling gate.

### KPIs
- Skip reasons breakdown
- Daily loss limit trips
- Cooldown blocks
- Trade-limit blocks
- Kill-switch events

### Charts
- Horizontal bar (skip reasons)
- Control chart (intervention rate over time)
- Incident timeline
- Rule-by-rule block rate trend

---

## 6) Researcher page (`/dashboard/agents/researcher`)

### KPIs
- Request count
- Success rate
- Latency p50/p95
- Query-type distribution (coin/comparison/market)

### Charts
- Requests over time
- Success/failure stacked bars
- Query type donut
- Latency trend line

---

## 7) Analyst page (`/dashboard/agents/analyst`)

### KPIs
- Buy/sell/hold ratio
- Confidence mean/std
- Confidence bucket outcome quality
- Decision flip rate

### Charts
- Action mix stacked area
- Confidence distribution histogram
- Calibration chart (confidence bucket vs realized return)
- Flip-rate heatmap by coin/time

---

## 8) Advisor page (`/dashboard/agents/advisor`)

### KPIs
- Suggested size distribution
- Risk level mix
- Zero-size recommendation rate
- Cap-hit rate (near 20%)

### Charts
- Size histogram
- Confidence vs size scatter with trendline
- Risk-level stacked bars
- Bucketed size-by-confidence bar chart

---

## 9) Executor page (`/dashboard/agents/executor`)

### KPIs
- Execution latency
- Slippage proxy
- Fill ratio
- Execution error rate

### Charts
- Slippage box plot by coin
- Latency trend
- Error reason bars
- Fill ratio distribution

---

## 10) Scalability page (`/dashboard/scalability`)

### KPIs
- Cost per cycle
- Cost per profitable trade
- Agent latency p95 by stage
- Error rate by subsystem

### Charts
- Dual-axis cost vs PnL
- Multi-line latency by agent
- Error trend stacked columns
- Capacity utilization gauge

---

## 11) Model Evaluations page (`/dashboard/model-evals`)

### KPIs
- JSON validity by model
- Confidence calibration score
- Risk-adjusted return score
- Model stability score

### Charts
- Model leaderboard table
- Radar comparison chart
- Calibration curves per model
- A/B outcome comparison bars

---

## Data View Options (must exist across charts)

Every chart component should support:

- Time range: `24H`, `7D`, `30D`, `90D`, `YTD`, `ALL`
- Aggregation: `hourly`, `daily`, `weekly`
- Split/group dimensions:
  - by coin
  - by agent
  - by strategy mode (manual/HITL/autonomous)
- Display modes:
  - absolute vs normalized
  - linear vs log scale (where relevant)
  - cumulative vs period return
- Compare mode:
  - current period vs previous period
  - model A vs model B
- Export mode:
  - PNG (chart snapshot)
  - CSV (underlying data)

---

## Storytelling Rules for Visualization

1. Start every page with 4-6 top KPI cards.
2. Follow with one primary narrative chart (main story).
3. Then add diagnostic charts that explain why.
4. End with a drill-down table for exact records.
5. Use consistent semantic colors:
   - positive = success green
   - risk/negative = destructive red
   - warnings = amber
   - neutral/system = cyan/foreground muted
6. Include plain-language chart subtitles that interpret the trend.

---

## Data Sources and Mapping (current platform)

Use existing sources first:

- `recommendations` table
- `virtual_trades` table
- `virtual_portfolio` table
- `autonomous_cycles` table
- audit entries from `data/audit/*.ndjson` via logger utilities

If needed, add derived views/materialized aggregates for performance.

---

## Delivery Phases

## Phase 1: Foundation + IA
- Add dashboard route group and sidebar navigation in required order
- Shared chart wrapper and KPI card components
- Theme token mapping for charts

## Phase 2: Core pages
- Build `overview`, `risk`, `performance`
- Add reusable filters (time range, aggregation, compare mode)

## Phase 3: Autonomy safety pages
- Build `autonomy/cycles` and `autonomy/guardrails`
- Add incident timeline and intervention control chart

## Phase 4: Agent pages
- Build researcher/analyst/advisor/executor pages
- Add per-agent diagnostics and calibration visuals

## Phase 5: Scalability + model eval pages
- Build `scalability` and `model-evals`
- Add leaderboard and A/B compare patterns

## Phase 6: Validation and polish
- Accessibility checks
- dark/light QA
- responsive QA
- performance optimization

---

## Technical Implementation Notes

- Use server-side data loaders for heavy aggregates
- Cache expensive metric queries
- Keep chart components composable and typed
- Ensure all KPI calculations are centralized in metric utilities
- Add loading skeletons and graceful empty states
- Use existing animation style subtly (avoid noisy motion)

---

## Acceptance Criteria

1. Navigation order matches required sequence exactly.
2. All pages follow existing CryptoMAESTRO branding and token colors.
3. Each page contains KPI cards + primary narrative chart + diagnostics.
4. Charts provide the required data-view options.
5. Risk/autonomy pages clearly surface safety constraints and incidents.
6. Agent pages clearly explain quality and behavior per agent.
7. Dashboard remains usable in dark and light modes.
8. Data pipeline supports reliable refresh without blocking UI.

---

## Explicit Instruction for Implementation Agent

Implement this plan using feature-dev and invoke frontend-design for:
- component layout hierarchy
- chart theming and visual storytelling
- responsive behavior
- polished production-grade UI interactions

Do not ship generic dashboard styling; maintain CryptoMAESTRO futuristic neon brand language and semantic color integrity.
