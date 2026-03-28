/** Coin data from CoinGecko /coins/markets endpoint */
export interface CoinMarket {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number | null;
  sparkline_in_7d?: { price: number[] };
}

/** Coin detail from CoinGecko /coins/{id} endpoint */
export interface CoinDetail {
  id: string;
  symbol: string;
  name: string;
  description: { en: string };
  image: { large: string; small: string; thumb: string };
  market_data: {
    current_price: { usd: number };
    market_cap: { usd: number };
    total_volume: { usd: number };
    price_change_percentage_24h: number;
    price_change_percentage_7d: number;
    price_change_percentage_30d: number;
    circulating_supply: number;
    total_supply: number | null;
    ath: { usd: number };
    atl: { usd: number };
  };
  links: {
    homepage: string[];
    blockchain_site: string[];
    subreddit_url: string;
  };
}

/** Price point for historical chart data */
export interface PricePoint {
  timestamp: number;
  price: number;
}

/** Volume point for historical chart data */
export interface VolumePoint {
  timestamp: number;
  volume: number;
}

/** OHLC candlestick data point */
export interface OHLCPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Market chart response from CoinGecko */
export interface MarketChart {
  prices: PricePoint[];
  volumes: VolumePoint[];
}

/** Simple price lookup result */
export interface SimplePrice {
  [coinId: string]: {
    usd: number;
    usd_24h_vol?: number;
    usd_market_cap?: number;
    usd_24h_change?: number;
  };
}

/** Trending coin from CoinGecko */
export interface TrendingCoin {
  item: {
    id: string;
    coin_id: number;
    name: string;
    symbol: string;
    market_cap_rank: number;
    thumb: string;
    score: number;
    price_btc: number;
  };
}

/** Global market data */
export interface GlobalData {
  total_market_cap: { usd: number };
  total_volume: { usd: number };
  market_cap_percentage: { btc: number; eth: number };
  active_cryptocurrencies: number;
  markets: number;
}

/** Real-time price update from CoinCap WebSocket */
export interface LivePrice {
  [assetId: string]: string;
}

/** CoinCap asset data */
export interface CoinCapAsset {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  supply: string;
  maxSupply: string | null;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  priceUsd: string;
  changePercent24Hr: string;
  vwap24Hr: string;
}
