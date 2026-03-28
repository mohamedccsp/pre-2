import { sleep } from '@/lib/utils';
import type {
  CoinMarket,
  CoinDetail,
  MarketChart,
  OHLCPoint,
  SimplePrice,
  TrendingCoin,
  GlobalData,
} from '@/lib/types/market';

const BASE_URL = 'https://api.coingecko.com/api/v3';
const CACHE_TTL = 60_000; // 60 seconds
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second

/** In-memory response cache */
const cache = new Map<string, { data: unknown; expiresAt: number }>();

/**
 * Fetch with caching and retry logic
 * @param url - Full URL to fetch
 * @returns Parsed JSON response
 */
async function fetchWithCache<T>(url: string): Promise<T> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url);

      if (response.status === 429) {
        const backoff = INITIAL_BACKOFF * Math.pow(2, attempt);
        await sleep(backoff);
        continue;
      }

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as T;
      cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL });
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES - 1) {
        const backoff = INITIAL_BACKOFF * Math.pow(2, attempt);
        await sleep(backoff);
      }
    }
  }

  throw lastError || new Error('CoinGecko API request failed');
}

/**
 * Get current prices for multiple coins
 * @param ids - Comma-separated coin IDs
 * @returns Price data keyed by coin ID
 */
export async function getSimplePrice(ids: string): Promise<SimplePrice> {
  const url = `${BASE_URL}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_vol=true&include_market_cap=true&include_24hr_change=true`;
  return fetchWithCache<SimplePrice>(url);
}

/**
 * Get top coins by market cap
 * @param perPage - Number of coins to return (default 20)
 * @param page - Page number (default 1)
 * @returns Array of coin market data
 */
export async function getCoinsMarkets(perPage = 20, page = 1): Promise<CoinMarket[]> {
  const url = `${BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=true`;
  return fetchWithCache<CoinMarket[]>(url);
}

/**
 * Get full detail for a single coin
 * @param id - CoinGecko coin ID (e.g., 'bitcoin')
 * @returns Detailed coin data
 */
export async function getCoinDetail(id: string): Promise<CoinDetail> {
  const url = `${BASE_URL}/coins/${encodeURIComponent(id)}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`;
  return fetchWithCache<CoinDetail>(url);
}

/**
 * Get historical price and volume chart data
 * @param id - CoinGecko coin ID
 * @param days - Number of days (1, 7, 30, 90, 365, max)
 * @returns Price and volume arrays
 */
export async function getMarketChart(id: string, days: string | number): Promise<MarketChart> {
  const url = `${BASE_URL}/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${days}`;
  const raw = await fetchWithCache<{ prices: number[][]; total_volumes: number[][] }>(url);

  return {
    prices: raw.prices.map(([timestamp, price]) => ({ timestamp, price })),
    volumes: raw.total_volumes.map(([timestamp, volume]) => ({ timestamp, volume })),
  };
}

/**
 * Get OHLC candlestick data
 * @param id - CoinGecko coin ID
 * @param days - Number of days (1, 7, 14, 30, 90, 180, 365)
 * @returns Array of OHLC data points
 */
export async function getOHLC(id: string, days: number): Promise<OHLCPoint[]> {
  const url = `${BASE_URL}/coins/${encodeURIComponent(id)}/ohlc?vs_currency=usd&days=${days}`;
  const raw = await fetchWithCache<number[][]>(url);

  return raw.map(([timestamp, open, high, low, close]) => ({
    timestamp,
    open,
    high,
    low,
    close,
  }));
}

/**
 * Get trending coins in last 24h
 * @returns Array of trending coins
 */
export async function getTrending(): Promise<TrendingCoin[]> {
  const url = `${BASE_URL}/search/trending`;
  const raw = await fetchWithCache<{ coins: TrendingCoin[] }>(url);
  return raw.coins;
}

/**
 * Get global market data
 * @returns Global market statistics
 */
export async function getGlobal(): Promise<GlobalData> {
  const url = `${BASE_URL}/global`;
  const raw = await fetchWithCache<{ data: GlobalData }>(url);
  return raw.data;
}

/**
 * Clear the response cache (useful for testing)
 */
export function clearCache(): void {
  cache.clear();
}
