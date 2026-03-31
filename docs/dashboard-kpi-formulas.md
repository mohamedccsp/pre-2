# Dashboard KPI Formulas and Data Definitions

## Purpose

This document defines the canonical formulas, data sources, and aggregation rules for all dashboard KPIs.
It ensures metrics are computed consistently across pages, filters, and chart views.

Use this as the single source of truth for:
- KPI cards
- chart calculations
- model and autonomy comparisons
- alert thresholds

---

## Scope and Data Sources

Primary data sources in current platform:

- `recommendations` (agent decisions and lifecycle)
- `virtual_trades` (executed trade records)
- `virtual_portfolio` (cash balance baseline)
- `autonomous_cycles` (cycle-level operational outcomes)
- audit logs (`data/audit/*.ndjson`) for execution reliability and latency

---

## Global Conventions

## Time standards
- All timestamps are Unix epoch milliseconds.
- Aggregate internally in UTC.
- UI can render local timezone, but formula windows stay UTC-consistent.

## Filtering dimensions
Every metric should support:
- time range (`24H`, `7D`, `30D`, `90D`, `YTD`, `ALL`)
- aggregation granularity (`hourly`, `daily`, `weekly`)
- scope: `all`, `coin`, `agent`, `mode` (manual/HITL/autonomous)

## Null/empty handling
- Use `0` for count metrics when no rows.
- Use `null` for undefined ratios (e.g., divide-by-zero), then show `--` in UI.
- Never silently coerce undefined denominator to 1.

## Currency/percent
- USD fields displayed with 2 decimals.
- Percentage fields stored as fractions in formulas but displayed as `%`.

---

## Base Derived Sets

Define these reusable filtered sets (pseudo-SQL names):

- `R`: recommendations in selected window
- `T`: virtual_trades in selected window
- `C`: autonomous_cycles in selected window
- `A`: audit entries in selected window

Subsets:
- `R_pending`, `R_approved`, `R_rejected`, `R_executed`, `R_expired`
- `T_buy`, `T_sell`
- `C_success` = cycles without error
- `C_failed` = cycles with error not null
- `A_success` / `A_fail` by `success` flag

---

## Portfolio and Performance KPIs

## 1) Current Equity
Definition:
`equity_now = cash_balance_now + mark_to_market_value_of_holdings_now`

Source:
- cash: `virtual_portfolio.balanceUsd`
- holdings: aggregate from trade history + current market prices

## 2) Cumulative Return %
Formula:
`cum_return_pct = (equity_now - initial_equity) / initial_equity * 100`

Source:
- initial_equity: `virtual_portfolio.initialBalanceUsd`

## 3) Period Return %
For selected window `[t0, t1]`:
`period_return_pct = (equity_t1 - equity_t0) / equity_t0 * 100`

## 4) Daily PnL
`daily_pnl(d) = equity_end_of_day(d) - equity_end_of_day(d-1)`

## 5) Win Rate %
Using closed-trade outcome logic used by platform:
`win_rate_pct = winning_trades / total_closed_trades * 100`

If closed-trade attribution is simplified to trade-level realized delta:
`winning_trades = count(trade_pnl > 0)`

## 6) Profit Factor
`profit_factor = gross_profit / abs(gross_loss)`

Where:
- `gross_profit = sum(trade_pnl where trade_pnl > 0)`
- `gross_loss = sum(trade_pnl where trade_pnl < 0)`

## 7) Expectancy (per trade)
`expectancy = (win_rate * avg_win) - ((1 - win_rate) * avg_loss_abs)`

---

## Risk KPIs

## 8) Rolling Peak Equity
For each time point `t`:
`rolling_peak(t) = max(equity_series[0..t])`

## 9) Drawdown %
`drawdown_pct(t) = (equity_t - rolling_peak_t) / rolling_peak_t * 100`

## 10) Max Drawdown %
`max_drawdown_pct = min(drawdown_pct(t))` over selected window

