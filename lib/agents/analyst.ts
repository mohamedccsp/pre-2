import OpenAI from 'openai';
import { sanitizeAgentOutput } from '@/lib/maestro/validator';
import { stripCodeFences } from '@/lib/utils';
import type { Agent, AgentInput, AgentOutput } from '@/lib/types/agent';
import type { TechnicalSnapshot, TradeAction } from '@/lib/types/analysis';

/** Lazy-initialized OpenAI client (avoids throwing at import time in tests) */
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/** Parsed analysis result from the LLM */
export interface AnalysisResult {
  action: TradeAction;
  confidence: number;
  reasoning: string;
}

/**
 * Compute Relative Strength Index using Wilder's smoothing method
 * @param closes - Array of closing prices in chronological order
 * @param period - RSI period (default 14)
 * @returns RSI value between 0 and 100, or null if insufficient data
 */
export function computeRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null;

  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }

  avgGain /= period;
  avgLoss /= period;

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  if (avgGain === 0) return 0;

  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

/**
 * Compute Simple Moving Average over the last N values
 * @param values - Array of numeric values in chronological order
 * @param period - Number of periods to average
 * @returns SMA value, or null if insufficient data
 */
export function computeSMA(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((sum, v) => sum + v, 0) / period;
}

/**
 * Parse the LLM analysis response into a structured AnalysisResult
 * @param raw - Raw LLM response string (may contain code fences)
 * @returns Parsed AnalysisResult with action, confidence, and reasoning
 */
export function parseAnalysisResponse(raw: string): AnalysisResult {
  try {
    const cleaned = stripCodeFences(raw);
    const parsed = JSON.parse(cleaned) as {
      action?: string;
      confidence?: number;
      reasoning?: string;
    };

    const action = (['buy', 'sell', 'hold'].includes(parsed.action ?? ''))
      ? (parsed.action as TradeAction)
      : 'hold';
    const confidence = typeof parsed.confidence === 'number'
      ? Math.max(0, Math.min(100, parsed.confidence))
      : 0;
    const reasoning = typeof parsed.reasoning === 'string'
      ? parsed.reasoning
      : 'Analysis inconclusive';

    return { action, confidence, reasoning };
  } catch {
    return { action: 'hold', confidence: 0, reasoning: 'Analysis inconclusive' };
  }
}

/**
 * Format a TechnicalSnapshot into a readable text block for the LLM
 * @param indicators - Computed technical indicators
 * @returns Formatted indicator summary string
 */
function formatIndicators(indicators: TechnicalSnapshot): string {
  const lines: string[] = [
    `Price at analysis: $${indicators.priceAtAnalysis.toFixed(2)}`,
    `RSI-14: ${indicators.rsi14 !== null ? indicators.rsi14.toFixed(2) : 'N/A'}`,
    `SMA-20: ${indicators.sma20 !== null ? `$${indicators.sma20.toFixed(2)}` : 'N/A'}`,
    `SMA-50: ${indicators.sma50 !== null ? `$${indicators.sma50.toFixed(2)}` : 'N/A'}`,
    `7d price change: ${indicators.priceChange7d !== null ? `${indicators.priceChange7d.toFixed(2)}%` : 'N/A'}`,
    `30d price change: ${indicators.priceChange30d !== null ? `${indicators.priceChange30d.toFixed(2)}%` : 'N/A'}`,
    `7d avg volume: ${indicators.avgVolume7d !== null ? `$${indicators.avgVolume7d.toFixed(0)}` : 'N/A'}`,
    `Current volume: ${indicators.currentVolume !== null ? `$${indicators.currentVolume.toFixed(0)}` : 'N/A'}`,
  ];

  if (indicators.sma20 !== null && indicators.sma50 !== null) {
    const crossover = indicators.sma20 > indicators.sma50 ? 'SMA-20 above SMA-50 (bullish)' : 'SMA-20 below SMA-50 (bearish)';
    lines.push(`SMA crossover: ${crossover}`);
  }

  if (indicators.rsi14 !== null) {
    const rsiSignal = indicators.rsi14 > 70 ? 'overbought' : indicators.rsi14 < 30 ? 'oversold' : 'neutral';
    lines.push(`RSI signal: ${rsiSignal}`);
  }

  return lines.join('\n');
}

/**
 * Build the system prompt for the analyst LLM call
 * @returns System prompt instructing the LLM to interpret indicators
 */
function buildSystemPrompt(): string {
  return [
    'You are a technical analysis agent for the CryptoMAESTRO platform.',
    'You receive technical indicators and research context for a cryptocurrency.',
    'Interpret the indicators and provide a trading signal.',
    'Consider RSI levels (>70 overbought, <30 oversold), SMA crossovers, volume trends, and price momentum.',
    'You MUST respond with ONLY a JSON object in this exact format:',
    '{ "action": "buy"|"sell"|"hold", "confidence": 0-100, "reasoning": "..." }',
    'The confidence score should reflect how strongly the indicators align.',
    'Be conservative — default to "hold" when signals are mixed.',
    'Do not include any text outside the JSON object.',
  ].join(' ');
}

/** Analyst agent — interprets technical indicators via LLM to produce trade signals */
export const analyst: Agent = {
  name: 'analyst',
  role: 'Technical analysis and trade signals',
  maestroLayer: [1, 2, 3, 5, 6],
  allowedTools: ['coingecko_read', 'research_read'],

  /**
   * Execute the analyst agent with pre-computed indicators
   * @param input - Agent input with context containing coinId, indicators, and researchResult
   * @returns AgentOutput with reasoning as the result string
   */
  async execute(input: AgentInput): Promise<AgentOutput> {
    const coinId = (input.context?.coinId as string) ?? 'unknown';
    const indicators = input.context?.indicators as TechnicalSnapshot | undefined;
    const researchResult = (input.context?.researchResult as string) ?? '';

    const sources: string[] = [
      `CoinGecko: /coins/${coinId}/ohlc`,
      `CoinGecko: /coins/${coinId}/market_chart`,
    ];

    const indicatorText = indicators
      ? formatIndicators(indicators)
      : 'No indicator data available.';

    const userPrompt = [
      `Coin: ${coinId}`,
      '',
      'Technical Indicators:',
      indicatorText,
      '',
      'Research Context:',
      researchResult,
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
    const sanitizedResult = sanitizeAgentOutput(rawResult);

    return {
      agentName: 'analyst',
      result: sanitizedResult,
      sources,
      timestamp: Date.now(),
      auditId: '',
      queryType: 'coin' as const,
      coinIds: [coinId],
    };
  },
};
