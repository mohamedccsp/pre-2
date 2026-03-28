import OpenAI from 'openai';
import { getCoinDetail, getCoinsMarkets, getTrending, getGlobal } from '@/lib/api/coingecko';
import { sanitizeAgentOutput } from '@/lib/maestro/validator';
import { formatCurrency, formatPercent } from '@/lib/utils';
import type { Agent, AgentInput, AgentOutput, ClassifiedQuery } from '@/lib/types/agent';

/** Lazy-initialized OpenAI client (avoids throwing at import time in tests) */
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

/** Unified coin lookup — aliases and full names mapped to CoinGecko IDs */
const COIN_LOOKUP: Record<string, string> = {
  // Ticker aliases
  btc: 'bitcoin', eth: 'ethereum', sol: 'solana', xrp: 'ripple',
  doge: 'dogecoin', ada: 'cardano', dot: 'polkadot', avax: 'avalanche-2',
  link: 'chainlink', matic: 'matic-network', uni: 'uniswap', ltc: 'litecoin',
  shib: 'shiba-inu', atom: 'cosmos', xlm: 'stellar', bch: 'bitcoin-cash',
  // Full names
  bitcoin: 'bitcoin', ethereum: 'ethereum', solana: 'solana', ripple: 'ripple',
  dogecoin: 'dogecoin', cardano: 'cardano', polkadot: 'polkadot',
  chainlink: 'chainlink', uniswap: 'uniswap', litecoin: 'litecoin',
  avalanche: 'avalanche-2', polygon: 'matic-network', stellar: 'stellar',
  cosmos: 'cosmos', monero: 'monero', tether: 'tether',
};

/**
 * Classify a research query into type and extract coin IDs
 * @param query - Raw user query
 * @returns Classified query with type and extracted coin IDs
 */
export function classifyQuery(query: string): ClassifiedQuery {
  const lower = query.toLowerCase();
  const foundCoins: string[] = [];

  // Extract coin IDs from unified lookup, deduplicating by ID
  for (const [key, id] of Object.entries(COIN_LOOKUP)) {
    if (lower.includes(key) && !foundCoins.includes(id)) foundCoins.push(id);
  }

  // Detect comparison keywords
  const isComparison = /\b(vs|versus|compare|compared|between|or)\b/i.test(lower);

  if (foundCoins.length >= 2 || (foundCoins.length > 0 && isComparison)) {
    return { type: 'comparison', coinIds: foundCoins.slice(0, 3), originalQuery: query };
  }

  if (foundCoins.length === 1) {
    return { type: 'coin', coinIds: foundCoins, originalQuery: query };
  }

  // General market query — no specific coins detected
  return { type: 'market', coinIds: [], originalQuery: query };
}

/**
 * Fetch market context data based on query type
 * @param classified - Classified query
 * @returns Formatted context string for the LLM prompt
 */
