/** Trade action recommendation */
export type TradeAction = 'buy' | 'sell' | 'hold';

/** Risk assessment level */
export type RiskLevel = 'low' | 'medium' | 'high';

/** Technical indicator signal direction */
export type IndicatorSignal = 'bullish' | 'bearish' | 'neutral';

/** Computed technical indicators at a point in time */
export interface TechnicalSnapshot {
  readonly rsi14: number | null;
  readonly sma20: number | null;
  readonly sma50: number | null;
  readonly priceAtAnalysis: number;
  readonly priceChange7d: number | null;
  readonly priceChange30d: number | null;
  readonly avgVolume7d: number | null;
  readonly currentVolume: number | null;
}

/** Structured signal interpretation for a single indicator */
export interface IndicatorInterpretation {
  readonly name: string;
  readonly value: number | null;
  readonly signal: IndicatorSignal;
  readonly description: string;
}
