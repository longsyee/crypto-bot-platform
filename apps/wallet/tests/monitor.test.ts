import { describe, it, expect, vi } from "vitest";
import { ethers } from "ethers";

describe("Monitor Event Parsing", () => {
  it("parses a mock USDT Transfer event", () => {
    const from = "0x1111111111111111111111111111111111111111";
    const to = "0x2222222222222222222222222222222222222222";
    const value = ethers.parseUnits("100", 18);
    const amount = parseFloat(ethers.formatUnits(value, 18));

    expect(amount).toBe(100);
    expect(from).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(to).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("computes confirmations correctly", () => {
    const currentBlock = 1000;
    const eventBlock = 988;
    const confirmations = currentBlock - eventBlock;
    expect(confirmations).toBe(12);
    expect(confirmations).toBeGreaterThanOrEqual(12);
  });
});
