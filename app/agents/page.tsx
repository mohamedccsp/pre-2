'use client';

import { useState } from 'react';
import { useAgentStore } from '@/stores/agent-store';
import { Bot, Search, Clock, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Badge color map for query types */
const QUERY_TYPE_STYLES: Record<string, string> = {
  coin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  comparison: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  market: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
};

/**
 * Agent Research page — query form at top, result cards with history below
 */
export default function AgentsPage() {
  const [input, setInput] = useState('');
  const { history, isLoading, error, submitQuery, clearHistory, clearError } = useAgentStore();

  /**
   * Handle form submission
   * @param e - Form submit event
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    await submitQuery(trimmed);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bot className="h-6 w-6 text-primary" />
          AI Research Agent
        </h1>
        <p className="text-muted-foreground mt-1">
          Ask questions about crypto markets, coins, or comparisons
        </p>
      </div>

      {/* Query Form */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. &quot;How is Bitcoin performing?&quot; or &quot;Compare ETH vs SOL&quot;"
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
              disabled={isLoading}
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Research'
            )}
          </button>
        </div>

        {/* Example queries */}
        <div className="mt-2 flex flex-wrap gap-2">
          {['Bitcoin price analysis', 'Compare ETH vs SOL', 'Crypto market overview'].map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setInput(example)}
              className="rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive flex items-center justify-between">
          <span className="text-sm">{error}</span>
          <button onClick={clearError} className="text-xs underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="mb-4 rounded-lg border border-border bg-card p-6 flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Researching… this may take a few seconds</span>
        </div>
      )}

      {/* Results */}
      {history.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-muted-foreground">
              Research History ({history.length})
            </h2>
            <button
              onClick={clearHistory}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          </div>

          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{item.query}</span>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase',
                        QUERY_TYPE_STYLES[item.queryType] || 'bg-muted text-muted-foreground'
                      )}
                    >
                      {item.queryType}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </div>
                </div>

                {/* Result body */}
                <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
                  {item.result}
                </div>

                {/* Sources */}
                {item.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <ExternalLink className="h-3 w-3" />
                      Sources
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.sources.map((source, i) => (
                        <span
                          key={i}
                          className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {source}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && history.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Bot className="h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground text-sm">
            Ask a question to get AI-powered market research
          </p>
        </div>
      )}
    </div>
  );
}
