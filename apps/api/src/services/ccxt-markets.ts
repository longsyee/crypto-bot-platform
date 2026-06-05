import { Redis } from "ioredis";
import ccxt from "ccxt";
import { prisma } from "@crypto-bot-platform/prisma";
import { decrypt } from "./encryption";
import { config } from "../config";

const redis = new Redis(config.REDIS_URL);

const MARKET_TTL = 300; // 5 minutes
const BALANCE_TTL = 30; // 30 seconds
const TICKER_TTL = 10;  // 10 seconds

function getTickerCacheKey(connectionId: string, symbol: string): string {
  return `ccxt:ticker:${connectionId}:${symbol.toUpperCase()}`;
}

function getMarketCacheKey(connectionId: string, quote: string): string {
  return `ccxt:markets:${connectionId}:${quote.toUpperCase()}`;
}

function getBalanceCacheKey(connectionId: string): string {
  return `ccxt:balance:${connectionId}`;
}

async function getConnectionWithDecryptedKeys(connectionId: string) {
  const conn = await prisma.exchangeConnection.findUnique({
    where: { id: connectionId },
  });
  if (!conn) throw new Error("Connection not found");
  return {
    ...conn,
    apiKey: decrypt(conn.apiKeyEncrypted),
    apiSecret: decrypt(conn.apiSecretEncrypted),
    passphrase: conn.passphraseEncrypted ? decrypt(conn.passphraseEncrypted) : undefined,
  };
}

function createCcxtExchange(conn: Awaited<ReturnType<typeof getConnectionWithDecryptedKeys>>) {
  const ExchangeClass = ccxt[conn.exchangeId as keyof typeof ccxt] as any;
  if (!ExchangeClass) {
    throw new Error(`Unsupported exchange: ${conn.exchangeId}`);
  }
  const exchange = new ExchangeClass({
    apiKey: conn.apiKey,
    secret: conn.apiSecret,
    password: conn.passphrase,
    enableRateLimit: true,
    options: { defaultType: "swap" },
  });
  if (conn.isTestnet && "setSandboxMode" in exchange) {
    exchange.setSandboxMode(true);
  }
  return exchange;
}

export interface MarketInfo {
  symbol: string;
  base: string;
  quote: string;
  minAmount?: number;
  maxAmount?: number;
  precision?: { amount?: number; price?: number };
  active: boolean;
}

export async function fetchMarkets(connectionId: string, quoteCurrency = "USDT"): Promise<MarketInfo[]> {
  const cacheKey = getMarketCacheKey(connectionId, quoteCurrency);
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const conn = await getConnectionWithDecryptedKeys(connectionId);
  const exchange = createCcxtExchange(conn);
  await exchange.loadMarkets();
  const markets = exchange.markets as Record<string, any>;

  const quote = quoteCurrency.toUpperCase();
  const result: MarketInfo[] = Object.values(markets)
    .filter((m: any) => m.spot === true && m.active !== false && m.quote === quote)
    .map((m: any) => ({
      symbol: m.symbol,
      base: m.base,
      quote: m.quote,
      minAmount: m.limits?.amount?.min,
      maxAmount: m.limits?.amount?.max,
      precision: m.precision
        ? { amount: m.precision.amount, price: m.precision.price }
        : undefined,
      active: !!m.active,
    }));

  await redis.setex(cacheKey, MARKET_TTL, JSON.stringify(result));
  return result;
}

export interface BalanceInfo {
  [currency: string]: { free: number; used: number; total: number };
}

export async function fetchBalance(connectionId: string): Promise<BalanceInfo> {
  const cacheKey = getBalanceCacheKey(connectionId);
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const conn = await getConnectionWithDecryptedKeys(connectionId);
  const exchange = createCcxtExchange(conn);
  const balance = await exchange.fetchBalance();

  const result: BalanceInfo = {};
  for (const [currency, data] of Object.entries(balance.total as Record<string, number>)) {
    const total = Number(data) || 0;
    const free = Number((balance.free as Record<string, number>)[currency]) || 0;
    const used = Number((balance.used as Record<string, number>)[currency]) || 0;
    if (total > 0 || free > 0 || used > 0 || currency === "USDT") {
      result[currency] = { free, used, total };
    }
  }

  await redis.setex(cacheKey, BALANCE_TTL, JSON.stringify(result));
  return result;
}

export interface TickerInfo {
  symbol: string;
  lastPrice: number;
  bid: number;
  ask: number;
  high: number;
  low: number;
  volume: number;
  change24hPct: number;
}

export async function fetchTicker(connectionId: string, symbol: string): Promise<TickerInfo> {
  const cacheKey = getTickerCacheKey(connectionId, symbol);
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const conn = await getConnectionWithDecryptedKeys(connectionId);
  const exchange = createCcxtExchange(conn);
  const ticker = await exchange.fetchTicker(symbol);

  const result: TickerInfo = {
    symbol: ticker.symbol || symbol,
    lastPrice: Number(ticker.last || ticker.close || 0),
    bid: Number(ticker.bid || 0),
    ask: Number(ticker.ask || 0),
    high: Number(ticker.high || 0),
    low: Number(ticker.low || 0),
    volume: Number(ticker.baseVolume || ticker.quoteVolume || 0),
    change24hPct: Number(ticker.percentage || ticker.change || 0),
  };

  await redis.setex(cacheKey, TICKER_TTL, JSON.stringify(result));
  return result;
}
