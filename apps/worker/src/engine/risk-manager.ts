import { Decimal } from "@prisma/client/runtime/library";
import { logAlert, logState } from "@crypto-bot-platform/shared";
import type { ExchangeConnector } from "../exchange/connector";

// ============================================================
// Types
// ============================================================

export type RiskAction = "allow" | "pause" | "stop" | "reduce";

export interface RiskCheckResult {
  action: RiskAction;
  reason: string;
  metadata?: Record<string, any>;
}

export interface RiskState {
  // Tracking
  dailyRealizedPnl: number;
  dailyLossResetAt: number; // timestamp ms
  consecutiveLosses: number;
  apiCallsThisMinute: number;
  apiCallWindowStart: number; // timestamp ms
  positionEntryTime: number; // timestamp ms
  lastLoggedPauseReason: string;
  pauseLogDedupeCount: number;
}

export interface DirectionalPosition {
  direction: "long" | "short";
  baseOrderFilled: boolean;
  safetyOrdersFilled: number;
  totalAmount: Decimal;
  totalCost: Decimal;
  vwap: Decimal;
  totalFees: Decimal;
  highestPrice: number;
  lowestPrice: number;
  extremePrice: number;
  sessionRealizedPnl: number;
  peakEquity: number;
  chopCount: number;
  tickCount: number;
  // Waterfall / guard
  priceHistory: number[];
  waterfallPausedTicks: number;
  guardPriceHistory: { price: number; ts: number }[];
  guardPausedUntil: number;
  breakevenTriggered: boolean;
}

// ============================================================
// Defaults
// ============================================================

const DEFAULT_WATERFALL_WINDOW_TICKS = 12;
const DEFAULT_WATERFALL_PAUSE_TICKS = 6;
const DEFAULT_BREAKEVEN_BUFFER_PCT = 0.3;
const DEFAULT_API_CALLS_PER_MINUTE_LIMIT = 60;

// ============================================================
// Helpers
// ============================================================

function nowMs(): number {
  return Date.now();
}

function startOfDayTs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function getUnrealizedPnl(lastPrice: number, pos: DirectionalPosition): number {
  const costBasis = pos.vwap.mul(pos.totalAmount.toNumber()).toNumber();
  const marketValue = lastPrice * pos.totalAmount.toNumber();
  return pos.direction === "long" ? marketValue - costBasis : costBasis - marketValue;
}

function getCurrentEquity(lastPrice: number, pos: DirectionalPosition): number {
  return pos.totalCost.toNumber() + getUnrealizedPnl(lastPrice, pos);
}

