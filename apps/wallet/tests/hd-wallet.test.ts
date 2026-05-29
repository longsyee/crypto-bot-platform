import { describe, it, expect } from "vitest";
import { generateBscAddress } from "../src/services/hd-wallet";

describe("HD Wallet", () => {
  it("generates two different addresses", () => {
    const a1 = generateBscAddress(0);
    const a2 = generateBscAddress(1);
    expect(a1.address).not.toBe(a2.address);
    expect(a1.privateKey).not.toBe(a2.privateKey);
    expect(a1.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(a2.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("is deterministic from the same seed", () => {
    const a1 = generateBscAddress(5);
    const a2 = generateBscAddress(5);
    expect(a1.address).toBe(a2.address);
    expect(a1.privateKey).toBe(a2.privateKey);
  });
});
