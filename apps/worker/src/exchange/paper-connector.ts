import type { ExchangeConnector } from "./connector";

export class PaperConnector implements ExchangeConnector {
  private price = 50000; // Simulated price

  async connect(): Promise<void> {}

  async placeOrder(params: {
    symbol: string;
    side: "buy" | "sell";
    type: "market" | "limit";
    amount: number;
    price?: number;
  }) {
    const filled = params.amount;
    const cost = filled * (params.price || this.price);
    return {
      orderId: `paper-${Date.now()}`,
      status: "closed",
      filled,
      remaining: 0,
      cost,
    };
  }

  async cancelOrder(): Promise<void> {}

  async getTicker(symbol: string) {
    return {
      bid: this.price * 0.999,
      ask: this.price * 1.001,
      last: this.price,
    };
  }

  setPrice(price: number): void {
    this.price = price;
  }
}