function getUnrealizedPct(lastPrice: number, pos: DirectionalPosition): number {
  if (pos.vwap.lessThanOrEqualTo(0)) return 0;
  const pnl = getUnrealizedPnl(lastPrice, pos);
  const costBasis = pos.vwap.mul(pos.totalAmount.toNumber()).toNumber();
  return costBasis > 0 ? (pnl / costBasis) * 100 : 0;
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

function checkWaterfall(priceHistory: number[], ratio: number): boolean {
  if (priceHistory.length < 3) return false;
  const min = Math.min(...priceHistory);
  const max = Math.max(...priceHistory);
  if (min <= 0) return false;
  const volatility = ((max - min) / min) * 100;
  return volatility > ratio;
}

function evaluateGuard(
  guardPriceHistory: { price: number; ts: number }[],
  guardPausedUntil: number,
  lastPrice: number,
  now: number,
  cfg: any
): { paused: boolean; updatedHistory: { price: number; ts: number }[]; updatedPausedUntil: number } {
  if (!cfg.guard_enabled) {
    return { paused: false, updatedHistory: guardPriceHistory, updatedPausedUntil: guardPausedUntil };
  }
  const durationMs = (cfg.guard_duration || 2) * 60_000;
  const triggerPct = cfg.guard_trigger_pct || 3;
  const cutoff = now - durationMs;
  const filtered = guardPriceHistory.filter((s) => s.ts >= cutoff);

  if (guardPausedUntil > now) {
    return { paused: true, updatedHistory: filtered, updatedPausedUntil: guardPausedUntil };
  }

  for (const sample of filtered) {
    const pctChange = Math.abs((lastPrice - sample.price) / sample.price) * 100;
    if (pctChange > triggerPct) {
      const newPausedUntil = now + (cfg.guard_pause_minutes || 480) * 60_000;
      return { paused: true, updatedHistory: filtered, updatedPausedUntil: newPausedUntil };
    }
  }

  filtered.push({ price: lastPrice, ts: now });
  return { paused: false, updatedHistory: filtered, updatedPausedUntil: 0 };
}

// ============================================================
// Risk Manager
// ============================================================

export class RiskManager {
  private botId: string;
  private cfg: any;
  private state: RiskState;

  constructor(botId: string, cfg: any) {
    this.botId = botId;
    this.cfg = cfg;
    this.state = {
      dailyRealizedPnl: 0,
      dailyLossResetAt: startOfDayTs(),
      consecutiveLosses: 0,
      apiCallsThisMinute: 0,
      apiCallWindowStart: nowMs(),
      positionEntryTime: 0,
      lastLoggedPauseReason: "",
      pauseLogDedupeCount: 0,
    };
  }

  /** Call when a new position is entered (base order filled). */
  onPositionEntry(): void {
    this.state.positionEntryTime = nowMs();
  }

  /** Call when a trade closes (TP, SL, chop, division, etc.). */
  onTradeClosed(realizedPnl: number): void {
    if (realizedPnl < 0) {
      this.state.consecutiveLosses++;
    } else {
      this.state.consecutiveLosses = 0;
    }
    this.state.dailyRealizedPnl += realizedPnl;
  }

  /** Call before any API request to enforce rate limiting. */
  recordApiCall(): RiskCheckResult {
    const now = nowMs();
    if (now - this.state.apiCallWindowStart >= 60_000) {
      this.state.apiCallWindowStart = now;
      this.state.apiCallsThisMinute = 0;
    }
    this.state.apiCallsThisMinute++;
    const limit = this.cfg.api_rate_limit_per_minute || DEFAULT_API_CALLS_PER_MINUTE_LIMIT;
    if (this.state.apiCallsThisMinute > limit) {
      return {
        action: "pause",
        reason: `API rate limit exceeded (${this.state.apiCallsThisMinute}/${limit} calls/min). Pausing to avoid exchange ban.`,
        metadata: { apiCallsThisMinute: this.state.apiCallsThisMinute, limit },
      };
    }
    return { action: "allow", reason: "" };
  }

  // ------------------------------------------------------------------
  // Daily reset
  // ------------------------------------------------------------------
  private ensureDailyReset(): void {
    const sod = startOfDayTs();
    if (this.state.dailyLossResetAt < sod) {
      this.state.dailyRealizedPnl = 0;
      this.state.dailyLossResetAt = sod;
    }
  }

  // ------------------------------------------------------------------
  // Individual risk checks — public so the DCA loop can call them
  // at the appropriate stage (guard early, SL after TP, etc.)
  // ------------------------------------------------------------------

  public checkDailyLossLimit(): RiskCheckResult {
    if (!this.cfg.max_daily_loss_usdt) return { action: "allow", reason: "" };
    this.ensureDailyReset();
    if (this.state.dailyRealizedPnl < -this.cfg.max_daily_loss_usdt) {
      return {
        action: "stop",
        reason: `Daily loss limit reached: $${this.state.dailyRealizedPnl.toFixed(2)} < -$${this.cfg.max_daily_loss_usdt}. Stopping bot.`,
        metadata: { dailyRealizedPnl: this.state.dailyRealizedPnl, maxDailyLoss: this.cfg.max_daily_loss_usdt },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkSessionLoss(sessionRealizedPnl: number): RiskCheckResult {
    if (!this.cfg.max_session_loss_usdt) return { action: "allow", reason: "" };
    if (sessionRealizedPnl < -this.cfg.max_session_loss_usdt) {
      return {
        action: "stop",
        reason: `Session loss limit reached: $${sessionRealizedPnl.toFixed(2)} < -$${this.cfg.max_session_loss_usdt}. Stopping bot.`,
        metadata: { sessionRealizedPnl, maxSessionLoss: this.cfg.max_session_loss_usdt },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkMaxDrawdown(lastPrice: number, pos: DirectionalPosition): RiskCheckResult {
    if (!this.cfg.max_drawdown_pct) return { action: "allow", reason: "" };
    const currentEquity = getCurrentEquity(lastPrice, pos);
    if (currentEquity > pos.peakEquity) {
      pos.peakEquity = currentEquity;
    }
    if (pos.peakEquity > 0) {
      const drawdown = ((pos.peakEquity - currentEquity) / pos.peakEquity) * 100;
      if (drawdown >= this.cfg.max_drawdown_pct) {
        return {
          action: "stop",
          reason: `Max drawdown reached: ${drawdown.toFixed(2)}% ≥ ${this.cfg.max_drawdown_pct}%. Stopping bot.`,
          metadata: { drawdown, maxDrawdown: this.cfg.max_drawdown_pct, peakEquity: pos.peakEquity, currentEquity },
        };
      }
    }
    return { action: "allow", reason: "" };
  }

  public checkMaxHoldingTime(): RiskCheckResult {
    if (!this.cfg.max_holding_time_minutes || this.state.positionEntryTime === 0) return { action: "allow", reason: "" };
    const elapsedMin = (nowMs() - this.state.positionEntryTime) / 60_000;
    if (elapsedMin >= this.cfg.max_holding_time_minutes) {
      return {
        action: "stop",
        reason: `Max holding time reached: ${elapsedMin.toFixed(1)}min ≥ ${this.cfg.max_holding_time_minutes}min. Stopping bot.`,
        metadata: { elapsedMin, maxHoldingTime: this.cfg.max_holding_time_minutes },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkConsecutiveLosses(): RiskCheckResult {
    if (!this.cfg.max_consecutive_losses) return { action: "allow", reason: "" };
    if (this.state.consecutiveLosses >= this.cfg.max_consecutive_losses) {
      return {
        action: "stop",
        reason: `Max consecutive losses reached: ${this.state.consecutiveLosses}/${this.cfg.max_consecutive_losses}. Stopping bot.`,
        metadata: { consecutiveLosses: this.state.consecutiveLosses, maxConsecutiveLosses: this.cfg.max_consecutive_losses },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkStopLoss(lastPrice: number, pos: DirectionalPosition): RiskCheckResult {
    if (!this.cfg.stop_loss || this.cfg.stop_loss <= 0) return { action: "allow", reason: "" };
    if (shouldTriggerStopLoss(lastPrice, pos.vwap, this.cfg.stop_loss, pos.direction)) {
      return {
        action: "stop",
        reason: `Fixed stop-loss triggered: ${this.cfg.stop_loss}% from VWAP ${pos.vwap.toFixed(4)}`,
        metadata: { lastPrice, vwap: pos.vwap.toString(), stopLossPct: this.cfg.stop_loss },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkBreakevenStopLoss(lastPrice: number, pos: DirectionalPosition): RiskCheckResult {
    if (!this.cfg.breakeven_after_safety_orders || this.cfg.breakeven_after_safety_orders <= 0) {
      return { action: "allow", reason: "" };
    }
    if (pos.safetyOrdersFilled < this.cfg.breakeven_after_safety_orders || pos.breakevenTriggered) {
      return { action: "allow", reason: "" };
    }
    const bePrice =
      pos.direction === "long"
        ? pos.vwap.mul(1 + DEFAULT_BREAKEVEN_BUFFER_PCT / 100)
        : pos.vwap.mul(1 - DEFAULT_BREAKEVEN_BUFFER_PCT / 100);
    const hitBreakeven =
      pos.direction === "long" ? new Decimal(lastPrice).gte(bePrice) : new Decimal(lastPrice).lte(bePrice);
    if (hitBreakeven) {
      pos.breakevenTriggered = true;
      return {
        action: "allow", // breakeven is armed, not triggered yet
        reason: `Breakeven SL armed at ${pos.vwap.toFixed(2)} + ${DEFAULT_BREAKEVEN_BUFFER_PCT}% buffer`,
        metadata: { breakevenPrice: pos.vwap.toString(), bufferPct: DEFAULT_BREAKEVEN_BUFFER_PCT },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkBreakevenTriggered(lastPrice: number, pos: DirectionalPosition): RiskCheckResult {
    if (!pos.breakevenTriggered) return { action: "allow", reason: "" };
    const beTrigger =
      pos.direction === "long"
        ? new Decimal(lastPrice).lte(pos.vwap)
        : new Decimal(lastPrice).gte(pos.vwap);
    if (beTrigger) {
      return {
        action: "stop",
        reason: "Breakeven stop-loss triggered",
        metadata: { lastPrice, vwap: pos.vwap.toString() },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkChopLoss(lastPrice: number, pos: DirectionalPosition): RiskCheckResult {
    if (!this.cfg.chop_loss_enabled || !this.cfg.chop_loss_pct || !this.cfg.chop_sell_pct) {
      return { action: "allow", reason: "" };
    }
    const unrealizedPct = Math.abs(getUnrealizedPct(lastPrice, pos));
    if (unrealizedPct >= this.cfg.chop_loss_pct) {
      return {
        action: "reduce",
        reason: `Chop-loss triggered: ${unrealizedPct.toFixed(2)}% ≥ ${this.cfg.chop_loss_pct}%`,
        metadata: {
          chopSellPct: this.cfg.chop_sell_pct,
          unrealizedPct,
          chopCount: pos.chopCount + 1,
        },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkMaxChopCount(pos: DirectionalPosition): RiskCheckResult {
    if (!this.cfg.max_chop_count || this.cfg.max_chop_count <= 0) return { action: "allow", reason: "" };
    if (pos.chopCount >= this.cfg.max_chop_count) {
      return {
        action: "stop",
        reason: `Max chop count (${this.cfg.max_chop_count}) reached. Stopping bot.`,
        metadata: { chopCount: pos.chopCount, maxChopCount: this.cfg.max_chop_count },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkMaxSafetyOrders(pos: DirectionalPosition): RiskCheckResult {
    if (pos.safetyOrdersFilled < this.cfg.safety_order_max_count) return { action: "allow", reason: "" };
    return {
      action: "stop",
      reason: `Max safety orders reached (${pos.safetyOrdersFilled}/${this.cfg.safety_order_max_count}) without profit`,
      metadata: { maxSafetyOrders: this.cfg.safety_order_max_count, totalAmount: pos.totalAmount.toString(), vwap: pos.vwap.toString() },
    };
  }

  public checkWaterfall(pos: DirectionalPosition): RiskCheckResult {
    if (!this.cfg.waterfall_prevention) return { action: "allow", reason: "" };
    if (pos.waterfallPausedTicks > 0) {
      return {
        action: "pause",
        reason: `Waterfall pause active: ${pos.waterfallPausedTicks} ticks remaining`,
        metadata: { waterfallPausedTicks: pos.waterfallPausedTicks },
      };
    }
    const ratio = this.cfg.waterfall_prevention_ratio || 3;
    if (checkWaterfall(pos.priceHistory, ratio)) {
      return {
        action: "pause",
        reason: `Waterfall detected! Volatility exceeded ${ratio}%. Pausing safety orders for ${DEFAULT_WATERFALL_PAUSE_TICKS} ticks.`,
        metadata: { priceHistory: pos.priceHistory.slice(-5), ratio },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkGuard(lastPrice: number, pos: DirectionalPosition): RiskCheckResult {
    const now = nowMs();
    const guard = evaluateGuard(pos.guardPriceHistory, pos.guardPausedUntil, lastPrice, now, this.cfg);
    pos.guardPriceHistory = guard.updatedHistory;
    pos.guardPausedUntil = guard.updatedPausedUntil;
    if (guard.paused) {
      return {
        action: "pause",
        reason: `Guard triggered: price spike detected. Bot paused until ${new Date(pos.guardPausedUntil).toISOString()}`,
        metadata: { guardPausedUntil: pos.guardPausedUntil, price: lastPrice },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkTwoWayLoss(lastPrice: number, longPos?: DirectionalPosition, shortPos?: DirectionalPosition): RiskCheckResult {
    if (!this.cfg.two_way_loss_enabled || !longPos || !shortPos) return { action: "allow", reason: "" };
    if (!longPos.baseOrderFilled || !shortPos.baseOrderFilled) return { action: "allow", reason: "" };
    const longSl = shouldTriggerStopLoss(lastPrice, longPos.vwap, this.cfg.stop_loss || 0, "long");
    const shortSl = shouldTriggerStopLoss(lastPrice, shortPos.vwap, this.cfg.stop_loss || 0, "short");
    if (longSl && shortSl) {
      return {
        action: "stop",
        reason: "Two-way loss triggered! Both long and short hit SL simultaneously. Emergency exit.",
        metadata: { price: lastPrice, longVwap: longPos.vwap.toString(), shortVwap: shortPos.vwap.toString() },
      };
    }
    return { action: "allow", reason: "" };
  }

  public checkPositionSize(projectedAmount: number): RiskCheckResult {
    if (!this.cfg.max_position_size || projectedAmount <= this.cfg.max_position_size) {
      return { action: "allow", reason: "" };
    }
    return {
      action: "pause",
      reason: `Projected position size ${projectedAmount.toFixed(6)} exceeds max ${this.cfg.max_position_size}`,
      metadata: { projectedAmount, maxPositionSize: this.cfg.max_position_size },
    };
  }

  public checkVolatilityExpansion(pos: DirectionalPosition): RiskCheckResult {
    if (!this.cfg.volatility_pause_pct || pos.priceHistory.length < 5) return { action: "allow", reason: "" };
    const recent = pos.priceHistory.slice(-5);
    const min = Math.min(...recent);
    const max = Math.max(...recent);
    if (min <= 0) return { action: "allow", reason: "" };
    const vol = ((max - min) / min) * 100;
    if (vol > this.cfg.volatility_pause_pct) {
      return {
        action: "pause",
        reason: `Short-term volatility expansion detected: ${vol.toFixed(2)}% > ${this.cfg.volatility_pause_pct}%`,
        metadata: { volatility: vol, threshold: this.cfg.volatility_pause_pct, recentPrices: recent },
      };
    }
    return { action: "allow", reason: "" };
  }

  // ------------------------------------------------------------------
  // Async checks (require exchange data)
  // ------------------------------------------------------------------

  async checkLiquidationProximity(
    symbol: string,
    connector: ExchangeConnector,
    pos: DirectionalPosition
  ): Promise<RiskCheckResult> {
    if (!connector.fetchPositions) return { action: "allow", reason: "" };
    try {
      const positions = await connector.fetchPositions(symbol);
      const exchangePos = positions.find((p) => p.symbol === symbol);
      if (!exchangePos || !exchangePos.liquidationPrice || exchangePos.entryPrice <= 0) {
        return { action: "allow", reason: "" };
      }
      const liqDistance = Math.abs((exchangePos.liquidationPrice - exchangePos.entryPrice) / exchangePos.entryPrice) * 100;
      if (liqDistance < 15) {
        return {
          action: "stop",
          reason: `CRITICAL: Liquidation price ${exchangePos.liquidationPrice} is only ${liqDistance.toFixed(2)}% away from entry!`,
          metadata: { liquidationPrice: exchangePos.liquidationPrice, entryPrice: exchangePos.entryPrice, leverage: exchangePos.leverage },
        };
      }
      if (liqDistance < 25) {
        // Warning but don't stop — logged as state so it appears every sync tick
        logState({
          botId: this.botId,
          message: `WARNING: Liquidation price is ${liqDistance.toFixed(2)}% away from entry`,
          metadata: { liquidationPrice: exchangePos.liquidationPrice, entryPrice: exchangePos.entryPrice, leverage: exchangePos.leverage },
        });
      }
    } catch {
      // ignore
    }
    return { action: "allow", reason: "" };
  }

  async checkAccountRisk(
    symbol: string,
    connector: ExchangeConnector,
    pos: DirectionalPosition
  ): Promise<RiskCheckResult> {
    if (!this.cfg.max_account_risk_pct || !connector.fetchPositions) return { action: "allow", reason: "" };
    try {
      const positions = await connector.fetchPositions();
      const totalNotional = positions.reduce((sum, p) => sum + (p.notional || 0), 0);
      const botNotional = pos.totalAmount.toNumber() * pos.vwap.toNumber();
      if (totalNotional > 0) {
        const concentration = (botNotional / totalNotional) * 100;
        if (concentration > this.cfg.max_account_risk_pct) {
          return {
            action: "pause",
            reason: `Position concentration too high: ${concentration.toFixed(2)}% of account > ${this.cfg.max_account_risk_pct}% limit`,
            metadata: { concentration, maxAccountRiskPct: this.cfg.max_account_risk_pct, botNotional, totalNotional },
          };
        }
      }
    } catch {
      // ignore
    }
    return { action: "allow", reason: "" };
  }

  // ------------------------------------------------------------------
  // Composite evaluation
  // ------------------------------------------------------------------

  /**
   * Evaluate all synchronous risk checks for a single direction.
   * Returns the most severe result. Also updates internal risk state
   * (drawdown peaks, waterfall ticks, etc.).
   */
  evaluateDirection(
    lastPrice: number,
    pos: DirectionalPosition,
    sessionRealizedPnl: number
  ): RiskCheckResult {
    const checks: RiskCheckResult[] = [
      this.recordApiCall(),
      this.checkDailyLossLimit(),
      this.checkSessionLoss(sessionRealizedPnl),
      this.checkMaxDrawdown(lastPrice, pos),
      this.checkMaxHoldingTime(),
      this.checkConsecutiveLosses(),
      this.checkStopLoss(lastPrice, pos),
      this.checkBreakevenStopLoss(lastPrice, pos),
      this.checkBreakevenTriggered(lastPrice, pos),
      this.checkChopLoss(lastPrice, pos),
      this.checkMaxChopCount(pos),
      this.checkMaxSafetyOrders(pos),
      this.checkWaterfall(pos),
      this.checkGuard(lastPrice, pos),
      this.checkVolatilityExpansion(pos),
    ];

    // Severity ranking: stop > reduce > pause > allow
    const severity: Record<RiskAction, number> = { stop: 3, reduce: 2, pause: 1, allow: 0 };
    let worst: RiskCheckResult = { action: "allow", reason: "" };
    for (const r of checks) {
      if (severity[r.action] > severity[worst.action]) {
        worst = r;
      }
    }

    // Dedupe repeated pause logs
    if (worst.action === "pause" && worst.reason === this.state.lastLoggedPauseReason) {
      this.state.pauseLogDedupeCount++;
      if (this.state.pauseLogDedupeCount % 6 !== 0) {
        // Log every ~30s (6 ticks at 5s each)
        return worst;
      }
    } else if (worst.action === "pause") {
      this.state.lastLoggedPauseReason = worst.reason;
      this.state.pauseLogDedupeCount = 1;
    } else {
      this.state.lastLoggedPauseReason = "";
      this.state.pauseLogDedupeCount = 0;
    }

    if (worst.action !== "allow") {
      const level = worst.action === "stop" ? "error" : "warn";
      logAlert({
        botId: this.botId,
        message: `[RISK] ${worst.reason}`,
        metadata: { action: worst.action, ...worst.metadata },
      });
    }

    return worst;
  }

  /**
   * Evaluate dual-mode cross-direction risk (two-way loss).
   */
  evaluateDual(lastPrice: number, longPos?: DirectionalPosition, shortPos?: DirectionalPosition): RiskCheckResult {
    return this.checkTwoWayLoss(lastPrice, longPos, shortPos);
  }

  /**
   * Check if an order would violate position size limits (called before placing orders).
   */
  evaluateOrderSize(projectedAmount: number): RiskCheckResult {
    return this.checkPositionSize(projectedAmount);
  }

  /** Hydrate internal state from persisted JSON (if any). */
  static hydrate(botId: string, cfg: any, persisted?: any): RiskManager {
    const rm = new RiskManager(botId, cfg);
    if (persisted) {
      rm.state.dailyRealizedPnl = persisted.dailyRealizedPnl ?? 0;
      rm.state.dailyLossResetAt = persisted.dailyLossResetAt ?? startOfDayTs();
      rm.state.consecutiveLosses = persisted.consecutiveLosses ?? 0;
      rm.state.apiCallsThisMinute = persisted.apiCallsThisMinute ?? 0;
      rm.state.apiCallWindowStart = persisted.apiCallWindowStart ?? nowMs();
      rm.state.positionEntryTime = persisted.positionEntryTime ?? 0;
    }
    return rm;
  }

  /** Serialize state for persistence. */
  serialize(): object {
    return {
      dailyRealizedPnl: this.state.dailyRealizedPnl,
      dailyLossResetAt: this.state.dailyLossResetAt,
      consecutiveLosses: this.state.consecutiveLosses,
      apiCallsThisMinute: this.state.apiCallsThisMinute,
      apiCallWindowStart: this.state.apiCallWindowStart,
      positionEntryTime: this.state.positionEntryTime,
    };
  }
}

// ============================================================
// Static helpers for non-instantiated checks
// ============================================================

export async function checkGlobalCorrelation(
  botId: string,
  symbol: string,
  prisma: any
): Promise<{ overlapCount: number; warning: string }> {
  try {
    const overlapping = await prisma.bot.findMany({
      where: {
        status: "running",
        tradingPair: symbol,
        id: { not: botId },
      },
      select: { id: true, name: true },
    });
    if (overlapping.length > 0) {
      return {
        overlapCount: overlapping.length,
        warning: `${overlapping.length} other bot(s) running on ${symbol}: ${overlapping.map((b: any) => b.name).join(", ")}`,
      };
    }
  } catch {
    // ignore
  }
  return { overlapCount: 0, warning: "" };
}