## 11) Exposure %
`exposure_pct = notional_open_exposure / equity_now * 100`

## 12) Concentration %
Top coin concentration:
`top_coin_concentration_pct = max(coin_exposure_usd) / total_exposure_usd * 100`

## 13) Loss Streak
Longest consecutive sequence of negative trade outcomes in window.

---

## Recommendation Funnel KPIs

## 14) Recommendation Volume
`recommendation_count = count(R)`

## 15) Execution Conversion %
`execution_conversion_pct = count(R_executed) / count(R) * 100`

## 16) Rejection Rate %
`rejection_rate_pct = count(R_rejected) / count(R) * 100`

## 17) Expiry Rate %
`expiry_rate_pct = count(R_expired) / count(R) * 100`

## 18) Median Time to Execute
`median_execution_lag_ms = median(R.executedAt - R.createdAt where status='executed')`

---

## Analyst KPIs

## 19) Action Mix %
For each action in `{buy, sell, hold}`:
`action_mix_pct[action] = count(R where action=action) / count(R) * 100`

## 20) Average Confidence
`avg_confidence = avg(R.confidence)`

## 21) Confidence Std Dev
`confidence_std = stddev(R.confidence)`

## 22) Confidence Bucket Distribution
Buckets:
- `0-39`
- `40-59`
- `60-79`
- `80-100`

`bucket_share = count(R in bucket) / count(R) * 100`

## 23) Calibration by Bucket
For each bucket `b`:
`calibration_return_b = avg(forward_return_horizon of executed recs in bucket b)`

Calibration quality score (optional):
Spearman/Pearson correlation between bucket midpoint and forward return.

## 24) Decision Flip Rate
For same coin and short lookback (e.g., 3 cycles):
`flip_rate = directional_flips / directional_decisions`

Directional set excludes `hold` unless explicitly configured.

---

## Advisor KPIs

## 25) Suggested Size % (recommendation-level)
`size_pct = suggestedAmountUsd / virtual_balance_at_recommendation * 100`

## 26) Zero-Size Rate
`zero_size_rate_pct = count(R where suggestedAmountUsd=0) / count(R) * 100`

## 27) Risk Level Mix
For each level in `{low, medium, high}`:
`risk_mix_pct[level] = count(R where riskLevel=level) / count(R) * 100`

## 28) Cap-Hit Rate
Near cap threshold (default 20%):
`cap_hit_rate_pct = count(size_pct >= cap_pct * near_cap_factor) / count(R_non_hold) * 100`

Suggested `near_cap_factor = 0.95`.

## 29) Confidence-Size Consistency
`corr_conf_size = correlation(R.confidence, size_pct)` for non-hold recommendations

---

## Executor KPIs

## 30) Execution Count
`execution_count = count(T)`

## 31) Execution Notional
`execution_notional_usd = sum(T.amountUsd)`

## 32) Avg Execution Latency
`avg_exec_latency_ms = avg(T.executedAt - recommendation.createdAt)`

## 33) Slippage Proxy %
`slippage_pct = (priceAtExecution - recommendation.currentPrice) / recommendation.currentPrice * 100`

For sells/buys, you may also report signed and absolute versions.

## 34) Fill Ratio
`fill_ratio = executed_amount_usd / suggested_amount_usd`

In current flow (clamped execution), this may be <= 1.

---

## Autonomous Cycle KPIs

## 35) Cycle Count
`cycle_count = count(C)`

## 36) Cycle Success Rate
`cycle_success_rate_pct = count(C_success) / count(C) * 100`

## 37) Trades per Cycle
`trades_per_cycle = sum(C.tradesExecuted) / count(C)`

## 38) Skip Ratio
`skip_ratio_pct = sum(C.tradesSkipped) / (sum(C.tradesExecuted) + sum(C.tradesSkipped)) * 100`

## 39) Average Cycle Duration
`avg_cycle_duration_ms = avg(C.completedAt - C.startedAt where completedAt not null)`

