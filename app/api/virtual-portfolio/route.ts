import { NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/maestro/rate-limiter';
import { getOrCreatePortfolio, getHoldings, getTrades } from '@/lib/virtual-portfolio/repository';
import { getSimplePrice } from '@/lib/api/coingecko';
import { getAuthUserId, unauthorized } from '@/lib/auth-guard';

/**
 * GET /api/virtual-portfolio — Get the full virtual portfolio snapshot
 * @param request - Incoming request
 * @returns JSON with portfolio balance, holdings with current values, and trade history
 */
export async function GET(request: Request): Promise<NextResponse> {
  const rateLimited = rateLimitMiddleware(request, 30);
  if (rateLimited) return rateLimited;

  const userId = await getAuthUserId();
  if (!userId) return unauthorized();

  try {
    const [portfolio, holdings, trades] = await Promise.all([
      getOrCreatePortfolio(userId),
      getHoldings(userId),
      getTrades(userId, 50),
    ]);

    // Fetch current prices for all held coins
    const coinIds = holdings.map((h) => h.coinId);
    const enrichedHoldings = coinIds.length > 0
      ? await (async () => {
          const priceData = await getSimplePrice(coinIds.join(','));
          return holdings.map((h) => {
            const currentPrice = priceData[h.coinId]?.usd ?? 0;
            const currentValue = h.amount * currentPrice;
            const costBasis = h.amount * h.averageBuyPrice;
            return { ...h, currentPrice, currentValue, unrealizedPnl: currentValue - costBasis };
          });
        })()
      : holdings;

    const holdingsValue = enrichedHoldings.reduce((sum, h) => sum + (h.currentValue ?? 0), 0);
    const totalValue = portfolio.balanceUsd + holdingsValue;
    const totalPnl = totalValue - portfolio.initialBalanceUsd;
    const totalPnlPercent = portfolio.initialBalanceUsd > 0
      ? (totalPnl / portfolio.initialBalanceUsd) * 100
      : 0;

    return NextResponse.json({
      portfolio,
      holdings: enrichedHoldings,
      trades,
      totalValue,
      totalPnl,
      totalPnlPercent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch virtual portfolio';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
