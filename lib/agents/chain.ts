import { executeAgent } from './orchestrator';
import { routeMessage, MESSAGE_TYPES } from './message-bus';
import { computeRSI, computeSMA, parseAnalysisResponse } from './analyst';
import { parseAdvisorResponse } from './advisor';
import { getMarketChart, getOHLC, getSimplePrice, getCoinDetail } from '@/lib/api/coingecko';
import { getOrCreatePortfolio } from '@/lib/virtual-portfolio/repository';
import { generateId } from '@/lib/utils';
import type { PendingRecommendation } from '@/lib/types/recommendation';
import type { TechnicalSnapshot } from '@/lib/types/analysis';

/** How long a recommendation stays valid before expiring */
const RECOMMENDATION_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Input parameters for the analysis chain */
export interface ChainInput {
  coinId: string;
  coinSymbol?: string;
  coinName?: string;
  userId: string;
}

/** Output from the analysis chain */
export interface ChainOutput {
  recommendation: PendingRecommendation;
}

/**
 * Execute the full Researcher -> Analyst -> Advisor analysis chain
 * Fetches market data, computes indicators, and coordinates all three agents
 * through the orchestrator and message bus for MAESTRO compliance.
 * @param input - Chain input with coinId and optional symbol/name
 * @returns ChainOutput containing a PendingRecommendation
 */
export async function executeAnalysisChain(input: ChainInput): Promise<ChainOutput> {
  const { coinId, userId } = input;

  // Step 1: Run researcher agent
  const researchOutput = await executeAgent('researcher', {
    query: `Analyze ${coinId} for trading`,
    context: { coinId },
  });

  // Step 2: Fetch market data and compute indicators
  const [ohlcData, chartData, coinDetail, priceData] = await Promise.all([
    getOHLC(coinId, 30),
    getMarketChart(coinId, '30'),
    getCoinDetail(coinId),
    getSimplePrice(coinId),
  ]);

  const closes = ohlcData.map((p) => p.close);
  const currentPrice = priceData[coinId]?.usd ?? closes[closes.length - 1] ?? 0;
  const coinSymbol = input.coinSymbol || coinDetail.symbol.toUpperCase();
  const coinName = input.coinName || coinDetail.name;

  const dailyPrices = chartData.prices.map((p) => p.price);
  const dailyVolumes = chartData.volumes.map((v) => v.volume);

  const indicators: TechnicalSnapshot = {
    rsi14: computeRSI(closes, 14),
    sma20: computeSMA(dailyPrices, 20),
    sma50: computeSMA(dailyPrices, 50),
    priceAtAnalysis: currentPrice,
    priceChange7d: coinDetail.market_data.price_change_percentage_7d,
    priceChange30d: coinDetail.market_data.price_change_percentage_30d,
    avgVolume7d:
      dailyVolumes.length >= 7
        ? dailyVolumes.slice(-7).reduce((s, v) => s + v, 0) / 7
        : null,
    currentVolume: coinDetail.market_data.total_volume.usd,
  };

  // Step 3: Route research to analyst via message bus (MAESTRO L7)
  const analystInput = await routeMessage(
    'researcher',
    'analyst',
    MESSAGE_TYPES.RESEARCH_COMPLETE,
    `Technical analysis for ${coinId}`,
    { coinId, researchResult: researchOutput.result, indicators }
  );

  // Step 4: Run analyst agent
  const analystOutput = await executeAgent('analyst', analystInput);
  const analysisResult = parseAnalysisResponse(analystOutput.result);

  // Step 5: Get virtual portfolio balance
  const portfolio = await getOrCreatePortfolio(userId);

  // Step 6: Route analysis to advisor via message bus (MAESTRO L7)
  const advisorInput = await routeMessage(
    'analyst',
    'advisor',
    MESSAGE_TYPES.ANALYSIS_COMPLETE,
    `Trade recommendation for ${coinId}`,
    {
      coinId,
      coinSymbol,
      coinName,
      analysisResult,
      indicators,
      researchResult: researchOutput.result,
      virtualBalance: portfolio.balanceUsd,
      currentPrice,
    }
  );

  // Step 7: Run advisor agent
  const advisorOutput = await executeAgent('advisor', advisorInput);
  const advisorResult = parseAdvisorResponse(advisorOutput.result, portfolio.balanceUsd);

  // Step 8: Assemble pending recommendation
  const now = Date.now();
  const recommendation: PendingRecommendation = {
    id: generateId(),
    coinId,
    coinSymbol,
    coinName,
    action: analysisResult.action,
    confidence: analysisResult.confidence,
    riskLevel: advisorResult.riskLevel,
    reasoning: advisorResult.reasoning,
    researchSummary: researchOutput.result,
    analysisSummary: analysisResult.reasoning,
    indicators,
    suggestedAmountUsd: advisorResult.suggestedAmountUsd,
    currentPrice,
    auditId: advisorOutput.auditId,
    createdAt: now,
    expiresAt: now + RECOMMENDATION_TTL_MS,
    status: 'pending',
  };

  return { recommendation };
}
