import type { CoinCapAsset, LivePrice } from '@/lib/types/market';

const REST_BASE = 'https://api.coincap.io/v2';
const WS_URL = 'wss://ws.coincap.io/prices?assets=';

/** CoinCap to CoinGecko ID mapping for top coins */
const ID_MAP: Record<string, string> = {
  bitcoin: 'bitcoin',
  ethereum: 'ethereum',
  tether: 'tether',
  'binance-coin': 'binancecoin',
  solana: 'solana',
  'usd-coin': 'usd-coin',
  xrp: 'ripple',
  dogecoin: 'dogecoin',
  cardano: 'cardano',
  avalanche: 'avalanche-2',
  'shiba-inu': 'shiba-inu',
  polkadot: 'polkadot',
  chainlink: 'chainlink',
  'bitcoin-cash': 'bitcoin-cash',
  uniswap: 'uniswap',
  litecoin: 'litecoin',
  polygon: 'matic-network',
  stellar: 'stellar',
  cosmos: 'cosmos',
  monero: 'monero',
};

/**
 * Map a CoinCap asset ID to its CoinGecko equivalent
 * @param coincapId - CoinCap asset ID
 * @returns CoinGecko coin ID
 */
export function mapToGeckoId(coincapId: string): string {
  return ID_MAP[coincapId] || coincapId;
}

/**
 * Map a CoinGecko coin ID to its CoinCap equivalent
 * @param geckoId - CoinGecko coin ID
 * @returns CoinCap asset ID
 */
export function mapFromGeckoId(geckoId: string): string {
  const entry = Object.entries(ID_MAP).find(([, v]) => v === geckoId);
  return entry ? entry[0] : geckoId;
}

/**
 * Get top assets from CoinCap REST API
 * @param limit - Number of assets to return
 * @returns Array of CoinCap asset data
 */
export async function getAssets(limit = 20): Promise<CoinCapAsset[]> {
  const response = await fetch(`${REST_BASE}/assets?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`CoinCap API error: ${response.status}`);
  }
  const data = await response.json() as { data: CoinCapAsset[] };
  return data.data;
}

/**
 * Get price history for an asset
 * @param id - CoinCap asset ID
 * @param interval - Time interval (m1, m5, m15, m30, h1, h2, h6, h12, d1)
 * @returns Array of price history points
 */
export async function getAssetHistory(
  id: string,
  interval = 'h1'
): Promise<{ priceUsd: string; time: number }[]> {
  const response = await fetch(`${REST_BASE}/assets/${encodeURIComponent(id)}/history?interval=${interval}`);
  if (!response.ok) {
    throw new Error(`CoinCap API error: ${response.status}`);
  }
  const data = await response.json() as { data: { priceUsd: string; time: number }[] };
  return data.data;
}

/** Callback type for live price updates */
export type PriceCallback = (prices: LivePrice) => void;

/**
 * Create a WebSocket connection for live price updates
 * @param assets - Array of CoinCap asset IDs to subscribe to
 * @param onPrice - Callback fired on each price update
 * @returns Cleanup function to close the connection
 */
export function createPriceStream(
  assets: string[],
  onPrice: PriceCallback
): () => void {
  let ws: WebSocket | null = null;
  let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  let isDestroyed = false;

  /**
   * Connect to the WebSocket and set up auto-reconnect
   */
  function connect(): void {
    if (isDestroyed) return;

    ws = new WebSocket(`${WS_URL}${assets.join(',')}`);

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as LivePrice;
        onPrice(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (!isDestroyed) {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();

  return () => {
    isDestroyed = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    ws?.close();
  };
}
