/**
 * DCA Futures Calculator Math
 * Matches the engine in apps/worker/src/engine/dca-loop.ts
 * All values are USDT-margined perpetual futures.
 */

export type Direction = "long" | "short" | "both";
export type LeverageType = "cross" | "isolated";
export type OrderType = "market" | "limit";

export interface DCACalculatorInputs {
  currentPrice: number;
  direction: Direction;
  leverage: number;
  leverageType: LeverageType;
  orderType: OrderType;
  baseOrderSize: number; // USDT
  safetyOrderSize: number; // USDT
  priceDeviationInitial: number; // %
  maxSafetyOrders: number;
  safetyOrderVolumeScale: number;
  safetyOrderStepScale: number;
  takeProfit: number; // % above VWAP
  stopLoss: number; // % below VWAP (0 = disabled)
  maxPositionSize: number; // USDT cap (0 = disabled)
}

export const defaultInputs: DCACalculatorInputs = {
  currentPrice: 50000,
  direction: "long",
  leverage: 10,
  leverageType: "cross",
  orderType: "market",
  baseOrderSize: 100,
  safetyOrderSize: 100,
  priceDeviationInitial: 1.0,
  maxSafetyOrders: 5,
  safetyOrderVolumeScale: 1.0,
  safetyOrderStepScale: 1.0,
  takeProfit: 5.0,
  stopLoss: 10.0,
  maxPositionSize: 0,
};

export interface DCALevel {
  level: number;
  deviationPct: number;
  triggerPrice: number;
  orderUsdt: number;
  contracts: number;
  marginRequired: number;
  cumulativeMargin: number;
  vwap: number;
  tpPrice: number;
  slPrice: number;
  notional: number;
}

export interface DCAResult {
  levels: DCALevel[];
  totalCapitalRequired: number; // total margin locked
  totalNotional: number;
  breakEvenPrice: number;
  tpPrice: number;
  slPrice: number;
  estimatedProfitAtTP: number;
  estimatedLossAtSL: number;
  riskRewardRatio: number;
  maxDrawdownPct: number;
  direction: Direction;
  leverage: number;
}

export const PRECISION = 1e8;

export function round8(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * PRECISION) / PRECISION;
}

function getNextSafetyOrderSize(baseSize: number, volumeScale: number, filled: number): number {
  return baseSize * Math.pow(volumeScale, filled);
}

function getNextDeviationTrigger(initial: number, stepScale: number, filled: number): number {
  return initial * Math.pow(stepScale, filled);
}

function usdtToContracts(usdt: number, price: number): number {
  if (!price || price <= 0) return 0;
  return usdt / price;
}

/**
 * Build the full DCA futures levels table.
 * Level 0 = base order.
 * Levels 1..N = safety orders.
 */
