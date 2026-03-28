'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

/** Agent identity definitions with color coding and descriptions */
export const AGENT_PROFILES: Record<string, AgentProfile> = {
  researcher: {
    name: 'Market Researcher',
    shortName: 'Researcher',
    color: 'text-[#00d4ff]',
    bgColor: 'bg-[#00d4ff]',
    borderColor: 'border-[#00d4ff]/30',
    glowColor: 'shadow-[0_0_15px_rgba(0,212,255,0.3)]',
    icon: 'R',
    summary: 'Gathers market data, trends, and news from CoinGecko & CoinCap APIs.',
  },
  analyst: {
    name: 'Technical Analyst',
    shortName: 'Analyst',
    color: 'text-[#a855f7]',
    bgColor: 'bg-[#a855f7]',
    borderColor: 'border-[#a855f7]/30',
    glowColor: 'shadow-[0_0_15px_rgba(168,85,247,0.3)]',
    icon: 'A',
    summary: 'Runs RSI, MACD, and price pattern analysis on historical data.',
  },
  advisor: {
    name: 'Trade Advisor',
    shortName: 'Advisor',
    color: 'text-[#f59e0b]',
    bgColor: 'bg-[#f59e0b]',
    borderColor: 'border-[#f59e0b]/30',
    glowColor: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
    icon: 'V',
    summary: 'Generates buy/sell/hold recommendations with risk scoring.',
  },
  executor: {
    name: 'Trade Executor',
    shortName: 'Executor',
    color: 'text-[#ff3b5c]',
    bgColor: 'bg-[#ff3b5c]',
    borderColor: 'border-[#ff3b5c]/30',
    glowColor: 'shadow-[0_0_15px_rgba(255,59,92,0.3)]',
    icon: 'X',
    summary: 'Executes approved trades within MAESTRO guardrails.',
  },
  orchestrator: {
    name: 'Orchestrator',
    shortName: 'Orchestrator',
    color: 'text-[#00ff88]',
    bgColor: 'bg-[#00ff88]',
    borderColor: 'border-[#00ff88]/30',
    glowColor: 'shadow-[0_0_15px_rgba(0,255,136,0.3)]',
    icon: 'O',
    summary: 'Coordinates agent chain and routes queries to the right agent.',
  },
};

export interface AgentProfile {
  name: string;
  shortName: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  icon: string;
  summary: string;
}

interface AgentAvatarProps {
  agentId: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  showGlow?: boolean;
  className?: string;
}

/**
 * Agent avatar with color-coded identity and hover tooltip
 * @param agentId - Agent identifier key matching AGENT_PROFILES
 * @param size - Avatar size variant
 * @param showName - Whether to display the agent name beside the avatar
 * @param showGlow - Whether to animate a glow pulse
 * @param className - Additional CSS classes
 */
export function AgentAvatar({ agentId, size = 'sm', showName = false, showGlow = false, className }: AgentAvatarProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profile = AGENT_PROFILES[agentId] || AGENT_PROFILES.researcher;

  const sizeClasses = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
  };

  const handleMouseEnter = () => {
    setShowTooltip(true);
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    tooltipTimerRef.current = setTimeout(() => setShowTooltip(false), 20000);
  };

  const handleMouseLeave = () => {
    setShowTooltip(false);
    if (tooltipTimerRef.current) {
      clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  return (
    <div className={cn('relative inline-flex items-center gap-1.5', className)}>
      <div
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'relative flex items-center justify-center rounded-full font-display font-bold cursor-pointer transition-all duration-300',
          sizeClasses[size],
          profile.color,
          profile.borderColor,
          'border',
          'bg-background/80 backdrop-blur-sm',
          showGlow && 'avatar-glow',
        )}
      >
        {profile.icon}

        {showTooltip && (
          <div className="agent-tooltip absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48">
            <div className={cn(
              'rounded-lg border px-3 py-2 text-xs',
              profile.borderColor,
              'bg-card/95 backdrop-blur-md',
            )}>
              <div className={cn('font-display font-bold mb-1', profile.color)}>
                {profile.name}
              </div>
              <div className="text-muted-foreground leading-relaxed">
                {profile.summary}
              </div>
            </div>
            <div className={cn(
              'absolute top-full left-1/2 -translate-x-1/2 w-0 h-0',
              'border-l-[6px] border-l-transparent',
              'border-r-[6px] border-r-transparent',
              'border-t-[6px] border-t-border',
            )} />
          </div>
        )}
      </div>

      {showName && (
        <span className={cn('text-xs font-medium font-display', profile.color)}>
          {profile.shortName}
        </span>
      )}
    </div>
  );
}

/**
 * Map query type or agent name to an agent ID
 * @param queryType - The query type or agent name from API response
 * @returns Agent profile key
 */
export function resolveAgentId(queryType: string): string {
  const map: Record<string, string> = {
    coin: 'researcher',
    comparison: 'analyst',
    market: 'researcher',
    researcher: 'researcher',
    analyst: 'analyst',
    advisor: 'advisor',
    executor: 'executor',
    orchestrator: 'orchestrator',
  };
  return map[queryType.toLowerCase()] || 'researcher';
}
