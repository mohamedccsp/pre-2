import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getSimplePrice,
  getCoinsMarkets,
  getCoinDetail,
  getMarketChart,
  getOHLC,
  getTrending,
  getGlobal,
  clearCache,
} from '@/lib/api/coingecko';

/** Mock fetch globally */
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CoinGecko API Client', () => {
  beforeEach(() => {
    clearCache();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSimplePrice', () => {
    it('should fetch and return price data', async () => {
      const mockData = { bitcoin: { usd: 50000, usd_24h_vol: 1000000 } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
        status: 200,
      });

      const result = await getSimplePrice('bitcoin');
      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('should return cached data on second call', async () => {
      const mockData = { bitcoin: { usd: 50000 } };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
        status: 200,
      });

      await getSimplePrice('bitcoin');
      const result = await getSimplePrice('bitcoin');

      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });

  describe('getCoinsMarkets', () => {
    it('should fetch top coins', async () => {
      const mockData = [
        { id: 'bitcoin', name: 'Bitcoin', current_price: 50000, market_cap_rank: 1 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
        status: 200,
      });

      const result = await getCoinsMarkets(20, 1);
      expect(result).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/coins/markets?vs_currency=usd')
      );
    });
  });

  describe('getCoinDetail', () => {
    it('should fetch detail for a single coin', async () => {
      const mockData = { id: 'bitcoin', name: 'Bitcoin', market_data: {} };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
        status: 200,
      });

      const result = await getCoinDetail('bitcoin');
      expect(result).toEqual(mockData);
    });
  });

  describe('getMarketChart', () => {
    it('should transform raw price data into typed format', async () => {
      const mockData = {
        prices: [[1700000000000, 50000], [1700003600000, 51000]],
        total_volumes: [[1700000000000, 1000000], [1700003600000, 1100000]],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
        status: 200,
      });

      const result = await getMarketChart('bitcoin', 7);
      expect(result.prices).toHaveLength(2);
      expect(result.prices[0]).toEqual({ timestamp: 1700000000000, price: 50000 });
      expect(result.volumes[0]).toEqual({ timestamp: 1700000000000, volume: 1000000 });
    });
  });

  describe('getOHLC', () => {
    it('should transform raw OHLC data', async () => {
      const mockData = [[1700000000000, 49000, 51000, 48000, 50000]];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
        status: 200,
      });

      const result = await getOHLC('bitcoin', 7);
      expect(result[0]).toEqual({
        timestamp: 1700000000000,
        open: 49000,
        high: 51000,
        low: 48000,
        close: 50000,
      });
    });
  });

  describe('getTrending', () => {
    it('should extract coins from trending response', async () => {
      const mockData = {
        coins: [{ item: { id: 'bitcoin', name: 'Bitcoin', score: 0 } }],
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
        status: 200,
      });

      const result = await getTrending();
      expect(result).toHaveLength(1);
      expect(result[0].item.id).toBe('bitcoin');
    });
  });

  describe('getGlobal', () => {
    it('should extract data from global response', async () => {
      const mockData = {
        data: {
          total_market_cap: { usd: 2000000000000 },
          total_volume: { usd: 100000000000 },
          market_cap_percentage: { btc: 50, eth: 20 },
          active_cryptocurrencies: 10000,
          markets: 500,
        },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
        status: 200,
      });

      const result = await getGlobal();
      expect(result.total_market_cap.usd).toBe(2000000000000);
      expect(result.market_cap_percentage.btc).toBe(50);
    });
  });

  describe('error handling', () => {
    it('should throw on non-ok response after retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(getSimplePrice('bitcoin')).rejects.toThrow('CoinGecko API error');
    });
  });
});