async function fetchContext(classified: ClassifiedQuery): Promise<{ context: string; sources: string[] }> {
  const sources: string[] = [];

  if (classified.type === 'coin' && classified.coinIds.length > 0) {
    const coin = await getCoinDetail(classified.coinIds[0]);
    sources.push(`CoinGecko: /coins/${classified.coinIds[0]}`);
    const md = coin.market_data;
    return {
      context: [
        `Coin: ${coin.name} (${coin.symbol.toUpperCase()})`,
        `Price: ${formatCurrency(md.current_price.usd)}`,
        `24h Change: ${formatPercent(md.price_change_percentage_24h)}`,
        `7d Change: ${formatPercent(md.price_change_percentage_7d)}`,
        `30d Change: ${formatPercent(md.price_change_percentage_30d)}`,
        `Market Cap: ${formatCurrency(md.market_cap.usd, true)}`,
        `24h Volume: ${formatCurrency(md.total_volume.usd, true)}`,
        `Circulating Supply: ${md.circulating_supply.toLocaleString()}`,
        `All-Time High: ${formatCurrency(md.ath.usd)}`,
        `All-Time Low: ${formatCurrency(md.atl.usd)}`,
        coin.description.en ? `Description: ${coin.description.en.split('. ').slice(0, 3).join('. ')}.` : '',
      ].filter(Boolean).join('\n'),
      sources,
    };
  }

  if (classified.type === 'comparison') {
    const details = await Promise.all(
      classified.coinIds.map((id) => getCoinDetail(id))
    );
    sources.push(...classified.coinIds.map((id) => `CoinGecko: /coins/${id}`));
    const lines = details.map((coin) => {
      const md = coin.market_data;
      return [
        `--- ${coin.name} (${coin.symbol.toUpperCase()}) ---`,
        `Price: ${formatCurrency(md.current_price.usd)}`,
        `24h: ${formatPercent(md.price_change_percentage_24h)} | 7d: ${formatPercent(md.price_change_percentage_7d)} | 30d: ${formatPercent(md.price_change_percentage_30d)}`,
        `Market Cap: ${formatCurrency(md.market_cap.usd, true)}`,
        `Volume: ${formatCurrency(md.total_volume.usd, true)}`,
      ].join('\n');
    });
    return { context: lines.join('\n\n'), sources };
  }

  // General market query — fetch global data + trending + top coins
  const [global, trending, topCoins] = await Promise.all([
    getGlobal(),
    getTrending(),
    getCoinsMarkets(10),
  ]);
  sources.push('CoinGecko: /global', 'CoinGecko: /search/trending', 'CoinGecko: /coins/markets');

  const trendingNames = trending.slice(0, 5).map((t) => t.item.name).join(', ');
  const topLines = topCoins.slice(0, 5).map((c) =>
    `${c.name}: ${formatCurrency(c.current_price)} (${formatPercent(c.price_change_percentage_24h)})`
  ).join('\n');

  return {
    context: [
      `Total Market Cap: ${formatCurrency(global.total_market_cap.usd, true)}`,
      `24h Volume: ${formatCurrency(global.total_volume.usd, true)}`,
      `BTC Dominance: ${global.market_cap_percentage.btc.toFixed(1)}%`,
      `Active Cryptocurrencies: ${global.active_cryptocurrencies.toLocaleString()}`,
      `\nTrending: ${trendingNames}`,
      `\nTop 5 by Market Cap:\n${topLines}`,
    ].join('\n'),
    sources,
  };
}

/**
 * Build the system prompt for the researcher LLM call
 * @param queryType - Type of research query
 * @returns System prompt string
 */
function buildSystemPrompt(queryType: string): string {
  return [
    'You are a cryptocurrency market research analyst for the CryptoMAESTRO platform.',
    'Provide concise, data-driven analysis in 2-3 short paragraphs.',
    'Always reference specific numbers from the data provided.',
    'Be objective — present both bullish and bearish perspectives.',
    'Do not give financial advice or predict exact future prices.',
    'Do not recommend buying or selling.',
    queryType === 'comparison' ? 'Compare the coins objectively using the data metrics provided.' : '',
    queryType === 'market' ? 'Analyze the overall market conditions and notable trends.' : '',
  ].filter(Boolean).join(' ');
}

/** Researcher agent — fetches data and produces AI-powered market analysis */
export const researcher: Agent = {
  name: 'researcher',
  role: 'Market research and analysis',
  maestroLayer: [1, 3, 4, 5, 6],
  allowedTools: ['coingecko_read', 'coincap_read'],

  async execute(input: AgentInput): Promise<AgentOutput> {
    const classified = classifyQuery(input.query);
    const { context, sources } = await fetchContext(classified);

    const completion = await getOpenAI().chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt(classified.type) },
        { role: 'user', content: `Research query: ${input.query}\n\nMarket data:\n${context}` },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const rawResult = completion.choices[0]?.message?.content || 'No analysis available.';
    const result = sanitizeAgentOutput(rawResult);

    return {
      agentName: 'researcher',
      result,
      sources,
      timestamp: Date.now(),
      auditId: '', // Set by orchestrator after audit logging
      queryType: classified.type,
      coinIds: classified.coinIds,
    };
  },
};
