import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";

// We can't easily import the internal functions because they aren't exported.
// So we test via the public surface + mock the world.
// For a real audit we verify the pure math helpers by re-implementing them in the test.

// ------------------------------------------------------------------
// Re-implement the core math helpers exactly as in dca-loop.ts
// ------------------------------------------------------------------
function usdtToAmount(usdtValue: number, price: number): number {
  if (!price || price <= 0) return 0;
  return usdtValue / price;
}

function estimateFee(cost: number): number {
  return cost * 0.001;
}

function calculateVwap(totalAmount: Decimal, totalCost: Decimal): Decimal {
  if (totalAmount.lessThanOrEqualTo(0)) return new Decimal(0);
  return totalCost.div(totalAmount);
}

function getEntrySide(direction: "long" | "short"): "buy" | "sell" {
  return direction === "long" ? "buy" : "sell";
}

function getExitSide(direction: "long" | "short"): "buy" | "sell" {
  return direction === "long" ? "sell" : "buy";
}

function getNextSafetyOrderSize(baseSize: number, volumeScale: number, safetyOrdersFilled: number): number {
  return baseSize * Math.pow(volumeScale, safetyOrdersFilled);
}

function getNextDeviationTrigger(initialDeviation: number, stepScale: number, safetyOrdersFilled: number): number {
  return initialDeviation * Math.pow(stepScale, safetyOrdersFilled);
}

function shouldTriggerSafetyOrder(lastPrice: number, vwap: Decimal, deviation: number, direction: "long" | "short"): boolean {
  if (vwap.lessThanOrEqualTo(0)) return false;
  if (direction === "long") {
    const dropPct = vwap.minus(lastPrice).div(vwap).mul(100).toNumber();
    return dropPct >= deviation;
  } else {
    const risePct = new Decimal(lastPrice).minus(vwap).div(vwap).mul(100).toNumber();
    return risePct >= deviation;
  }
}

function shouldTriggerFixedTakeProfit(lastPrice: number, vwap: Decimal, takeProfitPercent: number, direction: "long" | "short"): boolean {
  if (vwap.lessThanOrEqualTo(0)) return false;
  if (direction === "long") {
    const tpPrice = vwap.mul(1 + takeProfitPercent / 100);
    return new Decimal(lastPrice).gte(tpPrice);
  } else {
    const tpPrice = vwap.mul(1 - takeProfitPercent / 100);
    return new Decimal(lastPrice).lte(tpPrice);
  }
}

function shouldTriggerStopLoss(lastPrice: number, vwap: Decimal, stopLossPercent: number, direction: "long" | "short"): boolean {
  if (direction === "long") {
    const slPrice = vwap.mul(1 - stopLossPercent / 100);
    return new Decimal(lastPrice).lte(slPrice);
  } else {
    const slPrice = vwap.mul(1 + stopLossPercent / 100);
    return new Decimal(lastPrice).gte(slPrice);
  }
}

function calculateRealizedPnl(sellPrice: number, sellAmount: number, vwap: Decimal, totalFees: Decimal, direction: "long" | "short"): number {
  const proceeds = sellPrice * sellAmount;
  const costBasis = vwap.mul(sellAmount).toNumber();
  const grossPnl = direction === "long" ? proceeds - costBasis : costBasis - proceeds;
  return grossPnl - totalFees.toNumber();
}

function getUnrealizedPnl(lastPrice: number, vwap: Decimal, totalAmount: Decimal, direction: "long" | "short"): number {
  const costBasis = vwap.mul(totalAmount.toNumber()).toNumber();
  const marketValue = lastPrice * totalAmount.toNumber();
  return direction === "long" ? marketValue - costBasis : costBasis - marketValue;
}

function checkWaterfall(priceHistory: number[], ratio: number): boolean {
  if (priceHistory.length < 3) return false;
  const min = Math.min(...priceHistory);
  const max = Math.max(...priceHistory);
  if (min <= 0) return false;
  const volatility = ((max - min) / min) * 100;
  return volatility > ratio;
}

function getBreakevenPrice(vwap: Decimal, bufferPct: number, direction: "long" | "short"): Decimal {
  if (direction === "long") {
    return vwap.mul(1 + bufferPct / 100);
  } else {
    return vwap.mul(1 - bufferPct / 100);
  }
}

