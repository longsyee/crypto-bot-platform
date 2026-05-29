export interface ExchangeConnector {
  connect(credentials: { apiKey: string; secret: string; passphrase?: string; testnet?: boolean }): Promise<void>;
  placeOrder(params: {
    symbol: string;
    side: "buy" | "sell";
    type: "market" | "limit";
    amount: number;
    price?: number;
  }): Promise<{ orderId: string; status: string; filled: number; remaining: number; cost?: number }>;
  cancelOrder(orderId: string): Promise<void>;
  getTicker(symbol: string): Promise<{ bid: number; ask: number; last: number }>;
  watchTicker?(symbol: string, callback: (ticker: { last: number }) => void): Promise<void>;
}
