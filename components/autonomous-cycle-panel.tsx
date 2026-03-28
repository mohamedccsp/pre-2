'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRecommendationsStore } from '@/stores/recommendations-store';
import { authFetch } from '@/lib/auth-fetch';
import { cn, formatCurrency } from '@/lib/utils';
import {
  Zap, Loader2, AlertTriangle, Shield, ShieldOff, Settings, Play,
  CheckCircle2, XCircle, Clock, TriangleAlert,
} from 'lucide-react';
import { AUTONOMOUS_DEFAULTS } from '@/lib/maestro/guardrails';
import type { AutonomousConfig } from '@/lib/autonomous/config-repository';
import type { CycleResult } from '@/lib/autonomous/cycle';

/**
 * Autonomous trading control panel — Level 3 autonomy UI
 * Embedded on the recommendations page
 */
export default function AutonomousCyclePanel() {
  const { isRunningCycle, cycleResult, cycleError, runAutonomousCycle, clearCycleError } =
    useRecommendationsStore();

  const [config, setConfig] = useState<AutonomousConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [riskWarnings, setRiskWarnings] = useState<string[]>([]);
  const [pendingPatch, setPendingPatch] = useState<Record<string, number> | null>(null);

  // Editable config fields
  const [editMaxTradePct, setEditMaxTradePct] = useState('10');
  const [editMaxTradesPerDay, setEditMaxTradesPerDay] = useState('5');
  const [editCooldownMinutes, setEditCooldownMinutes] = useState('30');
  const [editDailyLossLimitPct, setEditDailyLossLimitPct] = useState('15');

  /**
   * Fetch current config from server
   */
  const fetchConfig = useCallback(async () => {
    try {
      const response = await authFetch('/api/agents/autonomous/config');
      if (!response.ok) return;
      const data = await response.json() as AutonomousConfig;
      setConfig(data);
      setEditMaxTradePct(String(Math.round(data.maxTradePct * 100)));
      setEditMaxTradesPerDay(String(data.maxTradesPerDay));
      setEditCooldownMinutes(String(data.cooldownMinutes));
      setEditDailyLossLimitPct(String(Math.round(data.dailyLossLimitPct * 100)));
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  /**
   * Toggle the kill switch with confirmation
   */
  const handleKillSwitch = async () => {
    if (!config) return;
    const newState = !config.killSwitchActive;
    const message = newState
      ? 'Activate kill switch? This will prevent any autonomous trades from executing.'
      : 'Deactivate kill switch? The autonomous cycle will be allowed to execute trades again.';
    if (!window.confirm(message)) return;

    try {
      const response = await authFetch('/api/agents/autonomous/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ killSwitchActive: newState }),
      });
      if (response.ok) {
        const updated = await response.json() as AutonomousConfig;
        setConfig(updated);
      }
    } catch { /* swallow — UI stays stale, next fetch corrects */ }
  };

  /**
   * Build the config patch from current edit fields
   * @returns Config values ready for API
   */
  const buildPatch = () => ({
    maxTradePct: Math.max(1, Math.min(50, parseInt(editMaxTradePct, 10) || 10)) / 100,
    maxTradesPerDay: Math.max(1, Math.min(50, parseInt(editMaxTradesPerDay, 10) || 5)),
    cooldownMinutes: Math.max(0, Math.min(1440, parseInt(editCooldownMinutes, 10) || 30)),
    dailyLossLimitPct: Math.max(1, Math.min(50, parseInt(editDailyLossLimitPct, 10) || 15)) / 100,
  });

  /**
   * Check if settings deviate from defaults and collect risk warnings
   * @param patch - The config values to check
   * @returns Array of risk warning strings (empty if no deviations)
   */
  const detectRisks = (patch: ReturnType<typeof buildPatch>): string[] => {
    const warnings: string[] = [];
    if (patch.maxTradePct > AUTONOMOUS_DEFAULTS.maxTradePct) {
      warnings.push(
        `Max trade size increased to ${Math.round(patch.maxTradePct * 100)}% (default ${Math.round(AUTONOMOUS_DEFAULTS.maxTradePct * 100)}%). Larger positions amplify both gains and losses per trade.`
      );
    }
    if (patch.maxTradesPerDay > AUTONOMOUS_DEFAULTS.maxTradesPerDay) {
      warnings.push(
        `Daily trade limit raised to ${patch.maxTradesPerDay} (default ${AUTONOMOUS_DEFAULTS.maxTradesPerDay}). More trades increase exposure and potential cumulative losses.`
      );
    }
    if (patch.cooldownMinutes < AUTONOMOUS_DEFAULTS.cooldownMinutes) {
      warnings.push(
        `Cooldown reduced to ${patch.cooldownMinutes}min (default ${AUTONOMOUS_DEFAULTS.cooldownMinutes}min). Shorter cooldowns allow rapid re-trading of the same coin.`
      );
    }
    if (patch.dailyLossLimitPct > AUTONOMOUS_DEFAULTS.dailyLossLimitPct) {
      warnings.push(
        `Daily loss limit raised to ${Math.round(patch.dailyLossLimitPct * 100)}% (default ${Math.round(AUTONOMOUS_DEFAULTS.dailyLossLimitPct * 100)}%). A higher limit means the system tolerates larger portfolio drawdowns before stopping.`
      );
    }
    return warnings;
  };

  /**
   * Validate settings and either save directly or show risk warning
   */
  const handleSaveConfig = () => {
    const patch = buildPatch();
    const warnings = detectRisks(patch);

    if (warnings.length > 0) {
      setRiskWarnings(warnings);
      setPendingPatch(patch);
      return; // Wait for user to accept
    }

    // No deviations from defaults — save directly
    submitConfig(patch);
  };

  /**
   * Actually persist the config to the server
   * @param patch - Validated config values to save
   */
  const submitConfig = async (patch: Record<string, number>) => {
    setIsSaving(true);
    setRiskWarnings([]);
    setPendingPatch(null);
    try {
      const response = await authFetch('/api/agents/autonomous/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (response.ok) {
        const updated = await response.json() as AutonomousConfig;
        setConfig(updated);
        setShowSettings(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Dismiss the risk warning without saving
   */
  const dismissRiskWarning = () => {
    setRiskWarnings([]);
    setPendingPatch(null);
  };

  if (configLoading) {
    return (
      <div className="mb-6 rounded-lg border border-border bg-card p-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-48" />
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-lg border border-primary/20 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <span className="font-semibold">Autonomous Trading</span>
          <span className="text-[10px] font-medium uppercase rounded-full border border-primary/30 px-2 py-0.5 text-primary">
            Level 3
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="rounded-lg border border-border p-1.5 hover:bg-muted transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </button>
          <button
            onClick={handleKillSwitch}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              config?.killSwitchActive
                ? 'bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20'
                : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/20'
            )}
          >
            {config?.killSwitchActive ? (
              <><ShieldOff className="h-3.5 w-3.5" /> Kill Switch ON</>
            ) : (
              <><Shield className="h-3.5 w-3.5" /> Kill Switch OFF</>
            )}
          </button>
        </div>
      </div>

      {/* Config summary */}
      {config && !showSettings && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-4 pb-3">
          <div className="rounded bg-muted/50 p-2 text-center">
            <div className="text-[10px] text-muted-foreground uppercase">Max Trade</div>
            <div className="text-sm font-mono">{Math.round(config.maxTradePct * 100)}%</div>
          </div>
          <div className="rounded bg-muted/50 p-2 text-center">
            <div className="text-[10px] text-muted-foreground uppercase">Trades/Day</div>
            <div className="text-sm font-mono">{config.maxTradesPerDay}</div>
          </div>
          <div className="rounded bg-muted/50 p-2 text-center">
            <div className="text-[10px] text-muted-foreground uppercase">Cooldown</div>
            <div className="text-sm font-mono">{config.cooldownMinutes}m</div>
          </div>
          <div className="rounded bg-muted/50 p-2 text-center">
            <div className="text-[10px] text-muted-foreground uppercase">Loss Limit</div>
            <div className="text-sm font-mono">{Math.round(config.dailyLossLimitPct * 100)}%</div>
          </div>
        </div>
      )}

      {/* Settings editor */}
      {showSettings && (
        <div className="p-4 space-y-3 border-b border-border">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs">
              <span className="text-muted-foreground">Max Trade Size (%)</span>
              <input
                type="number"
                min={1} max={50}
                value={editMaxTradePct}
                onChange={(e) => setEditMaxTradePct(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Daily Trade Limit</span>
              <input
                type="number"
                min={1} max={50}
                value={editMaxTradesPerDay}
                onChange={(e) => setEditMaxTradesPerDay(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Cooldown (minutes)</span>
              <input
                type="number"
                min={0} max={1440}
                value={editCooldownMinutes}
                onChange={(e) => setEditCooldownMinutes(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="text-xs">
              <span className="text-muted-foreground">Daily Loss Limit (%)</span>
              <input
                type="number"
                min={1} max={50}
                value={editDailyLossLimitPct}
                onChange={(e) => setEditDailyLossLimitPct(e.target.value)}
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveConfig}
              disabled={isSaving}
              className="rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
            <button
              onClick={() => setShowSettings(false)}
              className="rounded-lg border border-border px-4 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Risk warning overlay */}
      {riskWarnings.length > 0 && (
        <div className="p-4 border-b border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 mb-3">
            <TriangleAlert className="h-5 w-5 text-red-500 shrink-0" />
            <span className="text-sm font-semibold text-red-500">
              Risk Warning — Settings Exceed Defaults
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            You are changing guardrail settings beyond the recommended defaults. These changes increase your exposure to potential losses:
          </p>
          <ul className="space-y-2 mb-4">
            {riskWarnings.map((warning, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                <span className="text-foreground/90">{warning}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <button
              onClick={() => pendingPatch && submitConfig(pendingPatch)}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Accept Risk & Apply
            </button>
            <button
              onClick={dismissRiskWarning}
              className="rounded-lg border border-border px-4 py-2 text-xs font-medium hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Run button + status */}
      <div className="p-4">
        {/* Cycle error */}
        {cycleError && (
          <div className="mb-3 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-destructive flex items-center justify-between">
            <span className="text-xs flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              {cycleError}
            </span>
            <button onClick={clearCycleError} className="text-[10px] underline hover:no-underline">
              Dismiss
            </button>
          </div>
        )}

        <button
          onClick={runAutonomousCycle}
          disabled={isRunningCycle || config?.killSwitchActive}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRunningCycle ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running Cycle (analyzing 20 coins)...
            </>
          ) : config?.killSwitchActive ? (
            <>
              <ShieldOff className="h-4 w-4" />
              Kill Switch Active — Cycle Disabled
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Autonomous Cycle
            </>
          )}
        </button>

        {/* Last cycle summary */}
        {cycleResult && (
          <CycleSummary result={cycleResult} />
        )}
      </div>
    </div>
  );
}

/**
 * Display a cycle result summary
 * @param result - Cycle result to display
 */
function CycleSummary({ result }: { result: CycleResult }) {
  const duration = ((result.completedAt - result.startedAt) / 1000).toFixed(0);

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground">Last Cycle</span>
        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(result.completedAt).toLocaleTimeString()} ({duration}s)
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2">
        <div className="text-center">
          <div className="text-lg font-bold text-emerald-500">{result.tradesExecuted}</div>
          <div className="text-[10px] text-muted-foreground">Executed</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-muted-foreground">{result.tradesSkipped}</div>
          <div className="text-[10px] text-muted-foreground">Skipped</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold">{formatCurrency(result.totalAmountUsd)}</div>
          <div className="text-[10px] text-muted-foreground">Total Traded</div>
        </div>
      </div>

      {/* Warnings */}
      {result.killSwitchTripped && (
        <div className="text-xs text-red-500 flex items-center gap-1">
          <ShieldOff className="h-3 w-3" /> Kill switch was active — cycle aborted
        </div>
      )}
      {result.dailyLossTripped && (
        <div className="text-xs text-red-500 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Daily loss limit reached — cycle stopped early
        </div>
      )}

      {/* Per-coin summary (collapsed by default) */}
      {result.items.length > 0 && (
        <details className="mt-2">
          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
            {result.items.length} coin results
          </summary>
          <div className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
            {result.items.map((item) => (
              <div key={item.coinId} className="flex items-center justify-between text-[10px] py-0.5">
                <span className="font-mono">{item.coinId}</span>
                <span className={cn(
                  'flex items-center gap-1',
                  item.action === 'executed' ? 'text-emerald-500' :
                  item.action === 'failed' ? 'text-red-500' :
                  'text-muted-foreground'
                )}>
                  {item.action === 'executed' && <><CheckCircle2 className="h-2.5 w-2.5" /> {formatCurrency(item.amountUsd ?? 0)}</>}
                  {item.action === 'skipped' && <><XCircle className="h-2.5 w-2.5" /> {item.skipReason}</>}
                  {item.action === 'failed' && <><AlertTriangle className="h-2.5 w-2.5" /> error</>}
                </span>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
