import { describe, it, expect } from "vitest";
import {
  calculateVwap,
  getNextSafetyOrderSize,
  getNextDeviationTrigger,
  shouldTriggerTakeProfit,
} from "../src/engine/dca-loop";
import { Decimal } from "@prisma/client/runtime/library";

describe("DCA Engine Math", () => {
  it("calculates VWAP correctly", () => {
    const vwap = calculateVwap(new Decimal(2), new Decimal(100));
    expect(vwap.toNumber()).toBeCloseTo(50, 6);
  });

  it("VWAP handles additional safety orders", () => {
    const totalAmount = new Decimal(1.5); // 1 + 0.5
    const totalCost = new Decimal(50000 + 22500); // 1*50000 + 0.5*45000
    const vwap = calculateVwap(totalAmount, totalCost);
    expect(vwap.toNumber()).toBeCloseTo(48333.33, 2);
  });

  it("scales safety order size by volume scale", () => {
    const size1 = getNextSafetyOrderSize(10, 2, 0);
    expect(size1).toBe(10);

    const size2 = getNextSafetyOrderSize(10, 2, 1);
    expect(size2).toBe(20);

    const size3 = getNextSafetyOrderSize(10, 1.5, 2);
    expect(size3).toBeCloseTo(22.5, 6);
  });

  it("scales deviation trigger by step scale", () => {
    const dev1 = getNextDeviationTrigger(1.0, 1.5, 0);
    expect(dev1).toBe(1.0);

    const dev2 = getNextDeviationTrigger(1.0, 1.5, 1);
    expect(dev2).toBe(1.5);

    const dev3 = getNextDeviationTrigger(1.0, 1.5, 2);
    expect(dev3).toBe(2.25);
  });

  it("triggers take-profit when price exceeds VWAP * (1 + tp%)", () => {
    const vwap = new Decimal(50000);
    expect(shouldTriggerTakeProfit(52501, vwap, 5)).toBe(true);
    expect(shouldTriggerTakeProfit(52499, vwap, 5)).toBe(false);
    expect(shouldTriggerTakeProfit(50000, vwap, 5)).toBe(false);
    expect(shouldTriggerTakeProfit(55000, vwap, 10)).toBe(true);
  });
});
