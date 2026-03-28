'use client';

import { useState, useEffect } from 'react';
import { useRecommendationsStore } from '@/stores/recommendations-store';
import { COIN_ALLOWLIST } from '@/lib/maestro/guardrails';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import {
  TrendingUp, Loader2, Clock, CheckCircle2, XCircle, AlertTriangle, Timer,
} from 'lucide-react';
import AutonomousCyclePanel from '@/components/autonomous-cycle-panel';
import { AgentAvatar } from '@/components/agent-avatar';
import type { Recommendation } from '@/lib/types/recommendation';

/** Badge styles for recommendation status */
const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-[#ffa726]/10 text-[#ffa726] border-[#ffa726]/20',
  approved: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  executed: 'bg-[#00ff88]/10 text-[#00ff88] border-[#00ff88]/20',
  rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
  expired: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

/** Badge styles for trade actions */
const ACTION_STYLES: Record<string, string> = {
  buy: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  sell: 'bg-red-500/10 text-red-500 border-red-500/20',
  hold: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
};

/** Badge styles for risk levels */
const RISK_STYLES: Record<string, string> = {
  low: 'text-emerald-500',
  medium: 'text-yellow-500',
  high: 'text-red-500',
};

/** Sorted allowlist for dropdown */
const COIN_OPTIONS = Array.from(COIN_ALLOWLIST).sort();

/**
 * Countdown timer component for pending recommendations
 */
function CountdownTimer({ expiresAt }: { expiresAt: number }) {
  const [remaining, setRemaining] = useState(Math.max(0, expiresAt - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      const left = Math.max(0, expiresAt - Date.now());
      setRemaining(left);
      if (left === 0) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  if (remaining === 0) return <span className="text-destructive text-xs">Expired</span>;

  return (
    <span className="flex items-center gap-1 text-xs text-yellow-500">
      <Timer className="h-3 w-3" />
      {minutes}:{seconds.toString().padStart(2, '0')}
    </span>
  );
}

/**
 * Recommendation card with approve/reject controls
 */
function RecommendationCard({ rec }: { rec: Recommendation }) {
  const { approveRecommendation, rejectRecommendation } = useRecommendationsStore();
  const [isActing, setIsActing] = useState(false);

  /**
   * Handle approve/reject with loading state
   * @param action - approve or reject
   */
  const handleAction = async (action: 'approve' | 'reject') => {
    setIsActing(true);
    try {
      if (action === 'approve') await approveRecommendation(rec.id);
      else await rejectRecommendation(rec.id);
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <AgentAvatar agentId="advisor" size="sm" />
          <span className="font-medium">{rec.coinName}</span>
          <span className="text-xs text-muted-foreground font-mono">{rec.coinSymbol}</span>
          <span className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase',
            ACTION_STYLES[rec.action]
          )}>
            {rec.action}
          </span>
          <span className={cn(
            'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase',
            STATUS_STYLES[rec.status]
          )}>
            {rec.status}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rec.status === 'pending' && <CountdownTimer expiresAt={rec.expiresAt} />}
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {new Date(rec.createdAt).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Indicators summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="rounded bg-muted/50 p-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase">Price</div>
          <div className="text-sm font-mono">{formatCurrency(rec.currentPrice)}</div>
        </div>
        <div className="rounded bg-muted/50 p-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase">Confidence</div>
          <div className="text-sm font-mono">{rec.confidence}%</div>
        </div>
        <div className="rounded bg-muted/50 p-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase">Risk</div>
          <div className={cn('text-sm font-medium', RISK_STYLES[rec.riskLevel])}>
            {rec.riskLevel}
          </div>
        </div>
        <div className="rounded bg-muted/50 p-2 text-center">
          <div className="text-[10px] text-muted-foreground uppercase">RSI (14)</div>
          <div className="text-sm font-mono">
            {rec.indicators.rsi14 !== null ? rec.indicators.rsi14.toFixed(1) : 'N/A'}
          </div>
        </div>
      </div>

      {/* Amount */}
      {rec.action !== 'hold' && (
        <div className="mb-3 text-sm">
          <span className="text-muted-foreground">Suggested: </span>
          <span className="font-mono font-medium">{formatCurrency(rec.suggestedAmountUsd)}</span>
        </div>
      )}

      {/* Reasoning */}
      <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line mb-3">
        {rec.reasoning}
      </div>

      {/* Approve/Reject buttons for pending */}
      {rec.status === 'pending' && (
        <div className="flex gap-2 pt-3 border-t border-border">
          {rec.action !== 'hold' && (
            <button
              onClick={() => handleAction('approve')}
              disabled={isActing}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve Trade
            </button>
          )}

          <button
            onClick={() => handleAction('reject')}
            disabled={isActing}
            className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-destructive/10 hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <XCircle className="h-4 w-4" />
            {rec.action === 'hold' ? 'Dismiss' : 'Reject'}
          </button>
        </div>
      )}

      {/* Executed trade info */}
      {rec.status === 'executed' && (
        <div className="pt-3 border-t border-border text-xs text-emerald-500 flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3" />
          Trade executed at {new Date(rec.executedAt).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

/**
 * Recommendations page — HITL approval workflow
 */
export default function RecommendationsPage() {
  const [selectedCoin, setSelectedCoin] = useState('bitcoin');
  const { recommendations, isLoading, isAnalyzing, error, fetchRecommendations, analyzeCoin, clearError } =
    useRecommendationsStore();

  useEffect(() => {
    fetchRecommendations();
    // Poll every 30s for status updates
    const interval = setInterval(fetchRecommendations, 30000);
    return () => clearInterval(interval);
  }, [fetchRecommendations]);

  /**
   * Handle form submission to analyze a coin
   * @param e - Form submit event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoin || isAnalyzing) return;
    await analyzeCoin(selectedCoin);
  };

  const pendingRecs = recommendations.filter((r) => r.status === 'pending');
  const historyRecs = recommendations.filter((r) => r.status !== 'pending');

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold tracking-wide flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Trade Recommendations
        </h1>
        <p className="text-muted-foreground mt-1">
          AI-powered analysis with human-in-the-loop approval
        </p>
      </div>

      {/* Autonomous Trading Panel */}
      <AutonomousCyclePanel />

      {/* Analyze form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <select
            value={selectedCoin}
            onChange={(e) => setSelectedCoin(e.target.value)}
            disabled={isAnalyzing}
            className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
          >
            {COIN_OPTIONS.map((coin) => (
              <option key={coin} value={coin}>
                {coin.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isAnalyzing}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-display font-bold tracking-wider text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing...
              </span>
            ) : (
              'Analyze'
            )}
          </button>
        </div>
      </form>

      {/* Loading state during analysis */}
      {isAnalyzing && (
        <div className="mb-4 rounded-lg border border-border bg-card p-6 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <div>
            <span className="text-sm font-medium">Running agent chain...</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Researcher → Analyst → Advisor (may take 10-15 seconds)
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-center justify-between">
          <span className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </span>
          <button onClick={clearError} className="text-xs underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Pending recommendations */}
      {pendingRecs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            Pending Approval ({pendingRecs.length})
          </h2>
          <div className="space-y-3">
            {pendingRecs.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* History */}
      {historyRecs.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            History ({historyRecs.length})
          </h2>
          <div className="space-y-3">
            {historyRecs.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isAnalyzing && recommendations.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">
            Select a coin and click Analyze to get AI-powered trade recommendations
          </p>
        </div>
      )}
    </div>
  );
}
