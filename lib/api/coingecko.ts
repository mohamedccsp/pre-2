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
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000; // 1 second
const FETCH_TIMEOUT = 10_000; // 10 seconds
const MAX_CACHE_SIZE = 200;

/** Tiered TTLs — slow-changing endpoints get longer cache lifetimes */
const TTL_RULES: Array<{ pattern: RegExp; ttl: number }> = [
  { pattern: /\/simple\/price/, ttl: 60_000 },              // 1 min — prices change fast
  { pattern: /\/coins\/markets/, ttl: 120_000 },             // 2 min — ranked list is stable
  { pattern: /\/coins\/[^/]+\/ohlc/, ttl: 300_000 },         // 5 min — candle data
  { pattern: /\/coins\/[^/]+\/market_chart/, ttl: 300_000 }, // 5 min — historical
  { pattern: /\/search\/trending/, ttl: 300_000 },            // 5 min — trending list
  { pattern: /\/global/, ttl: 300_000 },                      // 5 min — global stats
  { pattern: /\/coins\//, ttl: 180_000 },                     // 3 min — coin detail (catch-all)
];
const DEFAULT_TTL = 60_000;

/** Cache entry with stale-while-revalidate support */
interface CacheEntry {
  data: unknown;
  freshUntil: number;
  staleUntil: number;
}

/** In-memory response cache with stale-while-revalidate */
const cache = new Map<string, CacheEntry>();

/** In-flight request deduplication map */
const inflight = new Map<string, Promise<unknown>>();

/**
 * Get the appropriate cache TTL for a URL based on endpoint type
 * @param url - The CoinGecko API URL
 * @returns TTL in milliseconds
 */
function getTtlForUrl(url: string): number {
  for (const rule of TTL_RULES) {
    if (rule.pattern.test(url)) return rule.ttl;
  }
  return DEFAULT_TTL;
}

/**
 * Evict the oldest entry if cache exceeds max size
 */
function evictIfNeeded(): void {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const firstKey = cache.keys().next().value;
  if (firstKey) cache.delete(firstKey);
}

/**
 * Perform a single network fetch with timeout via AbortController
 * @param url - URL to fetch
 * @returns Parsed JSON response
 */
async function fetchWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (response.status === 429) {
      throw new Error('RATE_LIMITED');
    }

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch data with retry, jittered backoff, and stale-on-error fallback
 * @param url - URL to fetch
 * @returns Parsed JSON response
 */
async function fetchWithRetry<T>(url: string): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fetchWithTimeout<T>(url);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES - 1) {
        const baseBackoff = INITIAL_BACKOFF * Math.pow(2, attempt);
        const jitter = Math.random() * baseBackoff * 0.5;
        await sleep(baseBackoff + jitter);
      }
    }
  }

  // All retries failed — check for stale cache data before throwing
  const stale = cache.get(url);
  if (stale) {
    console.warn(`[CoinGecko] All retries failed for ${url}, returning stale data`);
    return stale.data as T;
  }

  throw lastError || new Error('CoinGecko API request failed');
}

/**
 * Background revalidation — fire-and-forget cache refresh
 * @param url - URL to revalidate
 */
function revalidateInBackground(url: string): void {
  // Skip if already revalidating
  if (inflight.has(url)) return;

  const promise = fetchWithRetry(url)
    .then((data) => {
      const ttl = getTtlForUrl(url);
      const now = Date.now();
      cache.set(url, { data, freshUntil: now + ttl, staleUntil: now + ttl * 5 });
      evictIfNeeded();
    })
    .catch(() => {
      // Revalidation failed silently — stale data persists
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, promise);
}

/**
 * Fetch with stale-while-revalidate caching, request deduplication,
 * tiered TTLs, jittered retry, timeout, and cache bounds.
 * @param url - Full URL to fetch
 * @returns Parsed JSON response
 */
async function fetchWithCache<T>(url: string): Promise<T> {
  const now = Date.now();
  const cached = cache.get(url);

  // Fresh cache — return immediately
  if (cached && now < cached.freshUntil) {
    return cached.data as T;
  }

  // Stale cache — return immediately, revalidate in background
  if (cached && now < cached.staleUntil) {
    revalidateInBackground(url);
    return cached.data as T;
  }

  // Cache miss or fully expired — deduplicate concurrent requests
  const existing = inflight.get(url);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = fetchWithRetry<T>(url)
    .then((data) => {
      const ttl = getTtlForUrl(url);
      const n = Date.now();
      cache.set(url, { data, freshUntil: n + ttl, staleUntil: n + ttl * 5 });
      evictIfNeeded();
      return data;
    })
    .finally(() => {
      inflight.delete(url);
    });

  inflight.set(url, promise);
  return promise;
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
  inflight.clear();
}