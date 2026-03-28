import OpenAI from 'openai';
import { sanitizeAgentOutput } from '@/lib/maestro/validator';
import { stripCodeFences } from '@/lib/utils';
import type { Agent, AgentInput, AgentOutput } from '@/lib/types/agent';
import type { TechnicalSnapshot, RiskLevel } from '@/lib/types/analysis';
import type { AnalysisResult } from './analyst';

/** Lazy-initialized OpenAI client (avoids throwing at import time in tests) */
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/** Maximum percentage of balance allowed for a single trade */
const MAX_BALANCE_PERCENT = 0.2;

/** Parsed advisor result from the LLM */
export interface AdvisorResult {
  riskLevel: RiskLevel;
  reasoning: string;
  suggestedAmountUsd: number;
}

/**
 * Parse the LLM advisor response into a structured AdvisorResult
 * @param raw - Raw LLM response string (may contain code fences)
 * @param virtualBalance - Current virtual portfolio balance in USD
 * @returns Parsed AdvisorResult with risk level, reasoning, and suggested amount
 */
export function parseAdvisorResponse(raw: string, virtualBalance: number): AdvisorResult {
  try {
    const cleaned = stripCodeFences(raw);
    const parsed = JSON.parse(cleaned) as {
      riskLevel?: string;
      reasoning?: string;
      suggestedPercentOfBalance?: number;
    };

    const riskLevel = (['low', 'medium', 'high'].includes(parsed.riskLevel ?? ''))
      ? (parsed.riskLevel as RiskLevel)
      : 'high';
    const reasoning = typeof parsed.reasoning === 'string'
      ? parsed.reasoning
      : 'Recommendation inconclusive';
    const suggestedPercent = typeof parsed.suggestedPercentOfBalance === 'number'
      ? Math.max(0, Math.min(MAX_BALANCE_PERCENT, parsed.suggestedPercentOfBalance))
      : 0;
    const suggestedAmountUsd = suggestedPercent * virtualBalance;

    return { riskLevel, reasoning, suggestedAmountUsd };
  } catch {
    return { riskLevel: 'high', reasoning: 'Recommendation inconclusive', suggestedAmountUsd: 0 };
  }
}

/**
 * Format the analysis context into a readable text block for the LLM
 * @param analysisResult - Structured result from the analyst agent
 * @param indicators - Computed technical indicators
 * @param researchResult - Research summary from the researcher agent
 * @param currentPrice - Current coin price in USD
 * @param virtualBalance - Current virtual portfolio balance in USD
 * @returns Formatted context string
 */
function formatAdvisorContext(
  analysisResult: AnalysisResult,
  indicators: TechnicalSnapshot | undefined,
  researchResult: string,
  currentPrice: number,
  virtualBalance: number
): string {
  const lines: string[] = [
    `Analyst signal: ${analysisResult.action.toUpperCase()} (confidence: ${analysisResult.confidence}/100)`,
    `Analyst reasoning: ${analysisResult.reasoning}`,
    '',
    `Current price: $${currentPrice.toFixed(2)}`,
    `Virtual balance: $${virtualBalance.toFixed(2)}`,
    `Max allocation: $${(virtualBalance * MAX_BALANCE_PERCENT).toFixed(2)} (${(MAX_BALANCE_PERCENT * 100).toFixed(0)}% cap)`,
  ];

  if (indicators) {
    lines.push('');
    lines.push('Key Indicators:');
    lines.push(`  RSI-14: ${indicators.rsi14 !== null ? indicators.rsi14.toFixed(2) : 'N/A'}`);
    lines.push(`  SMA-20: ${indicators.sma20 !== null ? `$${indicators.sma20.toFixed(2)}` : 'N/A'}`);
    lines.push(`  SMA-50: ${indicators.sma50 !== null ? `$${indicators.sma50.toFixed(2)}` : 'N/A'}`);
    lines.push(`  7d change: ${indicators.priceChange7d !== null ? `${indicators.priceChange7d.toFixed(2)}%` : 'N/A'}`);
    lines.push(`  30d change: ${indicators.priceChange30d !== null ? `${indicators.priceChange30d.toFixed(2)}%` : 'N/A'}`);
  }

  lines.push('');
  lines.push('Research Summary:');
  lines.push(researchResult);

  return lines.join('\n');
}

/**
 * Build the system prompt for the advisor LLM call
 * @returns System prompt instructing the LLM to provide risk-assessed recommendations
 */
function buildSystemPrompt(): string {
  return [
    'You are a trade recommendation advisor for the CryptoMAESTRO platform.',
    'You receive an analyst signal, technical indicators, research context, and the user virtual portfolio balance.',
    'Your job is to assess risk and suggest a position size.',
    'You MUST respond with ONLY a JSON object in this exact format:',
    '{ "riskLevel": "low"|"medium"|"high", "reasoning": "...", "suggestedPercentOfBalance": 0.0-0.2 }',
    'The suggestedPercentOfBalance is a decimal from 0 to 0.2 (max 20% of balance per trade).',
    'If the analyst signal is "hold" or confidence is below 40, suggest 0.',
    'For "buy" or "sell" signals, scale the percentage with confidence and inversely with risk.',
    'Be conservative — capital preservation is the priority for this learning platform.',
    'Consider both the technical signals and the research context in your risk assessment.',
    'Do not include any text outside the JSON object.',
  ].join(' ');
}

/** Advisor agent — assesses risk and recommends position sizing */
export const advisor: Agent = {
  name: 'advisor',
  role: 'Trade recommendation with risk assessment',
  maestroLayer: [1, 3, 5, 6],
  allowedTools: ['analyst_read', 'portfolio_read'],

  /**
   * Execute the advisor agent with analysis results and portfolio context
   * @param input - Agent input with context containing coinId, analysisResult, indicators, and balance
   * @returns AgentOutput with reasoning as the result string
   */
  async execute(input: AgentInput): Promise<AgentOutput> {
    const coinId = (input.context?.coinId as string) ?? 'unknown';
    const coinSymbol = (input.context?.coinSymbol as string) ?? '';
    const coinName = (input.context?.coinName as string) ?? '';
    const analysisResult = (input.context?.analysisResult as AnalysisResult) ?? {
      action: 'hold' as const,
      confidence: 0,
      reasoning: 'No analysis provided',
    };
    const indicators = input.context?.indicators as TechnicalSnapshot | undefined;
    const researchResult = (input.context?.researchResult as string) ?? '';
    const virtualBalance = (input.context?.virtualBalance as number) ?? 1000;
    const currentPrice = (input.context?.currentPrice as number) ?? 0;

    const sources: string[] = [
      `Analyst: ${analysisResult.action} signal (${analysisResult.confidence}% confidence)`,
      `Portfolio: $${virtualBalance.toFixed(2)} balance`,
    ];

    const contextText = formatAdvisorContext(
      analysisResult,
      indicators,
      researchResult,
      currentPrice,
      virtualBalance
    );

    const userPrompt = [
      `Coin: ${coinName} (${coinSymbol}) — ${coinId}`,
      '',
      contextText,
    ].join('\n');

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const rawResult = completion.choices[0]?.message?.content || '{}';
    const advisorResult = parseAdvisorResponse(rawResult, virtualBalance);
    const sanitizedReasoning = sanitizeAgentOutput(advisorResult.reasoning);

    return {
      agentName: 'advisor',
      result: sanitizedReasoning,
      sources,
      timestamp: Date.now(),
      auditId: '',
      queryType: 'coin' as const,
      coinIds: [coinId],
    };
  },
};