## 40) P95 Cycle Duration
`p95_cycle_duration_ms = percentile_95(C.completedAt - C.startedAt)`

## 41) Daily Loss Trip Rate
`daily_loss_trip_rate_pct = count(C where dailyLossTripped=true) / count(C) * 100`

## 42) Kill Switch Trip Rate
`kill_switch_trip_rate_pct = count(C where killSwitchTripped=true) / count(C) * 100`

---

## Guardrail KPIs

Derive from cycle `summaryJson` skip reasons and cycle flags.

## 43) Guardrail Intervention Rate
`intervention_rate_pct = guardrail_blocked_trade_attempts / total_trade_attempts * 100`

## 44) Skip Reason Share
For each reason:
`skip_reason_share_pct[reason] = count(skips with reason) / total_skips * 100`

## 45) Threshold Proximity Rate (optional advanced)
Define proximity threshold (e.g., 10% distance to limit):
`near_threshold_rate = near_threshold_events / total_events * 100`

---

## Reliability and Observability KPIs (Audit)

From audit entries (`A`):

## 46) Agent Success Rate
Per agent:
`agent_success_rate_pct = count(A_success where agent=...) / count(A where agent=...) * 100`

## 47) Agent Error Rate
`agent_error_rate_pct = 100 - agent_success_rate_pct`

## 48) Average and P95 Duration
- `avg_duration_ms = avg(A.durationMs)`
- `p95_duration_ms = percentile_95(A.durationMs)`

## 49) Routed Message Integrity Failures
Count orchestrator identity verification errors if tracked in audit errors.

---

## Scalability and Cost KPIs

## 50) Throughput
- `cycles_per_hour`
- `trades_per_hour`

## 51) Cost per Cycle
`cost_per_cycle = total_inference_and_api_cost / cycle_count`

## 52) Cost per Executed Trade
`cost_per_executed_trade = total_inference_and_api_cost / execution_count`

## 53) Cost per Profitable Trade
`cost_per_profitable_trade = total_inference_and_api_cost / winning_trades`

If direct cost telemetry not yet captured, mark as planned metric.

---

## Model Evaluation KPIs

Per model and per agent:

## 54) JSON Validity %
`json_validity_pct = valid_structured_outputs / total_structured_outputs * 100`

## 55) Schema Compliance %
Strict compliance to required keys and value ranges.

## 56) Calibration Score
Correlation between confidence and forward return (or binned monotonicity score).

## 57) Stability Score
Repeated-run consistency for same input set.

---

## Chart Type Mapping (KPI -> storytelling visual)

- Equity + Drawdown -> line + area combo
- Funnel metrics -> funnel chart
- Distribution metrics -> histogram/box plot
- Composition metrics -> stacked bar/stacked area/donut
- Calibration -> line or scatter with trend
- Intervention trends -> control chart
- Incident streams -> timeline

---

## Alert Threshold Framework (recommended defaults)

Use these as initial dashboard alerts; tune after live behavior:

- max_drawdown_24h <= -5% => warning
- max_drawdown_24h <= -8% => critical
- cycle_success_rate < 95% => warning
- cycle_success_rate < 90% => critical
- guardrail_intervention_rate > 40% => warning
- analyst_json_validity < 99% => warning
- advisor_zero_size_rate > 60% => review sizing policy
- kill_switch_trips >= 1 in 24h => critical incident

---

## Versioning and Governance

- Version this formula file (`v1.0`, `v1.1`, ...)
- Any metric formula change must:
  1. update this document
  2. update KPI computation code/tests
  3. note migration impact in release notes

---

## Implementation Notes for Feature Dev

When implementing via feature-dev and frontend-design:

1. Centralize KPI formulas in metric utility modules.
2. Use a shared filter state model across all pages.
3. Keep formula implementation deterministic and testable.
4. Add unit tests for all ratio and drawdown calculations.
5. Keep chart axis/aggregation semantics consistent across pages.
