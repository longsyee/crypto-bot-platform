export interface ExchangeConnector {
  connect(credentials: { apiKey: string; secret: string; passphrase?: string; testnet?: boolean; leverage?: number; symbol?: string }): Promise<void>;
  placeOrder(params: {
    symbol: string;
    side: "buy" | "sell";
    type: "market" | "limit";
    amount: number;
    price?: number;
    reduceOnly?: boolean;
    positionSide?: "LONG" | "SHORT";
  }): Promise<{ orderId: string; status: string; filled: number; remaining: number; cost?: number; fee?: number; rawResponse?: any }>;
  cancelOrder(orderId: string, symbol?: string): Promise<void>;
  getOrder(orderId: string, symbol: string): Promise<{ orderId: string; status: string; filled: number; remaining: number; cost?: number; fee?: number; price?: number }>;
  getTicker(symbol: string): Promise<{ bid: number; ask: number; last: number }>;
  watchTicker?(symbol: string, callback: (ticker: { last: number }) => void): Promise<void>;
  fetchOHLCV(symbol: string, timeframe?: string, limit?: number): Promise<{ timestamp: number; open: number; high: number; low: number; close: number; volume: number }[]>;
  fetchPositions?(symbol?: string): Promise<{ symbol: string; side: "long" | "short"; contracts: number; notional: number; entryPrice: number; unrealizedPnl: number; leverage: number; marginMode: string; liquidationPrice?: number }[]>;
  fetchFundingRate?(symbol: string): Promise<{ fundingRate: number; nextFundingTime: number }>;
}