export function calculateDCAResult(inputs: DCACalculatorInputs): DCAResult {
  const {
    currentPrice,
    direction,
    leverage,
    baseOrderSize,
    safetyOrderSize,
    priceDeviationInitial,
    maxSafetyOrders,
    safetyOrderVolumeScale,
    safetyOrderStepScale,
    takeProfit,
    stopLoss,
    maxPositionSize,
  } = inputs;

  const levels: DCALevel[] = [];

  // Base order (level 0)
  let totalContracts = usdtToContracts(baseOrderSize, currentPrice);
  let totalCostUsdt = baseOrderSize;
  let totalMargin = baseOrderSize / leverage;

  const baseVwap = totalContracts > 0 ? totalCostUsdt / totalContracts : 0;
  const baseTP = direction === "short"
    ? baseVwap * (1 - takeProfit / 100)
    : baseVwap * (1 + takeProfit / 100);
  const baseSL = stopLoss > 0
    ? (direction === "short"
        ? baseVwap * (1 + stopLoss / 100)
        : baseVwap * (1 - stopLoss / 100))
    : 0;

  levels.push({
    level: 0,
    deviationPct: 0,
    triggerPrice: currentPrice,
    orderUsdt: baseOrderSize,
    contracts: round8(totalContracts),
    marginRequired: round8(baseOrderSize / leverage),
    cumulativeMargin: round8(totalMargin),
    vwap: round8(baseVwap),
    tpPrice: round8(baseTP),
    slPrice: round8(baseSL),
    notional: round8(baseOrderSize),
  });

  let deviationPct = priceDeviationInitial;
  let currentSOSize = safetyOrderSize;
  let safetyOrdersFilled = 0;

  for (let i = 1; i <= maxSafetyOrders; i++) {
    // Deviation trigger for this level
    const triggerDev = getNextDeviationTrigger(priceDeviationInitial, safetyOrderStepScale, safetyOrdersFilled);

    // Trigger price
    const triggerPrice = direction === "short"
      ? currentPrice * (1 + triggerDev / 100)
      : currentPrice * (1 - triggerDev / 100);

    if (triggerPrice <= 0) break;

    // SO size
    const soUsdt = getNextSafetyOrderSize(safetyOrderSize, safetyOrderVolumeScale, safetyOrdersFilled);

    // Enforce max position size
    const projectedContracts = totalContracts + usdtToContracts(soUsdt, triggerPrice);
    const projectedNotional = projectedContracts * triggerPrice;
    if (maxPositionSize > 0 && projectedNotional > maxPositionSize) {
      break;
    }

    totalCostUsdt += soUsdt;
    totalContracts += usdtToContracts(soUsdt, triggerPrice);
    totalMargin += soUsdt / leverage;
    safetyOrdersFilled++;

    const vwap = totalContracts > 0 ? totalCostUsdt / totalContracts : 0;
    const tp = direction === "short"
      ? vwap * (1 - takeProfit / 100)
      : vwap * (1 + takeProfit / 100);
    const sl = stopLoss > 0
      ? (direction === "short"
          ? vwap * (1 + stopLoss / 100)
          : vwap * (1 - stopLoss / 100))
      : 0;

    levels.push({
      level: i,
      deviationPct: round8(triggerDev),
      triggerPrice: round8(triggerPrice),
      orderUsdt: round8(soUsdt),
      contracts: round8(usdtToContracts(soUsdt, triggerPrice)),
      marginRequired: round8(soUsdt / leverage),
      cumulativeMargin: round8(totalMargin),
      vwap: round8(vwap),
      tpPrice: round8(tp),
      slPrice: round8(sl),
      notional: round8(projectedNotional),
    });

    deviationPct *= safetyOrderStepScale;
    currentSOSize *= safetyOrderVolumeScale;
  }

  const finalLevel = levels[levels.length - 1];
  const breakEvenPrice = finalLevel.vwap;
  const tpPrice = finalLevel.tpPrice;
  const slPrice = finalLevel.slPrice;

  // Profit at TP = (TP - VWAP) * totalContracts for long, reverse for short
  const profitAtTP = direction === "short"
    ? totalContracts * (breakEvenPrice - tpPrice)
    : totalContracts * (tpPrice - breakEvenPrice);

  // Loss at SL
  const lossAtSL = stopLoss > 0
    ? (direction === "short"
        ? totalContracts * (slPrice - breakEvenPrice)
        : totalContracts * (breakEvenPrice - slPrice))
    : 0;

  // Drawdown = from entry to lowest SO trigger
  const lowestTrigger = direction === "short"
    ? levels[levels.length - 1].triggerPrice
    : levels[levels.length - 1].triggerPrice;
  const portfolioAtLowest = totalContracts * lowestTrigger;
  const maxDrawdownPct = totalCostUsdt > 0
    ? ((totalCostUsdt - portfolioAtLowest) / totalCostUsdt) * 100
    : 0;

  const risk = lossAtSL;
  const reward = profitAtTP;
  const riskRewardRatio = risk > 0 && reward > 0 ? risk / reward : 0;

  return {
    levels,
    totalCapitalRequired: round8(totalMargin),
    totalNotional: round8(finalLevel.notional),
    breakEvenPrice: round8(breakEvenPrice),
    tpPrice: round8(tpPrice),
    slPrice: round8(slPrice),
    estimatedProfitAtTP: round8(profitAtTP),
    estimatedLossAtSL: round8(lossAtSL),
    riskRewardRatio: round8(riskRewardRatio),
    maxDrawdownPct: round8(Math.abs(maxDrawdownPct)),
    direction,
    leverage,
  };
}

export function formatRatio(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio <= 0) return "—";
  const rewardPerRisk = ratio > 0 ? 1 / ratio : 0;
  if (rewardPerRisk <= 0) return "—";
  return `1 : ${rewardPerRisk.toFixed(2)}`;
}