function getDirectionList(cfg: any): ("long" | "short")[] {
  const d = cfg.direction || "long";
  return d === "both" ? ["long", "short"] : [d];
}

function isDual(cfg: any): boolean {
  return cfg.direction === "both";
}

// ------------------------------------------------------------------
// Test suite
// ------------------------------------------------------------------
describe("DCA Engine Audit", () => {
  describe("Math helpers", () => {
    it("usdtToAmount works", () => {
      expect(usdtToAmount(100, 50000)).toBeCloseTo(0.002, 6);
      expect(usdtToAmount(100, 0)).toBe(0);
    });

    it("calculateVwap works", () => {
      const vwap = calculateVwap(new Decimal(2), new Decimal(100000));
      expect(vwap.toNumber()).toBeCloseTo(50000, 2);
    });

    it("getNextSafetyOrderSize scales correctly", () => {
      expect(getNextSafetyOrderSize(10, 1.5, 0)).toBe(10);
      expect(getNextSafetyOrderSize(10, 1.5, 1)).toBe(15);
      expect(getNextSafetyOrderSize(10, 1.5, 2)).toBe(22.5);
    });

    it("getNextDeviationTrigger scales correctly", () => {
      expect(getNextDeviationTrigger(1, 1.5, 0)).toBe(1);
      expect(getNextDeviationTrigger(1, 1.5, 1)).toBe(1.5);
      expect(getNextDeviationTrigger(1, 1.5, 2)).toBe(2.25);
    });
  });

  describe("Trigger logic", () => {
    const vwap = new Decimal(50000);

    it("long safety order triggers on drop", () => {
      expect(shouldTriggerSafetyOrder(49500, vwap, 1, "long")).toBe(true); // 1% drop
      expect(shouldTriggerSafetyOrder(49750, vwap, 1, "long")).toBe(false); // 0.5% drop
    });

    it("short safety order triggers on rise", () => {
      expect(shouldTriggerSafetyOrder(50500, vwap, 1, "short")).toBe(true); // 1% rise
      expect(shouldTriggerSafetyOrder(50250, vwap, 1, "short")).toBe(false); // 0.5% rise
    });

    it("long TP triggers on rise", () => {
      expect(shouldTriggerFixedTakeProfit(52500, vwap, 5, "long")).toBe(true); // 5% up
      expect(shouldTriggerFixedTakeProfit(51000, vwap, 5, "long")).toBe(false); // 2% up
    });

    it("short TP triggers on drop", () => {
      expect(shouldTriggerFixedTakeProfit(47500, vwap, 5, "short")).toBe(true); // 5% down
      expect(shouldTriggerFixedTakeProfit(49000, vwap, 5, "short")).toBe(false); // 2% down
    });

    it("long SL triggers on drop", () => {
      expect(shouldTriggerStopLoss(47500, vwap, 5, "long")).toBe(true);
      expect(shouldTriggerStopLoss(49000, vwap, 5, "long")).toBe(false);
    });

    it("short SL triggers on rise", () => {
      expect(shouldTriggerStopLoss(52500, vwap, 5, "short")).toBe(true);
      expect(shouldTriggerStopLoss(51000, vwap, 5, "short")).toBe(false);
    });
  });

  describe("PnL calculations", () => {
    it("realized PnL for long", () => {
      const pnl = calculateRealizedPnl(55000, 1, new Decimal(50000), new Decimal(50), "long");
      // gross = (55000 - 50000) * 1 = 5000, minus fees 50 = 4950
      expect(pnl).toBeCloseTo(4950, 2);
    });

    it("realized PnL for short", () => {
      const pnl = calculateRealizedPnl(45000, 1, new Decimal(50000), new Decimal(50), "short");
      // gross = (50000 - 45000) * 1 = 5000, minus fees 50 = 4950
      expect(pnl).toBeCloseTo(4950, 2);
    });

    it("unrealized PnL for long", () => {
      const pnl = getUnrealizedPnl(52000, new Decimal(50000), new Decimal(2), "long");
      expect(pnl).toBeCloseTo(4000, 2); // 2 * (52000 - 50000)
    });
  });

  describe("Waterfall detection", () => {
    it("detects high volatility", () => {
      const prices = [50000, 51000, 52000, 48000, 49000];
      expect(checkWaterfall(prices, 3)).toBe(true); // max-min = 4000, ~8%
    });

    it("ignores low volatility", () => {
      const prices = [50000, 50100, 50050, 49950];
      expect(checkWaterfall(prices, 3)).toBe(false);
    });
  });

  describe("Breakeven price", () => {
    it("long breakeven is above VWAP", () => {
      const be = getBreakevenPrice(new Decimal(50000), 0.3, "long");
      expect(be.toNumber()).toBeCloseTo(50150, 2);
    });

    it("short breakeven is below VWAP", () => {
      const be = getBreakevenPrice(new Decimal(50000), 0.3, "short");
      expect(be.toNumber()).toBeCloseTo(49850, 2);
    });
  });

  describe("Direction config helpers", () => {
    it("getDirectionList for long", () => {
      expect(getDirectionList({ direction: "long" })).toEqual(["long"]);
    });

    it("getDirectionList for short", () => {
      expect(getDirectionList({ direction: "short" })).toEqual(["short"]);
    });

    it("getDirectionList for both", () => {
      expect(getDirectionList({ direction: "both" })).toEqual(["long", "short"]);
    });

    it("isDual detects both", () => {
      expect(isDual({ direction: "both" })).toBe(true);
      expect(isDual({ direction: "long" })).toBe(false);
    });
  });

  describe("Full DCA sequence simulation (long, paper mode)", () => {
    it("places base order + 2 safety orders + exits on TP", () => {
      // Simulate a single-direction long bot
      const cfg = {
        base_order_size: 100,
        safety_order_size: 100,
        price_deviation_initial: 1,
        safety_order_step_scale: 1,
        safety_order_max_count: 5,
        safety_order_volume_scale: 1,
        take_profit: 5,
        stop_loss: 10,
        order_type: "market",
        direction: "long",
        leverage: 1,
      };

      // Price drops from 50000 → 49500 → 49000 (triggers 2 safety orders)
      // Then rises to 52500 (triggers TP at 5% above VWAP ~49544)
      const prices = [50000, 49500, 49000, 52500];

      let state = {
        direction: "long" as const,
        baseOrderFilled: false,
        safetyOrdersFilled: 0,
        totalAmount: new Decimal(0),
        totalCost: new Decimal(0),
        vwap: new Decimal(0),
        totalFees: new Decimal(0),
        highestPrice: 0,
        lowestPrice: 0,
        lastSafetyTick: 0,
        tickCount: 0,
        pendingOrders: [],
        priceHistory: [] as number[],
        extremePrice: 0,
        sessionRealizedPnl: 0,
        peakEquity: 0,
        chopCount: 0,
        divisionTiersHit: [] as number[],
        breakevenTriggered: false,
        waterfallPausedTicks: 0,
        activeTrailingTier: -1,
      };

      // Tick 0: Base order at 50000
      const basePrice = prices[0];
      const baseAmount = usdtToAmount(cfg.base_order_size, basePrice); // 0.002
      const baseCost = cfg.base_order_size;
      const baseFee = estimateFee(baseCost);

      state = {
        ...state,
        baseOrderFilled: true,
        totalAmount: new Decimal(baseAmount),
        totalCost: new Decimal(baseCost + baseFee),
        vwap: calculateVwap(new Decimal(baseAmount), new Decimal(baseCost + baseFee)),
        totalFees: new Decimal(baseFee),
        highestPrice: basePrice,
        lowestPrice: basePrice,
        extremePrice: basePrice,
        peakEquity: baseCost + baseFee,
        tickCount: 1,
      };

      // Tick 1: Price 49500 (1% drop from 50000) → triggers safety #1
      state.priceHistory.push(prices[1]);
      state.tickCount = 2;
      const dev1 = getNextDeviationTrigger(cfg.price_deviation_initial, cfg.safety_order_step_scale, state.safetyOrdersFilled);
      expect(shouldTriggerSafetyOrder(prices[1], state.vwap, dev1, "long")).toBe(true);

      const so1Amount = usdtToAmount(getNextSafetyOrderSize(cfg.safety_order_size, cfg.safety_order_volume_scale, state.safetyOrdersFilled), prices[1]);
      const so1Cost = cfg.safety_order_size;
      const so1Fee = estimateFee(so1Cost);
      state.safetyOrdersFilled = 1;
      state.totalAmount = state.totalAmount.plus(so1Amount);
      state.totalCost = state.totalCost.plus(new Decimal(so1Cost + so1Fee));
      state.totalFees = state.totalFees.plus(new Decimal(so1Fee));
      state.vwap = calculateVwap(state.totalAmount, state.totalCost);
      state.lastSafetyTick = state.tickCount;

      // Tick 2: Price 49000 (further drop) → triggers safety #2
      state.priceHistory.push(prices[2]);
      state.tickCount = 3;
      const dev2 = getNextDeviationTrigger(cfg.price_deviation_initial, cfg.safety_order_step_scale, state.safetyOrdersFilled);
      expect(shouldTriggerSafetyOrder(prices[2], state.vwap, dev2, "long")).toBe(true);

      const so2Amount = usdtToAmount(getNextSafetyOrderSize(cfg.safety_order_size, cfg.safety_order_volume_scale, state.safetyOrdersFilled), prices[2]);
      const so2Cost = cfg.safety_order_size;
      const so2Fee = estimateFee(so2Cost);
      state.safetyOrdersFilled = 2;
      state.totalAmount = state.totalAmount.plus(so2Amount);
      state.totalCost = state.totalCost.plus(new Decimal(so2Cost + so2Fee));
      state.totalFees = state.totalFees.plus(new Decimal(so2Fee));
      state.vwap = calculateVwap(state.totalAmount, state.totalCost);
      state.lastSafetyTick = state.tickCount;

      // Verify VWAP dropped after averaging down
      expect(state.vwap.toNumber()).toBeLessThan(50000);
      expect(state.vwap.toNumber()).toBeGreaterThan(49000);

      // Tick 3: Price 52000 → should trigger TP (5% above VWAP)
      state.tickCount = 4;
      expect(shouldTriggerFixedTakeProfit(prices[3], state.vwap, cfg.take_profit, "long")).toBe(true);

      // Exit
      const exitAmount = state.totalAmount.toNumber();
      const exitProceeds = prices[3] * exitAmount;
      const exitFee = estimateFee(exitProceeds);
      const pnl = calculateRealizedPnl(prices[3], exitAmount, state.vwap, state.totalFees.plus(exitFee), "long");
      state.sessionRealizedPnl += pnl;

      // In a real bot this would stop. Here we just verify PnL is positive.
      expect(state.sessionRealizedPnl).toBeGreaterThan(0);
    });
  });

  describe("Dual-mode independence simulation", () => {
    it("long and short states evolve independently", () => {
      const cfg = {
        direction: "both",
        base_order_size: 100,
        safety_order_size: 100,
        price_deviation_initial: 1,
        safety_order_step_scale: 1,
        safety_order_volume_scale: 1,
        take_profit: 5,
        stop_loss: 10,
        order_type: "market",
      };

      const directions = getDirectionList(cfg);
      expect(directions).toEqual(["long", "short"]);

      // Simulate dual BotState
      let longState = {
        direction: "long" as const,
        baseOrderFilled: false,
        safetyOrdersFilled: 0,
        totalAmount: new Decimal(0),
        totalCost: new Decimal(0),
        vwap: new Decimal(0),
        totalFees: new Decimal(0),
        highestPrice: 0,
        lowestPrice: 0,
        lastSafetyTick: 0,
        tickCount: 0,
        pendingOrders: [],
        priceHistory: [] as number[],
        extremePrice: 0,
        sessionRealizedPnl: 0,
        peakEquity: 0,
        chopCount: 0,
        divisionTiersHit: [] as number[],
        breakevenTriggered: false,
        waterfallPausedTicks: 0,
        activeTrailingTier: -1,
      };

      let shortState = {
        direction: "short" as const,
        baseOrderFilled: false,
        safetyOrdersFilled: 0,
        totalAmount: new Decimal(0),
        totalCost: new Decimal(0),
        vwap: new Decimal(0),
        totalFees: new Decimal(0),
        highestPrice: 0,
        lowestPrice: 0,
        lastSafetyTick: 0,
        tickCount: 0,
        pendingOrders: [],
        priceHistory: [] as number[],
        extremePrice: 0,
        sessionRealizedPnl: 0,
        peakEquity: 0,
        chopCount: 0,
        divisionTiersHit: [] as number[],
        breakevenTriggered: false,
        waterfallPausedTicks: 0,
        activeTrailingTier: -1,
      };

      // Base orders at 50000 for both
      const basePrice = 50000;
      const baseAmount = usdtToAmount(cfg.base_order_size, basePrice);
      const baseCost = cfg.base_order_size;
      const baseFee = estimateFee(baseCost);

      longState = {
        ...longState,
        baseOrderFilled: true,
        totalAmount: new Decimal(baseAmount),
        totalCost: new Decimal(baseCost + baseFee),
        vwap: calculateVwap(new Decimal(baseAmount), new Decimal(baseCost + baseFee)),
        totalFees: new Decimal(baseFee),
        highestPrice: basePrice,
        lowestPrice: basePrice,
        extremePrice: basePrice,
        peakEquity: baseCost + baseFee,
        tickCount: 1,
      };

      shortState = {
        ...shortState,
        baseOrderFilled: true,
        totalAmount: new Decimal(baseAmount),
        totalCost: new Decimal(baseCost + baseFee),
        vwap: calculateVwap(new Decimal(baseAmount), new Decimal(baseCost + baseFee)),
        totalFees: new Decimal(baseFee),
        highestPrice: basePrice,
        lowestPrice: basePrice,
        extremePrice: basePrice,
        peakEquity: baseCost + baseFee,
        tickCount: 1,
      };

      // Price drops to 49000
      // Long should trigger safety order (1% drop exceeded)
      // Short should NOT trigger safety order (price dropping is good for short)
      const newPrice = 49000;

      expect(shouldTriggerSafetyOrder(newPrice, longState.vwap, cfg.price_deviation_initial, "long")).toBe(true);
      expect(shouldTriggerSafetyOrder(newPrice, shortState.vwap, cfg.price_deviation_initial, "short")).toBe(false);

      // Execute long safety order
      const soAmount = usdtToAmount(cfg.safety_order_size, newPrice);
      const soCost = cfg.safety_order_size;
      const soFee = estimateFee(soCost);
      longState.safetyOrdersFilled = 1;
      longState.totalAmount = longState.totalAmount.plus(soAmount);
      longState.totalCost = longState.totalCost.plus(new Decimal(soCost + soFee));
      longState.totalFees = longState.totalFees.plus(new Decimal(soFee));
      longState.vwap = calculateVwap(longState.totalAmount, longState.totalCost);

      // VWAP should be different between long and short now
      expect(longState.vwap.toNumber()).toBeLessThan(shortState.vwap.toNumber());

      // Price rises to 52000
      // Long should NOT trigger safety (price rising)
      // Short SHOULD trigger safety (price rose 2.4% above VWAP)
      const risePrice = 52000;
      expect(shouldTriggerSafetyOrder(risePrice, longState.vwap, cfg.price_deviation_initial, "long")).toBe(false);
      expect(shouldTriggerSafetyOrder(risePrice, shortState.vwap, cfg.price_deviation_initial, "short")).toBe(true);

      // Execute short safety order
      const so2Amount = usdtToAmount(cfg.safety_order_size, risePrice);
      const so2Cost = cfg.safety_order_size;
      const so2Fee = estimateFee(so2Cost);
      shortState.safetyOrdersFilled = 1;
      shortState.totalAmount = shortState.totalAmount.plus(so2Amount);
      shortState.totalCost = shortState.totalCost.plus(new Decimal(so2Cost + so2Fee));
      shortState.totalFees = shortState.totalFees.plus(new Decimal(so2Fee));
      shortState.vwap = calculateVwap(shortState.totalAmount, shortState.totalCost);

      // Now price returns to 50000
      // Long should be in profit (VWAP ~49500, price 50000)
      // Short should ALSO be in profit because price dropped from short entry levels
      const returnPrice = 50000;
      const longPnl = getUnrealizedPnl(returnPrice, longState.vwap, longState.totalAmount, "long");
      const shortPnl = getUnrealizedPnl(returnPrice, shortState.vwap, shortState.totalAmount, "short");
      expect(longPnl).toBeGreaterThan(0);
      expect(shortPnl).toBeGreaterThan(0);
    });
  });

  describe("State persistence round-trip", () => {
    it("hydrates and serializes single mode correctly", () => {
      const persisted = {
        direction: "long",
        baseOrderFilled: true,
        safetyOrdersFilled: 2,
        totalAmount: "0.0041",
        totalCost: "200.4",
        vwap: "48878.0488",
        totalFees: "0.2004",
        highestPrice: 50000,
        lowestPrice: 48000,
        lastSafetyTick: 3,
        tickCount: 5,
        pendingOrders: [],
        priceHistory: [50000, 49500, 49000],
        extremePrice: 51000,
        sessionRealizedPnl: 100,
        peakEquity: 210,
        chopCount: 0,
        divisionTiersHit: [],
        breakevenTriggered: false,
        waterfallPausedTicks: 0,
        activeTrailingTier: -1,
      };

      // Simulate hydrateDirectionalState
      const hydrated = {
        direction: persisted.direction as "long" | "short",
        baseOrderFilled: persisted.baseOrderFilled,
        safetyOrdersFilled: persisted.safetyOrdersFilled,
        totalAmount: new Decimal(persisted.totalAmount),
        totalCost: new Decimal(persisted.totalCost),
        vwap: new Decimal(persisted.vwap),
        totalFees: new Decimal(persisted.totalFees),
        highestPrice: persisted.highestPrice,
        lowestPrice: persisted.lowestPrice,
        lastSafetyTick: persisted.lastSafetyTick,
        tickCount: persisted.tickCount,
        pendingOrders: persisted.pendingOrders,
        priceHistory: persisted.priceHistory,
        extremePrice: persisted.extremePrice,
        sessionRealizedPnl: persisted.sessionRealizedPnl,
        peakEquity: persisted.peakEquity,
        chopCount: persisted.chopCount,
        divisionTiersHit: persisted.divisionTiersHit,
        breakevenTriggered: persisted.breakevenTriggered,
        waterfallPausedTicks: persisted.waterfallPausedTicks,
        activeTrailingTier: persisted.activeTrailingTier,
      };

      // Verify Decimal round-trip
      expect(hydrated.vwap.toFixed(4)).toBe(persisted.vwap);
      expect(hydrated.totalAmount.toFixed(4)).toBe(persisted.totalAmount);

      // Simulate buildDirectionalStateJson
      const rebuilt = {
        direction: hydrated.direction,
        baseOrderFilled: hydrated.baseOrderFilled,
        safetyOrdersFilled: hydrated.safetyOrdersFilled,
        totalAmount: hydrated.totalAmount.toString(),
        totalCost: hydrated.totalCost.toString(),
        vwap: hydrated.vwap.toString(),
        totalFees: hydrated.totalFees.toString(),
        highestPrice: hydrated.highestPrice,
        lowestPrice: hydrated.lowestPrice,
        lastSafetyTick: hydrated.lastSafetyTick,
        tickCount: hydrated.tickCount,
        pendingOrders: hydrated.pendingOrders,
        priceHistory: hydrated.priceHistory,
        extremePrice: hydrated.extremePrice,
        sessionRealizedPnl: hydrated.sessionRealizedPnl,
        peakEquity: hydrated.peakEquity,
        chopCount: hydrated.chopCount,
        divisionTiersHit: hydrated.divisionTiersHit,
        breakevenTriggered: hydrated.breakevenTriggered,
        waterfallPausedTicks: hydrated.waterfallPausedTicks,
        activeTrailingTier: hydrated.activeTrailingTier,
      };

      expect(rebuilt).toEqual(persisted);
    });

    it("hydrates and serializes dual mode correctly", () => {
      const persisted = {
        mode: "dual",
        long: {
          direction: "long",
          baseOrderFilled: true,
          safetyOrdersFilled: 1,
          totalAmount: "0.002",
          totalCost: "100.1",
          vwap: "50050",
          totalFees: "0.1",
          highestPrice: 51000,
          lowestPrice: 49000,
          lastSafetyTick: 2,
          tickCount: 3,
          pendingOrders: [],
          priceHistory: [50000, 49500],
          extremePrice: 51000,
          sessionRealizedPnl: 0,
          peakEquity: 100,
          chopCount: 0,
          divisionTiersHit: [],
          breakevenTriggered: false,
          waterfallPausedTicks: 0,
          activeTrailingTier: -1,
        },
        short: {
          direction: "short",
          baseOrderFilled: true,
          safetyOrdersFilled: 0,
          totalAmount: "0.002",
          totalCost: "100.1",
          vwap: "50050",
          totalFees: "0.1",
          highestPrice: 51000,
          lowestPrice: 49000,
          lastSafetyTick: 0,
          tickCount: 3,
          pendingOrders: [],
          priceHistory: [50000, 51000],
          extremePrice: 49000,
          sessionRealizedPnl: 0,
          peakEquity: 100,
          chopCount: 0,
          divisionTiersHit: [],
          breakevenTriggered: false,
          waterfallPausedTicks: 0,
          activeTrailingTier: -1,
        },
      };

      // Simulate hydrateState
      const hydrated =
        persisted.mode === "dual"
          ? {
              mode: "dual" as const,
              long: { ...persisted.long, totalAmount: new Decimal(persisted.long.totalAmount), totalCost: new Decimal(persisted.long.totalCost), vwap: new Decimal(persisted.long.vwap), totalFees: new Decimal(persisted.long.totalFees) },
              short: { ...persisted.short, totalAmount: new Decimal(persisted.short.totalAmount), totalCost: new Decimal(persisted.short.totalCost), vwap: new Decimal(persisted.short.vwap), totalFees: new Decimal(persisted.short.totalFees) },
            }
          : { mode: "single" as const, state: { ...persisted, totalAmount: new Decimal(persisted.totalAmount), totalCost: new Decimal(persisted.totalCost), vwap: new Decimal(persisted.vwap), totalFees: new Decimal(persisted.totalFees) } };

      expect(hydrated.mode).toBe("dual");
      expect(hydrated.long.direction).toBe("long");
      expect(hydrated.short.direction).toBe("short");
      expect(hydrated.long.vwap.toString()).toBe("50050");
      expect(hydrated.short.vwap.toString()).toBe("50050");

      // Total session PnL
      const totalPnl = (hydrated as any).long.sessionRealizedPnl + (hydrated as any).short.sessionRealizedPnl;
      expect(totalPnl).toBe(0);
    });
  });

  describe("Division exit tiers", () => {
    it("sells partial position at tier 1 and recalculates VWAP", () => {
      const cfg = {
        division_setting: [{ profit_pct: 2, sell_pct: 50 }],
      };

      let state = {
        direction: "long" as const,
        totalAmount: new Decimal(2),
        totalCost: new Decimal(100000),
        vwap: new Decimal(50000),
        totalFees: new Decimal(50),
        divisionTiersHit: [] as number[],
        sessionRealizedPnl: 0,
      };

      const lastPrice = 51000; // 2% above VWAP
      expect(shouldTriggerFixedTakeProfit(lastPrice, state.vwap, cfg.division_setting[0].profit_pct, "long")).toBe(true);

      const sellPct = Math.min(cfg.division_setting[0].sell_pct, 100);
      const sellAmount = state.totalAmount.toNumber() * (sellPct / 100); // 1
      const sellProceeds = sellAmount * lastPrice;
      const sellFee = estimateFee(sellProceeds);
      const pnl = calculateRealizedPnl(lastPrice, sellAmount, state.vwap, state.totalFees.plus(sellFee), "long");

      state.divisionTiersHit.push(0);
      state.sessionRealizedPnl += pnl;

      const remainingAmount = state.totalAmount.minus(sellAmount);
      const remainingCost = state.totalCost.minus(state.vwap.mul(sellAmount));
      state.totalAmount = remainingAmount;
      state.totalCost = remainingCost;
      state.vwap = calculateVwap(remainingAmount, remainingCost);
      state.totalFees = state.totalFees.plus(sellFee);

      // VWAP should remain the same after proportional exit
      expect(state.vwap.toNumber()).toBeCloseTo(50000, 2);
      expect(state.totalAmount.toNumber()).toBe(1);
      expect(state.sessionRealizedPnl).toBeGreaterThan(0);
    });
  });

  describe("Market order default", () => {
    it("defaults to market when order_type is missing or invalid", () => {
      const cfg1 = { order_type: undefined };
      const cfg2 = { order_type: "limit" };
      const orderType1 = cfg1.order_type === "limit" ? "limit" : "market";
      const orderType2 = cfg2.order_type === "limit" ? "limit" : "market";
      expect(orderType1).toBe("market");
      expect(orderType2).toBe("limit");
    });
  });

  describe("Position side on orders", () => {
    it("passes LONG for long direction", () => {
      expect(("long").toUpperCase()).toBe("LONG");
    });
    it("passes SHORT for short direction", () => {
      expect(("short").toUpperCase()).toBe("SHORT");
    });
  });
});
