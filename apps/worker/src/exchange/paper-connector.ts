import type { ExchangeConnector } from "./connector";

export class PaperConnector implements ExchangeConnector {
  private price = 50000; // Simulated price
  private positions: Map<string, { side: "long" | "short"; contracts: number; entryPrice: number; leverage: number }> = new Map();
  private orders: Map<string, { status: string; filled: number; remaining: number; cost: number; fee: number; price: number }> = new Map();

  async connect(_credentials?: any): Promise<void> {}

  async placeOrder(params: {
    symbol: string;
    side: "buy" | "sell";
    type: "market" | "limit";
    amount: number;
    price?: number;
    reduceOnly?: boolean;
  }) {
    const execPrice = params.price || this.price;
    const filled = params.amount;
    const cost = filled * execPrice;
    const fee = cost * 0.0006;
    const orderId = `paper-${Date.now()}`;

    // Simulate position tracking
    const pos = this.positions.get(params.symbol) || { side: "long" as const, contracts: 0, entryPrice: 0, leverage: 1 };
    if (params.side === "buy" && !params.reduceOnly) {
      // Open long
      const newContracts = pos.contracts + filled;
      pos.entryPrice = newContracts > 0
        ? (pos.entryPrice * pos.contracts + execPrice * filled) / newContracts
        : execPrice;
      pos.side = "long";
      pos.contracts = newContracts;
    } else if (params.side === "sell" && params.reduceOnly) {
      // Close long
      pos.contracts = Math.max(0, pos.contracts - filled);
      if (pos.contracts <= 0) pos.side = "long";
    } else if (params.side === "sell" && !params.reduceOnly) {
      // Open short
      const newContracts = pos.contracts + filled;
      pos.entryPrice = newContracts > 0
        ? (pos.entryPrice * pos.contracts + execPrice * filled) / newContracts
        : execPrice;
      pos.side = "short";
      pos.contracts = newContracts;
    } else if (params.side === "buy" && params.reduceOnly) {
      // Close short
      pos.contracts = Math.max(0, pos.contracts - filled);
      if (pos.contracts <= 0) pos.side = "short";
    }
    this.positions.set(params.symbol, pos);

    this.orders.set(orderId, { status: "closed", filled, remaining: 0, cost, fee, price: execPrice });
    return {
      orderId,
      status: "closed",
      filled,
      remaining: 0,
      cost,
      fee,
    };
  }

  async cancelOrder(_orderId: string, _symbol?: string): Promise<void> {}

  async getOrder(orderId: string, _symbol: string) {
    const o = this.orders.get(orderId) || { status: "canceled", filled: 0, remaining: 0, cost: 0, fee: 0, price: 0 };
    return {
      orderId,
      status: o.status,
      filled: o.filled,
      remaining: o.remaining,
      cost: o.cost,
      fee: o.fee,
      price: o.price,
    };
  }

  async getTicker(_symbol: string) {
    return {
      bid: this.price * 0.999,
      ask: this.price * 1.001,
      last: this.price,
    };
  }

  async fetchPositions(symbol?: string) {
    if (symbol) {
      const pos = this.positions.get(symbol);
      if (!pos || pos.contracts === 0) return [];
      return [{
        symbol,
        side: pos.side,
        contracts: pos.contracts,
        notional: pos.contracts * pos.entryPrice,
        entryPrice: pos.entryPrice,
        unrealizedPnl: pos.side === "long"
          ? (this.price - pos.entryPrice) * pos.contracts
          : (pos.entryPrice - this.price) * pos.contracts,
        leverage: pos.leverage,
        marginMode: "cross",
        liquidationPrice: pos.side === "long" ? pos.entryPrice * 0.8 : pos.entryPrice * 1.2,
      }];
    }
    return Array.from(this.positions.entries())
      .filter(([, p]) => p.contracts > 0)
      .map(([sym, pos]) => ({
        symbol: sym,
        side: pos.side,
        contracts: pos.contracts,
        notional: pos.contracts * pos.entryPrice,
        entryPrice: pos.entryPrice,
        unrealizedPnl: pos.side === "long"
          ? (this.price - pos.entryPrice) * pos.contracts
          : (pos.entryPrice - this.price) * pos.contracts,
        leverage: pos.leverage,
        marginMode: "cross",
        liquidationPrice: pos.side === "long" ? pos.entryPrice * 0.8 : pos.entryPrice * 1.2,
      }));
  }

  async fetchFundingRate(_symbol: string) {
    return { fundingRate: 0.0001, nextFundingTime: Date.now() + 3600_000 };
  }

  async fetchOHLCV(_symbol: string, _timeframe = "1h", limit = 50) {
    const now = Date.now();
    const candles = [];
    for (let i = limit; i > 0; i--) {
      const ts = now - i * 3600_000;
      const noise = (Math.random() - 0.5) * this.price * 0.02;
      const close = this.price + noise;
      const open = close - (Math.random() - 0.5) * this.price * 0.01;
      const high = Math.max(open, close) + Math.random() * this.price * 0.005;
      const low = Math.min(open, close) - Math.random() * this.price * 0.005;
      candles.push({
        timestamp: ts,
        open,
        high,
        low,
        close,
        volume: Math.random() * 1000,
      });
    }
    return candles;
  }

  setPrice(price: number): void {
    this.price = price;
  }
}
