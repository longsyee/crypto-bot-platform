import ccxt from "ccxt";
import type { ExchangeConnector } from "./connector";

export class CCXTConnector implements ExchangeConnector {
  private exchange!: ccxt.Exchange;

  constructor(private exchangeId: string) {}

  async connect(credentials: {
    apiKey: string;
    secret: string;
    passphrase?: string;
    testnet?: boolean;
  }): Promise<void> {
    const ExchangeClass = ccxt[this.exchangeId as keyof typeof ccxt] as any;
    this.exchange = new ExchangeClass({
      apiKey: credentials.apiKey,
      secret: credentials.secret,
      password: credentials.passphrase,
      enableRateLimit: true,
      options: credentials.testnet ? { defaultType: "swap" } : {},
    });
    if (credentials.testnet && "setSandboxMode" in this.exchange) {
      this.exchange.setSandboxMode(true);
    }
  }

  async placeOrder(params: {
    symbol: string;
    side: "buy" | "sell";
    type: "market" | "limit";
    amount: number;
    price?: number;
  }) {
    const order = await this.exchange.createOrder(
      params.symbol,
      params.type,
      params.side,
      params.amount,
      params.price
    );
    return {
      orderId: order.id,
      status: order.status,
      filled: order.filled || 0,
      remaining: order.remaining || params.amount,
      cost: order.cost || undefined,
    };
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.exchange.cancelOrder(orderId);
  }

  async getTicker(symbol: string) {
    const ticker = await this.exchange.fetchTicker(symbol);
    return {
      bid: ticker.bid || 0,
      ask: ticker.ask || 0,
      last: ticker.last || 0,
    };
  }
}
