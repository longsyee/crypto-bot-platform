import { describe, it, expect } from "vitest";
import { PaperConnector } from "../src/exchange/paper-connector";

describe("PaperConnector", () => {
  it("placeOrder returns simulated fill", async () => {
    const connector = new PaperConnector();
    connector.setPrice(60000);
    const order = await connector.placeOrder({
      symbol: "BTC/USDT",
      side: "buy",
      type: "market",
      amount: 0.1,
    });
    expect(order.orderId).toMatch(/^paper-/);
    expect(order.status).toBe("closed");
    expect(order.filled).toBe(0.1);
    expect(order.remaining).toBe(0);
    expect(order.cost).toBe(6000);
  });
});
