import { prisma } from "@crypto-bot-platform/prisma";
import { getConnector } from "../exchange/registry";
import { registerBot, unregisterBot } from "./bot-registry";
import { decrypt } from "../services/encryption";
import { Decimal } from "@prisma/client/runtime/library";
import { logOrder, logTrade, logState, logFee, logAlert } from "@crypto-bot-platform/shared";
import type { ExchangeConnector } from "../exchange/connector";
import { checkIndicatorSignal } from "../indicators";
import { RiskManager, checkGlobalCorrelation } from "./risk-manager";

// ============================================================
// Types
// ============================================================

interface PendingOrder {
  exchangeOrderId: string;
  side: "buy" | "sell";
  amount: number;
  filled: number;
  placedAtTick: number;
  price?: number;
}

interface DirectionalState {
  direction: "long" | "short";
  baseOrderFilled: boolean;
  safetyOrdersFilled: number;
  totalAmount: Decimal;
  totalCost: Decimal;
  vwap: Decimal;
  totalFees: Decimal;
  highestPrice: number;
  lowestPrice: number;
  lastSafetyTick: number;
  tickCount: number;
  // Advanced features
  pendingOrders: PendingOrder[];
  priceHistory: number[]; // rolling window for waterfall detection
  extremePrice: number; // highest (long) / lowest (short) since entry
  sessionRealizedPnl: number;
  peakEquity: number;
  chopCount: number;
  divisionTiersHit: number[];
  breakevenTriggered: boolean;
  waterfallPausedTicks: number;
  activeTrailingTier: number; // index of current trailing tier, -1 = none
  // Guard
  guardPriceHistory: { price: number; ts: number }[];
  guardPausedUntil: number;
  // Trend / RSI tracking
  emaFastHistory: number[];
  emaSlowHistory: number[];
  rsiValue: number | null;
  // Signal deduplication (Sample/newRobot style)
  lastMacdSignalTime: number;
  lastRsiSignalTime: number;
  lastEmaSignalTime: number;
  // Snapshot of last known market price for list-page PnL display
  lastPrice: number;
}

type BotState =
  | { mode: "single"; state: DirectionalState }
  | { mode: "dual"; long: DirectionalState; short: DirectionalState };

// ============================================================
// Constants
// ============================================================

const botStates = new Map<string, BotState>();
const botIntervals = new Map<string, NodeJS.Timeout>();
const botPersistIntervals = new Map<string, NodeJS.Timeout>();
const botErrorCounts = new Map<string, number>();
const botRiskManagers = new Map<string, RiskManager>();

const MAX_CONSECUTIVE_ERRORS = 3;
const SAFETY_COOLDOWN_TICKS = 1;
const POSITION_SYNC_INTERVAL = 10;
const FUNDING_RATE_INTERVAL = 30;
const LIMIT_ORDER_MAX_TICKS = 10; // cancel & re-place after 50s

// ============================================================
// Helpers
// ============================================================

function usdtToAmount(usdtValue: number, price: number): number {
  if (!price || price <= 0) return 0;
  return usdtValue / price;
}

function estimateFee(cost: number): number {
  return cost * 0.001; // Default 0.1% estimate
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

function getNextSafetyOrderSize(
  baseSize: number,
  volumeScale: number,
  safetyOrdersFilled: number,
  rounds?: any[],
  roundIndex?: number
): number {
  if (rounds && roundIndex !== undefined && rounds[roundIndex]) {
    const r = rounds[roundIndex];
    if (roundIndex === 0) return baseSize * (r.multiplier || 1);
    const prev = getNextSafetyOrderSize(baseSize, volumeScale, safetyOrdersFilled - 1, rounds, roundIndex - 1);
    return prev * (r.multiplier || 1);
  }
  return baseSize * Math.pow(volumeScale, safetyOrdersFilled);
}

function getNextDeviationTrigger(
  initialDeviation: number,
  stepScale: number,
  safetyOrdersFilled: number,
  rounds?: any[],
  roundIndex?: number
): number {
  if (rounds && roundIndex !== undefined && rounds[roundIndex]) {
    return rounds[roundIndex].price_fluctuation_pct ?? initialDeviation;
  }
  return initialDeviation * Math.pow(stepScale, safetyOrdersFilled);
}

function calculateEMA(values: number[], period: number): number {
  if (values.length < period) return values[values.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = values[0];
  for (let i = 1; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(closes: number[], period: number = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[closes.length - i] - closes[closes.length - i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function computeTrend(state: DirectionalState, cfg: any, lastPrice: number): "uptrend" | "downtrend" | "neutral" {
  if (!cfg.ema_fast || !cfg.ema_slow) return "neutral";
  state.emaFastHistory.push(lastPrice);
  state.emaSlowHistory.push(lastPrice);
  if (state.emaFastHistory.length > cfg.ema_fast * 2) state.emaFastHistory.shift();
  if (state.emaSlowHistory.length > cfg.ema_slow * 2) state.emaSlowHistory.shift();
  const fast = calculateEMA(state.emaFastHistory, cfg.ema_fast);
  const slow = calculateEMA(state.emaSlowHistory, cfg.ema_slow);
  if (fast > slow * 1.001) return "uptrend";
  if (fast < slow * 0.999) return "downtrend";
  return "neutral";
}

function shouldTriggerSafetyOrder(
  lastPrice: number,
  vwap: Decimal,
  deviation: number,
  direction: "long" | "short"
): boolean {
  if (vwap.lessThanOrEqualTo(0)) return false;
  if (direction === "long") {
    const dropPct = vwap.minus(lastPrice).div(vwap).mul(100).toNumber();
    return dropPct >= deviation;
  } else {
    const risePct = new Decimal(lastPrice).minus(vwap).div(vwap).mul(100).toNumber();
    return risePct >= deviation;
  }
}

function shouldTriggerFixedTakeProfit(
  lastPrice: number,
  vwap: Decimal,
  takeProfitPercent: number,
  direction: "long" | "short"
): boolean {
  if (vwap.lessThanOrEqualTo(0)) return false;
  if (direction === "long") {
    const tpPrice = vwap.mul(1 + takeProfitPercent / 100);
    return new Decimal(lastPrice).gte(tpPrice);
  } else {
    const tpPrice = vwap.mul(1 - takeProfitPercent / 100);
    return new Decimal(lastPrice).lte(tpPrice);
  }
}

function calculateRealizedPnl(
  sellPrice: number,
  sellAmount: number,
  vwap: Decimal,
  totalFees: Decimal,
  direction: "long" | "short"
): number {
  const proceeds = sellPrice * sellAmount;
  const costBasis = vwap.mul(sellAmount).toNumber();
  const grossPnl = direction === "long" ? proceeds - costBasis : costBasis - proceeds;
  return grossPnl - totalFees.toNumber();
}

function getUnrealizedPnl(lastPrice: number, state: DirectionalState): number {
  const costBasis = state.vwap.mul(state.totalAmount.toNumber()).toNumber();
  const marketValue = lastPrice * state.totalAmount.toNumber();
  return state.direction === "long" ? marketValue - costBasis : costBasis - marketValue;
}

function getUnrealizedPct(lastPrice: number, state: DirectionalState): number {
  if (state.vwap.lessThanOrEqualTo(0)) return 0;
  const pnl = getUnrealizedPnl(lastPrice, state);
  const costBasis = state.vwap.mul(state.totalAmount.toNumber()).toNumber();
  return costBasis > 0 ? (pnl / costBasis) * 100 : 0;
}

function getDirectionList(cfg: any): ("long" | "short")[] {
  const d = cfg.direction || "long";
  return d === "both" ? ["long", "short"] : [d];
}

function isDual(cfg: any): boolean {
  return cfg.direction === "both";
}

function getDirectionalState(botState: BotState, dir: "long" | "short"): DirectionalState {
  return botState.mode === "dual" ? botState[dir]! : botState.state;
}

function getTotalSessionPnl(botState: BotState): number {
  if (botState.mode === "dual") {
    return botState.long.sessionRealizedPnl + botState.short.sessionRealizedPnl;
  }
  return botState.state.sessionRealizedPnl;
}

function updateDirectionalState(
  botState: BotState,
  dir: "long" | "short",
  state: DirectionalState
): void {
  if (botState.mode === "dual") {
    botState[dir] = state;
  } else {
    botState.state = state;
  }
}

// ============================================================
// Core loop
// ============================================================

export async function startDcaLoop(botId: string): Promise<void> {
  try {
    await registerBot(botId);
    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { connection: true },
    });
    if (!bot) {
      await unregisterBot(botId);
      return;
    }

    const cfg = bot.configJson as any;
    const connector = getConnector(bot.connection.exchangeId, bot.mode, botId);
    const symbol = (bot as any).tradingPair || cfg.default_symbol || "BTC/USDT";
    const leverage = cfg.leverage || 1;
    const directions = getDirectionList(cfg);
    const dual = isDual(cfg);

    // Connect exchange
    if (bot.mode === "live") {
      await (connector as ExchangeConnector).connect({
        apiKey: decrypt(bot.connection.apiKeyEncrypted),
        secret: decrypt(bot.connection.apiSecretEncrypted),
        passphrase: bot.connection.passphraseEncrypted
          ? decrypt(bot.connection.passphraseEncrypted)
          : undefined,
        testnet: bot.connection.isTestnet,
        leverage,
        symbol,
      });
    } else {
      await (connector as ExchangeConnector).connect({
        apiKey: "",
        secret: "",
        leverage,
        symbol,
      });
    }

    const orderType = cfg.order_type === "limit" ? "limit" : "market";

    // Attempt to resume from persisted state
    let botState: BotState;
    const persisted = bot.stateJson as any;
    if (persisted && (persisted.mode === "dual" || persisted.baseOrderFilled)) {
      botState = hydrateState(persisted);
      botStates.set(botId, botState);
    } else {
      // Prevent duplicate base order on worker restart by checking existing orders
      if (dual) {
        botState = { mode: "dual", long: createEmptyState("long"), short: createEmptyState("short") };
        botStates.set(botId, botState);
        await prisma.bot.update({
          where: { id: botId },
          data: {
            safetyOrdersPlaced: 0,
            stateJson: buildStateJson(botState) as any,
          },
        });
        logState({
          botId,
          message: `DCA dual-mode bot initialized`,
          metadata: { direction: "both" },
        });
      } else {
        const direction = directions[0];
        const existingOrders =
          bot.mode === "live"
            ? await prisma.botOrder.findMany({
                where: { botId, side: getEntrySide(direction) },
                orderBy: { createdAt: "asc" },
              })
            : await prisma.paperTrade.findMany({
                where: { botId, side: getEntrySide(direction) },
                orderBy: { createdAt: "asc" },
              });

        if (existingOrders.length > 0) {
          let totalAmount = new Decimal(0);
          let totalCost = new Decimal(0);
          let totalFees = new Decimal(0);
          for (const order of existingOrders) {
            const o = order as any;
            totalAmount = totalAmount.plus(o.filled || o.amount || 0);
            totalCost = totalCost.plus(o.cost || o.totalCost || 0);
            totalFees = totalFees.plus(o.fee || o.simulatedFee || estimateFee(o.cost || 0));
          }
          const state: DirectionalState = {
            direction,
            baseOrderFilled: true,
            safetyOrdersFilled: Math.max(0, existingOrders.length - 1),
            totalAmount,
            totalCost,
            vwap: calculateVwap(totalAmount, totalCost),
            totalFees,
            highestPrice: 0,
            lowestPrice: 0,
            lastSafetyTick: 0,
            tickCount: 0,
            pendingOrders: [],
            priceHistory: [],
            extremePrice: 0,
            sessionRealizedPnl: 0,
            peakEquity: 0,
            chopCount: 0,
            divisionTiersHit: [],
            breakevenTriggered: false,
            waterfallPausedTicks: 0,
            activeTrailingTier: -1,
            lastPrice: 0,
            guardPriceHistory: [],
            guardPausedUntil: 0,
            emaFastHistory: [],
            emaSlowHistory: [],
            rsiValue: null,
            lastMacdSignalTime: 0,
            lastRsiSignalTime: 0,
            lastEmaSignalTime: 0,
          };
          botState = { mode: "single", state };
          botStates.set(botId, botState);
          await prisma.bot.update({
            where: { id: botId },
            data: {
              safetyOrdersPlaced: state.safetyOrdersFilled,
              stateJson: buildStateJson(botState) as any,
            },
          });
        } else {
          const hasEntrySignals = cfg.macd_signal_enabled || cfg.rsi_signal_enabled || cfg.ema_entry_enabled || (cfg.indicator_type && cfg.indicator_type !== "none");
          if (hasEntrySignals) {
            const state = createEmptyState(direction);
            botState = { mode: "single", state };
            botStates.set(botId, botState);
            await prisma.bot.update({
              where: { id: botId },
              data: {
                safetyOrdersPlaced: 0,
                stateJson: buildStateJson(botState) as any,
              },
            });
            const activeSignals = [
              cfg.macd_signal_enabled && "MACD",
              cfg.rsi_signal_enabled && "RSI",
              cfg.ema_entry_enabled && "EMA",
              cfg.indicator_type && cfg.indicator_type !== "none" && cfg.indicator_type,
            ].filter(Boolean).join(" + ");
            logState({
              botId,
              message: `DCA bot waiting for ${activeSignals} signal before first order`,
              metadata: {
                indicator_timeframe: cfg.indicator_timeframe,
                direction,
              },
            });
          } else {
            await placeBaseOrder({
              botId,
              symbol,
              orderType,
              leverage,
              connector,
              cfg,
              direction,
              lastPrice: 0, // will fetch ticker inside
            });
            botState = botStates.get(botId)!;
          }
        }
      }
    }

    // Initialize risk manager (hydrate if stateJson has persisted risk state)
    const persistedRiskState = (bot.stateJson as any)?.riskManager;
    const riskManager = RiskManager.hydrate(botId, cfg, persistedRiskState);
    botRiskManagers.set(botId, riskManager);

    // Warn if multiple bots are running on the same symbol
    const correlation = await checkGlobalCorrelation(botId, symbol, prisma);
    if (correlation.overlapCount > 0) {
      logAlert({ botId, message: `[RISK] Correlation warning: ${correlation.warning}` });
    }

    // Persist state to DB every 30s
    const persistInterval = setInterval(async () => {
      const s = botStates.get(botId);
      if (!s) return;
      const rm = botRiskManagers.get(botId);
      await prisma.bot.update({
        where: { id: botId },
        data: {
          stateJson: {
            ...buildStateJson(s),
            riskManager: rm?.serialize(),
          } as any,
        },
      });
      const dirStates = s.mode === "dual" ? [s.long, s.short] : [s.state];
      for (const ds of dirStates) {
        if (!ds.baseOrderFilled) continue;
        await prisma.botLog.create({
          data: {
            botId,
            level: "info",
            message: `DCA [${ds.direction}]: SO=${ds.safetyOrdersFilled} VWAP=${ds.vwap.toFixed(4)} Fees=$${ds.totalFees.toFixed(4)} PnL=$${ds.sessionRealizedPnl.toFixed(4)}`,
            metadataJson: {
              totalAmount: ds.totalAmount.toString(),
              totalCost: ds.totalCost.toString(),
              vwap: ds.vwap.toString(),
              totalFees: ds.totalFees.toString(),
              sessionRealizedPnl: ds.sessionRealizedPnl,
              peakEquity: ds.peakEquity,
              chopCount: ds.chopCount,
              direction: ds.direction,
            },
          },
        });
      }
    }, 30000);
    botPersistIntervals.set(botId, persistInterval);

    // Price watch loop
    botErrorCounts.set(botId, 0);
    const interval = setInterval(async () => {
      try {
        if (!botStates.has(botId)) {
          clearInterval(interval);
          clearInterval(persistInterval);
          botErrorCounts.delete(botId);
          return;
        }
        botErrorCounts.set(botId, 0);

        const botState = botStates.get(botId)!;
        const directions = getDirectionList(cfg);
        let anyStopped = false;

        const ticker = await connector.getTicker(symbol);
        const lastPrice = ticker.last;

        for (const direction of directions) {
          const currentState = getDirectionalState(botState, direction);
          if (!currentState) continue;
          currentState.tickCount++;
          currentState.lastPrice = lastPrice;

          // --- Risk: guard + volatility expansion ---
          const riskManager = botRiskManagers.get(botId);
          if (!riskManager) {
            logState({ botId, message: "Risk manager not initialized — skipping tick" });
            continue;
          }
          const guardRisk = riskManager.checkGuard(lastPrice, currentState);
          if (guardRisk.action === "pause") {
            logState({ botId, message: guardRisk.reason, metadata: guardRisk.metadata });
            continue;
          }
          const volRisk = riskManager.checkVolatilityExpansion(currentState);
          if (volRisk.action === "pause") {
            logState({ botId, message: volRisk.reason, metadata: volRisk.metadata });
            continue;
          }

          // Compute trend for this tick
          const trend = computeTrend(currentState, cfg, lastPrice);

          // Update price history for waterfall detection (12-tick rolling window)
          currentState.priceHistory.push(lastPrice);
          if (currentState.priceHistory.length > 12) {
            currentState.priceHistory.shift();
          }

          // Update price range
          if (!currentState.baseOrderFilled) {
          // nothing to track yet
        } else {
          if (currentState.highestPrice === 0) currentState.highestPrice = lastPrice;
          if (currentState.lowestPrice === 0) currentState.lowestPrice = lastPrice;
          if (lastPrice > currentState.highestPrice) currentState.highestPrice = lastPrice;
          if (lastPrice < currentState.lowestPrice) currentState.lowestPrice = lastPrice;

          // Update extreme price for trailing TP
          if (direction === "long") {
            if (currentState.extremePrice === 0 || lastPrice > currentState.extremePrice) {
              currentState.extremePrice = lastPrice;
            }
          } else {
            if (currentState.extremePrice === 0 || lastPrice < currentState.extremePrice) {
              currentState.extremePrice = lastPrice;
            }
          }
        }

        // --- Base order (indicator-driven or immediate) ---
        if (!currentState.baseOrderFilled) {
          const hasEntrySignals = cfg.macd_signal_enabled || cfg.rsi_signal_enabled || cfg.ema_entry_enabled || (cfg.indicator_type && cfg.indicator_type !== "none");
          let shouldEnter = !hasEntrySignals; // wait for signals if any are enabled
          let entryReason = hasEntrySignals ? "waiting for signals" : "immediate";

          // MACD entry signal (golden cross on histogram)
          if (cfg.macd_signal_enabled) {
            try {
              const candles = await connector.fetchOHLCV(symbol, cfg.indicator_timeframe || "1h", 100);
              const closes = candles.map((c: any) => c.close);
              const result = checkIndicatorSignal("macd", closes, {});
              const candleTime = (candles[candles.length - 1] as any)?.timestamp || (candles[candles.length - 1] as any)?.[0] || 0;
              if (result.signal && candleTime !== currentState.lastMacdSignalTime) {
                currentState.lastMacdSignalTime = candleTime;
                logState({ botId, message: `MACD signal passed: ${result.reason}`, metadata: { price: lastPrice } });
              } else if (!result.signal) {
                shouldEnter = false;
                entryReason = result.reason;
              } else {
                shouldEnter = false;
                entryReason = "MACD signal already acted on this candle";
              }
            } catch (_e) {
              shouldEnter = false;
              entryReason = "MACD check failed";
            }
          }

          // RSI signal gating
          if (shouldEnter && cfg.rsi_signal_enabled) {
            try {
              const candles = await connector.fetchOHLCV(symbol, cfg.indicator_timeframe || "1h", 100);
              const closes = candles.map((c: any) => c.close);
              const rsi = calculateRSI(closes, 14);
              currentState.rsiValue = rsi;
              const candleTime = (candles[candles.length - 1] as any)?.timestamp || (candles[candles.length - 1] as any)?.[0] || 0;
              const blocked = (direction === "long" && rsi > (cfg.rsi_upper || 70)) || (direction === "short" && rsi < (cfg.rsi_lower || 30));
              if (blocked) {
                shouldEnter = false;
                entryReason = `RSI ${rsi.toFixed(1)} unfavorable for ${direction}`;
              } else if (candleTime === currentState.lastRsiSignalTime) {
                shouldEnter = false;
                entryReason = "RSI signal already acted on this candle";
              } else {
                currentState.lastRsiSignalTime = candleTime;
                logState({ botId, message: `RSI signal passed: ${rsi.toFixed(1)} for ${direction}`, metadata: { price: lastPrice } });
              }
            } catch (_e) {
              shouldEnter = false;
              entryReason = "RSI check failed";
            }
          }

          // EMA entry signal (golden cross)
          if (shouldEnter && cfg.ema_entry_enabled) {
            try {
              const candles = await connector.fetchOHLCV(symbol, cfg.indicator_timeframe || "1h", 100);
              const closes = candles.map((c: any) => c.close);
              const result = checkIndicatorSignal("ema_cross", closes, {
                emaShort: cfg.ema_fast || 9,
                emaLong: cfg.ema_slow || 26,
              });
              const candleTime = (candles[candles.length - 1] as any)?.timestamp || (candles[candles.length - 1] as any)?.[0] || 0;
              if (result.signal && candleTime !== currentState.lastEmaSignalTime) {
                currentState.lastEmaSignalTime = candleTime;
                logState({ botId, message: `EMA signal passed: ${result.reason}`, metadata: { price: lastPrice } });
              } else if (!result.signal) {
                shouldEnter = false;
                entryReason = result.reason;
              } else {
                shouldEnter = false;
                entryReason = "EMA signal already acted on this candle";
              }
            } catch (_e) {
              shouldEnter = false;
              entryReason = "EMA check failed";
            }
          }

          // Legacy indicator check (manual indicator_type)
          if (shouldEnter && cfg.indicator_type && cfg.indicator_type !== "none") {
            try {
              const candles = await connector.fetchOHLCV(symbol, cfg.indicator_timeframe || "1h", 100);
              const closes = candles.map((c: any) => c.close);
              const result = checkIndicatorSignal(cfg.indicator_type, closes, {
                rsiPeriod: cfg.rsi_period,
                rsiThreshold: cfg.rsi_threshold,
                emaShort: cfg.ema_short,
                emaLong: cfg.ema_long,
              });
              if (!result.signal) {
                shouldEnter = false;
                entryReason = result.reason;
              }
            } catch (_e) {
              shouldEnter = false;
              entryReason = "Indicator check failed";
            }
          }

          // Trend-following mode: only enter with trend (additional filter after signals)
          if (shouldEnter && cfg.trend_following_mode) {
            if (trend === "neutral") {
              shouldEnter = false;
              entryReason = "accumulating EMA data for trend detection";
              logState({
                botId,
                message: `Trend-following: skipping ${direction} entry (accumulating EMA data)`,
                metadata: { emaFastLength: currentState.emaFastHistory.length, emaSlowLength: currentState.emaSlowHistory.length, price: lastPrice },
              });
            } else {
              const trendDirection = trend === "uptrend" ? "long" : "short";
              if (direction !== trendDirection) {
                shouldEnter = false;
                entryReason = `trend is ${trend}`;
                logState({
                  botId,
                  message: `Trend-following: skipping ${direction} entry (trend is ${trend})`,
                  metadata: { trend, direction, price: lastPrice },
                });
              }
            }
          }

          // Reverse-trend entry: enter against trend (additional filter after signals)
          if (shouldEnter && cfg.reverse_trend_entry_enabled) {
            if (trend === "neutral") {
              shouldEnter = false;
              entryReason = "accumulating EMA data for trend detection";
              logState({
                botId,
                message: `Reverse-trend: skipping ${direction} entry (accumulating EMA data)`,
                metadata: { emaFastLength: currentState.emaFastHistory.length, emaSlowLength: currentState.emaSlowHistory.length, price: lastPrice },
              });
            } else {
              const trendDirection = trend === "uptrend" ? "long" : "short";
              if (direction === trendDirection) {
                shouldEnter = false;
                entryReason = `trend is ${trend}`;
                logState({
                  botId,
                  message: `Reverse-trend: skipping ${direction} entry (trend is ${trend})`,
                  metadata: { trend, direction, price: lastPrice },
                });
              }
            }
          }

          if (!shouldEnter) {
            logState({
              botId,
              message: `Base order skipped: ${entryReason}`,
              metadata: { reason: entryReason, price: lastPrice, trend, direction },
            });
            continue;
          }

          await placeBaseOrder({ botId, symbol, orderType, leverage, connector, cfg, direction, lastPrice });
        }

        // Must have base order to proceed
        if (!currentState.baseOrderFilled) continue;

        // --- Reconcile pending orders ---
        await reconcilePendingOrders({ botId, symbol, connector, state: currentState });

        // --- Position sync ---
        if (currentState.tickCount % POSITION_SYNC_INTERVAL === 0 && connector.fetchPositions) {
          await syncPosition({ botId, symbol, connector, state: currentState });

          // Risk: liquidation proximity + account concentration (run every sync)
          const liqRisk = await riskManager.checkLiquidationProximity(symbol, connector, currentState);
          if (liqRisk.action === "stop") {
            logAlert({ botId, message: liqRisk.reason, metadata: liqRisk.metadata });
            await emergencyExit(botId);
            return;
          }
          const acctRisk = await riskManager.checkAccountRisk(symbol, connector, currentState);
          if (acctRisk.action !== "allow") {
            logAlert({ botId, message: acctRisk.reason, metadata: acctRisk.metadata });
          }
        }

        // --- Funding rate check ---
        if (cfg.funding_rate_threshold && connector.fetchFundingRate && currentState.tickCount % FUNDING_RATE_INTERVAL === 0) {
          try {
            const fr = await connector.fetchFundingRate(symbol);
            if (Math.abs(fr.fundingRate) > cfg.funding_rate_threshold) {
              logAlert({
                botId,
                message: `High funding rate detected: ${(fr.fundingRate * 100).toFixed(4)}%`,
                metadata: { fundingRate: fr.fundingRate, nextFundingTime: fr.nextFundingTime },
              });
            }
          } catch (_e) {
            // ignore funding rate errors
          }
        }

        // --- Risk: session loss / drawdown / daily loss / holding time / consecutive losses ---
        const sessionPnl = getTotalSessionPnl(botState);
        const preTradeRisk = riskManager.evaluateDirection(lastPrice, currentState, sessionPnl);
        if (preTradeRisk.action === "stop") {
          logAlert({ botId, message: preTradeRisk.reason, metadata: preTradeRisk.metadata });
          await emergencyExit(botId);
          return;
        }
        // pause = waterfall/guard already handled above; skip safety orders but allow TP/SL
        const isPaused = preTradeRisk.action === "pause";

        // --- Risk: waterfall (managed by risk manager, decrements ticks internally) ---
        const waterfallRisk = riskManager.checkWaterfall(currentState);
        if (waterfallRisk.action === "pause" && currentState.waterfallPausedTicks > 0) {
          currentState.waterfallPausedTicks--;
        }

        // --- Safety orders ---
        const roundIndex = currentState.safetyOrdersFilled;
        const rounds = cfg.rounds && cfg.rounds.length > 0 ? cfg.rounds : undefined;
        let nextDeviation = getNextDeviationTrigger(
          cfg.price_deviation_initial,
          cfg.safety_order_step_scale,
          currentState.safetyOrdersFilled,
          rounds,
          roundIndex
        );

        // Trend DCA: adjust deviation based on trend
        if (cfg.trend_dca_enabled && trend !== "neutral") {
          const adjustment = trend === "uptrend" ? 0.8 : 1.2;
          nextDeviation = nextDeviation * adjustment;
        }

        const canPlaceSafety =
          !isPaused &&
          currentState.tickCount - currentState.lastSafetyTick >= SAFETY_COOLDOWN_TICKS &&
          currentState.safetyOrdersFilled < cfg.safety_order_max_count &&
          shouldTriggerSafetyOrder(lastPrice, currentState.vwap, nextDeviation, direction);

        if (canPlaceSafety) {
          // Optional: cover indicator confirmation
          if (cfg.cover_indicator_type && cfg.cover_indicator_type !== "none") {
            try {
              const candles = await connector.fetchOHLCV(
                symbol,
                cfg.indicator_timeframe || "1h",
                100
              );
              const closes = candles.map((c: any) => c.close);
              const result = checkIndicatorSignal(cfg.cover_indicator_type, closes, {
                rsiPeriod: cfg.rsi_period,
                rsiThreshold: cfg.rsi_threshold,
                emaShort: cfg.ema_short,
                emaLong: cfg.ema_long,
              });
              if (!result.signal) {
                logState({
                  botId,
                  message: `Safety order skipped: cover indicator not confirmed (${result.reason})`,
                  metadata: { deviation: nextDeviation, price: lastPrice, vwap: currentState.vwap.toString() },
                });
                continue;
              }
            } catch (_e) {
              // If indicator check fails, allow safety order anyway
            }
          }

          await placeSafetyOrder({
            botId,
            symbol,
            orderType,
            leverage,
            connector,
            cfg,
            state: currentState,
            lastPrice,
            nextDeviation,
            roundIndex,
            rounds,
          });
        }

        // --- Division / partial profit taking ---
        if (cfg.division_setting && cfg.division_setting.length > 0) {
          for (let i = 0; i < cfg.division_setting.length; i++) {
            if (currentState.divisionTiersHit.includes(i)) continue;
            const tier = cfg.division_setting[i];
            if (shouldTriggerFixedTakeProfit(lastPrice, currentState.vwap, tier.profit_pct, direction)) {
              const sellPct = Math.min(tier.sell_pct, 100);
              const sellAmount = currentState.totalAmount.toNumber() * (sellPct / 100);
              if (sellAmount <= 0) continue;

              const sellOrder = await connector.placeOrder({
                symbol,
                side: getExitSide(direction),
                type: orderType,
                amount: sellAmount,
                reduceOnly: true,
              });

              const sellProceeds = sellOrder.cost || sellAmount * lastPrice;
              const sellFee = estimateFee(sellProceeds);
              const pnl = calculateRealizedPnl(
                lastPrice,
                sellAmount,
                currentState.vwap,
                currentState.totalFees.plus(sellFee),
                direction
              );

              currentState.divisionTiersHit.push(i);
              currentState.sessionRealizedPnl += pnl;
              riskManager?.onTradeClosed(pnl);

              // Recalculate VWAP on remaining position
              const remainingAmount = currentState.totalAmount.minus(sellAmount);
              const remainingCost = currentState.totalCost.minus(currentState.vwap.mul(sellAmount));
              currentState.totalAmount = remainingAmount;
              currentState.totalCost = remainingCost;
              currentState.vwap = calculateVwap(remainingAmount, remainingCost);
              currentState.totalFees = currentState.totalFees.plus(sellFee);

              logTrade({
                botId,
                message: `Division exit tier ${i + 1} (${sellPct}% @ ${tier.profit_pct}% profit). Realized PnL: $${pnl.toFixed(4)}`,
                metadata: {
                  tier: i + 1,
                  profitPct: tier.profit_pct,
                  sellPct,
                  exitPrice: lastPrice,
                  vwap: currentState.vwap.toString(),
                  pnl,
                  remainingAmount: remainingAmount.toString(),
                },
              });

              if (currentState.totalAmount.lessThanOrEqualTo(0)) {
                logAlert({ botId, message: `[${direction}] Position fully exited via division tiers.` });
                currentState.baseOrderFilled = false;
                anyStopped = true;
              }
            }
          }
        }

        // --- Trailing take-profit ---
        if (cfg.take_profit_mode === "trailing" && cfg.trailing_tiers && cfg.trailing_tiers.length > 0) {
          // Determine which tier is active
          let newTier = -1;
          for (let i = 0; i < cfg.trailing_tiers.length; i++) {
            if (shouldTriggerFixedTakeProfit(lastPrice, currentState.vwap, cfg.trailing_tiers[i].profit_pct, direction)) {
              newTier = i;
            }
          }

          if (newTier > currentState.activeTrailingTier) {
            currentState.activeTrailingTier = newTier;
            logState({
              botId,
              message: `Trailing TP tier ${newTier + 1} activated: ${cfg.trailing_tiers[newTier].profit_pct}% profit, callback ${cfg.trailing_tiers[newTier].callback_pct}%`,
              metadata: {
                tier: newTier + 1,
                profitPct: cfg.trailing_tiers[newTier].profit_pct,
                callbackPct: cfg.trailing_tiers[newTier].callback_pct,
                extremePrice: currentState.extremePrice,
              },
            });
          }

          if (currentState.activeTrailingTier >= 0) {
            const tier = cfg.trailing_tiers[currentState.activeTrailingTier];
            const callbackPct = tier.callback_pct;
            let callbackTriggered = false;

            if (direction === "long") {
              const peak = currentState.extremePrice;
              const callbackPrice = peak * (1 - callbackPct / 100);
              if (lastPrice <= callbackPrice) {
                callbackTriggered = true;
              }
            } else {
              const trough = currentState.extremePrice;
              const callbackPrice = trough * (1 + callbackPct / 100);
              if (lastPrice >= callbackPrice) {
                callbackTriggered = true;
              }
            }

            if (callbackTriggered) {
              const sellAmount = currentState.totalAmount.toNumber();
              const sellOrder = await connector.placeOrder({
                symbol,
                side: getExitSide(direction),
                type: orderType,
                amount: sellAmount,
                reduceOnly: true,
              });
              const sellProceeds = sellOrder.cost || sellAmount * lastPrice;
              const sellFee = estimateFee(sellProceeds);
              const pnl = calculateRealizedPnl(
                lastPrice,
                sellAmount,
                currentState.vwap,
                currentState.totalFees.plus(sellFee),
                direction
              );
              currentState.sessionRealizedPnl += pnl;
              riskManager?.onTradeClosed(pnl);

              logTrade({
                botId,
                message: `Trailing TP callback triggered (tier ${currentState.activeTrailingTier + 1}). Exit at ${lastPrice}. Realized PnL: $${pnl.toFixed(4)}`,
                metadata: {
                  tier: currentState.activeTrailingTier + 1,
                  exitPrice: lastPrice,
                  vwap: currentState.vwap.toString(),
                  pnl,
                  extremePrice: currentState.extremePrice,
                },
              });

              currentState.baseOrderFilled = false;
                anyStopped = true;
              }
            }
          }

        // --- Fixed take-profit (fallback when trailing is not active) ---
        if (cfg.take_profit_mode !== "trailing" || currentState.activeTrailingTier < 0) {
          if (shouldTriggerFixedTakeProfit(lastPrice, currentState.vwap, cfg.take_profit, direction)) {
            const sellAmount = currentState.totalAmount.toNumber();
            const sellOrder = await connector.placeOrder({
              symbol,
              side: getExitSide(direction),
              type: orderType,
              amount: sellAmount,
              reduceOnly: true,
            });
            const sellProceeds = sellOrder.cost || sellAmount * lastPrice;
            const sellFee = estimateFee(sellProceeds);
            const pnl = calculateRealizedPnl(
              lastPrice,
              sellAmount,
              currentState.vwap,
              currentState.totalFees.plus(sellFee),
              direction
            );
            currentState.sessionRealizedPnl += pnl;
            riskManager?.onTradeClosed(pnl);

            logTrade({
              botId,
              message: `Take profit triggered at ${lastPrice}. Realized PnL: $${pnl.toFixed(4)}`,
              metadata: {
                exitPrice: lastPrice,
                vwap: currentState.vwap.toString(),
                totalAmount: currentState.totalAmount.toString(),
                sellProceeds,
                pnl,
                fees: currentState.totalFees.plus(sellFee).toString(),
              },
            });

            currentState.baseOrderFilled = false;
            anyStopped = true;
          }
        }

        // --- Risk: breakeven arm + stop-loss (fixed + breakeven triggered) ---
        const beArm = riskManager.checkBreakevenStopLoss(lastPrice, currentState);
        if (beArm.reason) {
          logState({ botId, message: beArm.reason, metadata: beArm.metadata });
        }

        const slRisk = riskManager.checkStopLoss(lastPrice, currentState);
        const beSlRisk = riskManager.checkBreakevenTriggered(lastPrice, currentState);
        const exitRisk = slRisk.action === "stop" ? slRisk : beSlRisk;

        if (exitRisk.action === "stop") {
          const sellAmount = currentState.totalAmount.toNumber();
          const sellOrder = await connector.placeOrder({
            symbol,
            side: getExitSide(direction),
            type: "market",
            amount: sellAmount,
            reduceOnly: true,
          });
          const sellProceeds = sellOrder.cost || sellAmount * lastPrice;
          const sellFee = estimateFee(sellProceeds);
          const pnl = calculateRealizedPnl(
            lastPrice,
            sellAmount,
            currentState.vwap,
            currentState.totalFees.plus(sellFee),
            direction
          );
          currentState.sessionRealizedPnl += pnl;
          riskManager.onTradeClosed(pnl);

          logAlert({
            botId,
            message: `${exitRisk.reason} at ${lastPrice}. Realized PnL: $${pnl.toFixed(4)}`,
            metadata: {
              exitPrice: lastPrice,
              vwap: currentState.vwap.toString(),
              pnl,
              fees: currentState.totalFees.plus(sellFee).toString(),
              ...exitRisk.metadata,
            },
          });

          currentState.baseOrderFilled = false;
          anyStopped = true;
        }

        // --- Risk: chop-loss (partial stop-loss) ---
        const chopRisk = riskManager.checkChopLoss(lastPrice, currentState);
        if (chopRisk.action === "reduce") {
          const sellAmount = currentState.totalAmount.toNumber() * (cfg.chop_sell_pct / 100);
          if (sellAmount > 0) {
            const sellOrder = await connector.placeOrder({
              symbol,
              side: getExitSide(direction),
              type: "market",
              amount: sellAmount,
              reduceOnly: true,
            });
            const sellProceeds = sellOrder.cost || sellAmount * lastPrice;
            const sellFee = estimateFee(sellProceeds);
            const pnl = calculateRealizedPnl(
              lastPrice,
              sellAmount,
              currentState.vwap,
              currentState.totalFees.plus(sellFee),
              direction
            );
            currentState.chopCount++;
            currentState.sessionRealizedPnl += pnl;
            riskManager.onTradeClosed(pnl);

            const remainingAmount = currentState.totalAmount.minus(sellAmount);
            const remainingCost = currentState.totalCost.minus(currentState.vwap.mul(sellAmount));
            currentState.totalAmount = remainingAmount;
            currentState.totalCost = remainingCost;
            currentState.vwap = calculateVwap(remainingAmount, remainingCost);
            currentState.totalFees = currentState.totalFees.plus(sellFee);

            logAlert({
              botId,
              message: `Chop-loss #${currentState.chopCount} executed (${cfg.chop_sell_pct}% @ ${cfg.chop_loss_pct}% loss). Realized PnL: $${pnl.toFixed(4)}`,
              metadata: {
                chopCount: currentState.chopCount,
                exitPrice: lastPrice,
                pnl,
                remainingAmount: remainingAmount.toString(),
              },
            });

            if (currentState.totalAmount.lessThanOrEqualTo(0)) {
              logAlert({ botId, message: `[${direction}] Position fully chopped.` });
              currentState.baseOrderFilled = false;
              anyStopped = true;
            }
          }
        }

        const maxChop = riskManager.checkMaxChopCount(currentState);
        if (maxChop.action === "stop") {
          logAlert({ botId, message: maxChop.reason, metadata: maxChop.metadata });
          await stopDcaLoop(botId);
          return;
        }

        // --- Risk: max safety orders reached ---
        const maxSoRisk = riskManager.checkMaxSafetyOrders(currentState);
        if (maxSoRisk.action === "stop") {
          logAlert({ botId, message: maxSoRisk.reason, metadata: maxSoRisk.metadata });
          currentState.baseOrderFilled = false;
          anyStopped = true;
        }
      } // end for direction loop

        // --- Risk: two-way loss (dual-mode emergency exit) ---
        const twoWay = riskManager.checkTwoWayLoss(
          lastPrice,
          botState.mode === "dual" ? botState.long : undefined,
          botState.mode === "dual" ? botState.short : undefined
        );
        if (twoWay.action === "stop") {
          logAlert({ botId, message: twoWay.reason, metadata: twoWay.metadata });
          // Exit long
          if (botState.mode === "dual" && botState.long.totalAmount.greaterThan(0)) {
            const longOrder = await connector.placeOrder({
              symbol,
              side: getExitSide("long"),
              type: orderType,
              amount: botState.long.totalAmount.toNumber(),
              reduceOnly: true,
            });
            const longProceeds = longOrder.cost || botState.long.totalAmount.toNumber() * lastPrice;
            const longFee = estimateFee(longProceeds);
            const longPnl = calculateRealizedPnl(
              lastPrice,
              botState.long.totalAmount.toNumber(),
              botState.long.vwap,
              botState.long.totalFees.plus(longFee),
              "long"
            );
            botState.long.sessionRealizedPnl += longPnl;
            riskManager.onTradeClosed(longPnl);
            logTrade({
              botId,
              message: `Two-way loss exit LONG. Realized PnL: $${longPnl.toFixed(4)}`,
              metadata: { price: lastPrice, pnl: longPnl, direction: "long" },
            });
          }
          // Exit short
          if (botState.mode === "dual" && botState.short.totalAmount.greaterThan(0)) {
            const shortOrder = await connector.placeOrder({
              symbol,
              side: getExitSide("short"),
              type: orderType,
              amount: botState.short.totalAmount.toNumber(),
              reduceOnly: true,
            });
            const shortProceeds = shortOrder.cost || botState.short.totalAmount.toNumber() * lastPrice;
            const shortFee = estimateFee(shortProceeds);
            const shortPnl = calculateRealizedPnl(
              lastPrice,
              botState.short.totalAmount.toNumber(),
              botState.short.vwap,
              botState.short.totalFees.plus(shortFee),
              "short"
            );
            botState.short.sessionRealizedPnl += shortPnl;
            riskManager.onTradeClosed(shortPnl);
            logTrade({
              botId,
              message: `Two-way loss exit SHORT. Realized PnL: $${shortPnl.toFixed(4)}`,
              metadata: { price: lastPrice, pnl: shortPnl, direction: "short" },
            });
          }
          if (botState.mode === "dual") {
            botState.long.baseOrderFilled = false;
            botState.short.baseOrderFilled = false;
          }
          anyStopped = true;
        }

        if (anyStopped) {
          const bs = botStates.get(botId)!;
          const allDone =
            bs.mode === "dual"
              ? !bs.long.baseOrderFilled && !bs.short.baseOrderFilled
              : !bs.state.baseOrderFilled;
          if (allDone) {
            await prisma.bot.update({
              where: { id: botId },
              data: { status: "stopped", stateJson: null as any, safetyOrdersPlaced: 0 },
            });
            botStates.delete(botId);
            await unregisterBot(botId);
            clearInterval(interval);
            clearInterval(persistInterval);
            return;
          }
        }

      } catch (err: any) {
        if (err.message && err.message.includes("Insufficient balance")) {
          logAlert({
            botId,
            message: `DCA bot stopped: ${err.message}`,
          });
          await stopDcaLoop(botId);
          return;
        }

        console.error(`[DCA:${botId}] Loop error:`, err);
        const errCount = (botErrorCounts.get(botId) || 0) + 1;
        botErrorCounts.set(botId, errCount);

        logAlert({
          botId,
          message: `DCA loop error (${errCount}/${MAX_CONSECUTIVE_ERRORS}): ${err.message}`,
          metadata: { errorCount: errCount, maxErrors: MAX_CONSECUTIVE_ERRORS },
        });

        if (errCount >= MAX_CONSECUTIVE_ERRORS) {
          logAlert({
            botId,
            message: `DCA bot auto-stopped after ${MAX_CONSECUTIVE_ERRORS} consecutive errors`,
          });
          await stopDcaLoop(botId);
          return;
        }
      }
    }, 5000);

    botIntervals.set(botId, interval);
  } catch (err: any) {
    console.error(`[DCA:${botId}] Fatal error starting loop:`, err);
    logAlert({ botId, message: `DCA loop failed: ${err.message}` });
    await prisma.bot.update({ where: { id: botId }, data: { status: "error" } });
    await unregisterBot(botId);
  }
}

// ============================================================
// Base order placement
// ============================================================

async function placeBaseOrder(opts: {
  botId: string;
  symbol: string;
  orderType: "market" | "limit";
  leverage: number;
  connector: ExchangeConnector;
  cfg: any;
  direction: "long" | "short";
  lastPrice: number;
  reason?: string;
}) {
  const { botId, symbol, orderType, leverage, connector, cfg, direction, lastPrice, reason } = opts;

  let price: number | undefined;
  let execPrice = lastPrice;

  // Always need a valid price to compute order size; fetch ticker if missing
  if (execPrice <= 0) {
    const ticker = await connector.getTicker(symbol);
    execPrice = ticker.last;
  }

  if (orderType === "limit") {
    // Place limit order slightly better than market
    if (direction === "long") {
      price = execPrice * (1 - (cfg.price_deviation_initial || 0.5) / 100);
    } else {
      price = execPrice * (1 + (cfg.price_deviation_initial || 0.5) / 100);
    }
  }

  let baseOrderSize = cfg.base_order_size;

  // Double first order
  if (cfg.double_fo_enabled) {
    baseOrderSize = baseOrderSize * 2;
  }

  // Long-short ratio in dual mode
  if (cfg.direction === "both" && cfg.long_short_ratio && cfg.long_short_ratio !== 50) {
    const ratio = direction === "long" ? (cfg.long_short_ratio / 100) : (1 - cfg.long_short_ratio / 100);
    baseOrderSize = baseOrderSize * ratio;
  }

  const baseAmount = usdtToAmount(baseOrderSize, execPrice);

  const riskManager = botRiskManagers.get(botId);
  const sizeRisk = riskManager?.evaluateOrderSize(baseAmount);
  if (sizeRisk && sizeRisk.action !== "allow") {
    logAlert({ botId, message: sizeRisk.reason, metadata: sizeRisk.metadata });
    return;
  }

  const baseOrder = await connector.placeOrder({
    symbol,
    side: getEntrySide(direction),
    type: orderType,
    amount: baseAmount,
    price,
    positionSide: direction.toUpperCase() as "LONG" | "SHORT",
  });

  const orderCost = baseOrder.cost || cfg.base_order_size;
  const orderFee = estimateFee(orderCost);
  const totalAmount = new Decimal(baseOrder.filled || baseAmount);
  const totalCost = new Decimal(orderCost + orderFee);

  const state: DirectionalState = {
    direction,
    baseOrderFilled: true,
    safetyOrdersFilled: 0,
    totalAmount,
    totalCost,
    vwap: calculateVwap(totalAmount, totalCost),
    totalFees: new Decimal(orderFee),
    highestPrice: execPrice,
    lowestPrice: execPrice,
    lastSafetyTick: 0,
    tickCount: 0,
    pendingOrders: [],
    priceHistory: [],
    extremePrice: execPrice,
    sessionRealizedPnl: 0,
    peakEquity: totalCost.toNumber(),
    chopCount: 0,
    divisionTiersHit: [],
    breakevenTriggered: false,
    waterfallPausedTicks: 0,
    activeTrailingTier: -1,
    lastPrice: 0,
    guardPriceHistory: [],
    guardPausedUntil: 0,
    emaFastHistory: [],
    emaSlowHistory: [],
    rsiValue: null,
    lastMacdSignalTime: 0,
    lastRsiSignalTime: 0,
    lastEmaSignalTime: 0,
  };

  if (orderType === "limit" && baseOrder.status !== "closed") {
    state.pendingOrders.push({
      exchangeOrderId: baseOrder.orderId,
      side: getEntrySide(direction),
      amount: baseAmount,
      filled: baseOrder.filled || 0,
      placedAtTick: 0,
      price,
    });
  }

  const existingBotState = botStates.get(botId);
  if (existingBotState) {
    updateDirectionalState(existingBotState, opts.direction, state);
  } else {
    botStates.set(botId, { mode: "single", state });
  }

  await prisma.bot.update({
    where: { id: botId },
    data: {
      safetyOrdersPlaced: 0,
      stateJson: buildStateJson(botStates.get(botId)!) as any,
    },
  });

  logOrder({
    botId,
    message: reason
      ? `Base order placed on ${reason}: ${baseAmount.toFixed(6)} @ ${execPrice} (cost $${orderCost.toFixed(2)}, fee $${orderFee.toFixed(4)})`
      : `Base order placed: ${baseAmount.toFixed(6)} @ ${execPrice} (cost $${orderCost.toFixed(2)}, fee $${orderFee.toFixed(4)})`,
    metadata: { price: execPrice, amount: baseAmount, cost: orderCost, fee: orderFee, leverage, direction },
  });

  riskManager?.onPositionEntry();
}

// ============================================================
// Safety order placement
// ============================================================

async function placeSafetyOrder(opts: {
  botId: string;
  symbol: string;
  orderType: "market" | "limit";
  leverage: number;
  connector: ExchangeConnector;
  cfg: any;
  state: DirectionalState;
  lastPrice: number;
  nextDeviation: number;
  roundIndex: number;
  rounds?: any[];
}) {
  const { botId, symbol, orderType, leverage, connector, cfg, state, lastPrice, nextDeviation, roundIndex, rounds } = opts;

  const safetyUsdt = getNextSafetyOrderSize(
    cfg.safety_order_size,
    cfg.safety_order_volume_scale,
    state.safetyOrdersFilled,
    rounds,
    roundIndex
  );
  const safetyAmount = usdtToAmount(safetyUsdt, lastPrice);

  // Risk: enforce max position size
  const riskManager = botRiskManagers.get(botId);
  const projectedAmount = state.totalAmount.toNumber() + safetyAmount;
  const sizeRisk = riskManager?.evaluateOrderSize(projectedAmount);
  if (sizeRisk && sizeRisk.action !== "allow") {
    logAlert({ botId, message: sizeRisk.reason, metadata: sizeRisk.metadata });
    return;
  }

  let price: number | undefined;
  if (orderType === "limit") {
    if (state.direction === "long") {
      price = lastPrice * (1 - nextDeviation / 100);
    } else {
      price = lastPrice * (1 + nextDeviation / 100);
    }
  }

  const safetyOrder = await connector.placeOrder({
    symbol,
    side: getEntrySide(state.direction),
    type: orderType,
    amount: safetyAmount,
    price,
    positionSide: state.direction.toUpperCase() as "LONG" | "SHORT",
  });

  const orderCost = safetyOrder.cost || safetyUsdt;
  const orderFee = estimateFee(orderCost);

  state.safetyOrdersFilled++;
  state.lastSafetyTick = state.tickCount;
  state.totalAmount = state.totalAmount.plus(safetyOrder.filled || safetyAmount);
  state.totalCost = state.totalCost.plus(new Decimal(orderCost + orderFee));
  state.totalFees = state.totalFees.plus(new Decimal(orderFee));
  state.vwap = calculateVwap(state.totalAmount, state.totalCost);

  if (orderType === "limit" && safetyOrder.status !== "closed") {
    state.pendingOrders.push({
      exchangeOrderId: safetyOrder.orderId,
      side: getEntrySide(state.direction),
      amount: safetyAmount,
      filled: safetyOrder.filled || 0,
      placedAtTick: state.tickCount,
      price,
    });
  }

  logOrder({
    botId,
    message: `Safety order #${state.safetyOrdersFilled} placed: ${safetyAmount.toFixed(6)} @ ${lastPrice} (cost $${orderCost.toFixed(2)}, fee $${orderFee.toFixed(4)})`,
    metadata: {
      price: lastPrice,
      amount: safetyAmount,
      cost: orderCost,
      fee: orderFee,
      leverage,
      safetyOrderNumber: state.safetyOrdersFilled,
      vwap: state.vwap.toString(),
      direction: state.direction,
    },
  });

  await prisma.bot.update({
    where: { id: botId },
    data: {
      safetyOrdersPlaced: state.safetyOrdersFilled,
      stateJson: buildStateJson(botStates.get(botId)!) as any,
    },
  });
}

// ============================================================
// Pending order reconciliation
// ============================================================

async function reconcilePendingOrders(opts: {
  botId: string;
  symbol: string;
  connector: ExchangeConnector;
  state: DirectionalState;
}) {
  const { botId, symbol, connector, state } = opts;
  if (state.pendingOrders.length === 0) return;

  const stillPending: PendingOrder[] = [];

  for (const po of state.pendingOrders) {
    try {
      const order = await connector.getOrder(po.exchangeOrderId, symbol);
      if (order.status === "closed" || order.filled >= po.amount * 0.999) {
        // Order filled
        const newlyFilled = order.filled - po.filled;
        if (newlyFilled > 0) {
          const avgPrice = order.price || order.cost! / order.filled;
          const fillCost = newlyFilled * avgPrice;
          const fillFee = estimateFee(fillCost);
          state.totalAmount = state.totalAmount.plus(newlyFilled);
          state.totalCost = state.totalCost.plus(new Decimal(fillCost + fillFee));
          state.totalFees = state.totalFees.plus(new Decimal(fillFee));
          state.vwap = calculateVwap(state.totalAmount, state.totalCost);
          logOrder({
            botId,
            message: `Limit order ${po.exchangeOrderId} filled: ${newlyFilled.toFixed(6)} @ ${avgPrice.toFixed(2)}`,
            metadata: { orderId: po.exchangeOrderId, filled: newlyFilled, price: avgPrice },
          });
        }
      } else if (state.tickCount - po.placedAtTick > LIMIT_ORDER_MAX_TICKS) {
        // Cancel stale limit order
        await connector.cancelOrder(po.exchangeOrderId, symbol);
        logState({
          botId,
          message: `Stale limit order ${po.exchangeOrderId} cancelled after ${LIMIT_ORDER_MAX_TICKS} ticks`,
          metadata: { orderId: po.exchangeOrderId, placedAtTick: po.placedAtTick },
        });
      } else {
        stillPending.push(po);
      }
    } catch (_e) {
      // If getOrder fails, keep it pending
      stillPending.push(po);
    }
  }

  state.pendingOrders = stillPending;
}

// ============================================================
// Position sync with exchange
// ============================================================

async function syncPosition(opts: {
  botId: string;
  symbol: string;
  connector: ExchangeConnector;
  state: DirectionalState;
}) {
  const { botId, symbol, connector, state } = opts;
  try {
    const positions = await connector.fetchPositions!(symbol);
    const pos = positions.find((p) => p.symbol === symbol);
    if (!pos) {
      if (state.totalAmount.greaterThan(0)) {
        logAlert({
          botId,
          message: `Position sync warning: exchange reports no position but internal state shows ${state.totalAmount.toString()}`,
          metadata: { internalAmount: state.totalAmount.toString() },
        });
      }
      return;
    }

    const exchangeAmt = pos.contracts || 0;
    const internalAmt = state.totalAmount.toNumber();
    const diff = Math.abs(exchangeAmt - internalAmt);
    const diffPct = internalAmt > 0 ? (diff / internalAmt) * 100 : 0;

    if (diffPct > 1) {
      logAlert({
        botId,
        message: `Position drift detected: exchange ${exchangeAmt} vs internal ${internalAmt.toFixed(6)} (${diffPct.toFixed(2)}% diff). Reconciling.`,
        metadata: {
          exchangeAmount: exchangeAmt,
          internalAmount: internalAmt,
          exchangeEntryPrice: pos.entryPrice,
          internalVwap: state.vwap.toString(),
        },
      });
      state.totalAmount = new Decimal(exchangeAmt);
      if (pos.entryPrice > 0) {
        const newCost = state.totalAmount.mul(pos.entryPrice);
        state.totalCost = newCost.plus(state.totalFees);
        state.vwap = calculateVwap(state.totalAmount, state.totalCost);
      }
    }

    // Liquidation proximity warning (emergency exit is handled by risk manager in main loop)
    if (pos.liquidationPrice && pos.entryPrice > 0) {
      const liqDistance = Math.abs((pos.liquidationPrice - pos.entryPrice) / pos.entryPrice) * 100;
      if (liqDistance < 15) {
        logAlert({
          botId,
          message: `WARNING: Liquidation price ${pos.liquidationPrice} is only ${liqDistance.toFixed(2)}% away from entry!`,
          metadata: { liquidationPrice: pos.liquidationPrice, entryPrice: pos.entryPrice, leverage: pos.leverage },
        });
      }
    }
  } catch (_e) {
    // Ignore sync errors
  }
}

// ============================================================
// Emergency exit
// ============================================================

export async function emergencyExit(botId: string): Promise<{ success: boolean; message: string; pnl?: number }> {
  const botState = botStates.get(botId);
  if (!botState) {
    await stopDcaLoop(botId);
    return { success: true, message: "Bot stopped. No active position to exit." };
  }

  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { connection: true },
  });
  if (!bot) return { success: false, message: "Bot not found" };

  const cfg = bot.configJson as any;
  const connector = getConnector(bot.connection.exchangeId, bot.mode, botId);
  const symbol = (bot as any).tradingPair || cfg.default_symbol || "BTC/USDT";

  let totalPnl = 0;
  const dirs = botState.mode === "dual" ? (["long", "short"] as const) : ([botState.state.direction] as const);

  for (const dir of dirs) {
    const state = getDirectionalState(botState, dir);
    if (!state || !state.baseOrderFilled) continue;
    const sellAmount = state.totalAmount.toNumber();
    if (sellAmount <= 0) continue;

    const sellOrder = await connector.placeOrder({
      symbol,
      side: getExitSide(dir),
      type: "market",
      amount: sellAmount,
      reduceOnly: true,
      positionSide: dir.toUpperCase() as "LONG" | "SHORT",
    });

    const lastPrice = sellOrder.cost ? sellOrder.cost / sellAmount : 0;
    const sellFee = estimateFee(sellOrder.cost || 0);
    const pnl = calculateRealizedPnl(
      lastPrice || 0,
      sellAmount,
      state.vwap,
      state.totalFees.plus(sellFee),
      dir
    );
    state.sessionRealizedPnl += pnl;
    totalPnl += pnl;
    botRiskManagers.get(botId)?.onTradeClosed(pnl);

    logAlert({
      botId,
      message: `Emergency exit [${dir}] executed at ${lastPrice || 0}. Realized PnL: $${pnl.toFixed(4)}`,
      metadata: {
        exitPrice: lastPrice || 0,
        vwap: state.vwap.toString(),
        totalAmount: state.totalAmount.toString(),
        pnl,
        fees: state.totalFees.plus(sellFee).toString(),
        direction: dir,
      },
    });
  }

  await prisma.bot.update({
    where: { id: botId },
    data: { status: "stopped", stateJson: null as any, safetyOrdersPlaced: 0 },
  });

  botStates.delete(botId);
  botRiskManagers.delete(botId);
  await unregisterBot(botId);

  const interval = botIntervals.get(botId);
  const persist = botPersistIntervals.get(botId);
  if (interval) { clearInterval(interval); botIntervals.delete(botId); }
  if (persist) { clearInterval(persist); botPersistIntervals.delete(botId); }

  return {
    success: true,
    message: `Emergency exit completed. Total PnL $${totalPnl.toFixed(4)}`,
    pnl: totalPnl,
  };
}

// ============================================================
// Stop
// ============================================================

export async function stopDcaLoop(botId: string): Promise<void> {
  const interval = botIntervals.get(botId);
  if (interval) {
    clearInterval(interval);
    botIntervals.delete(botId);
  }
  const persist = botPersistIntervals.get(botId);
  if (persist) {
    clearInterval(persist);
    botPersistIntervals.delete(botId);
  }
  botStates.delete(botId);
  botRiskManagers.delete(botId);
  await prisma.bot.update({
    where: { id: botId },
    data: { status: "stopped", stateJson: null as any },
  });
  await unregisterBot(botId);
}

// ============================================================
// State helpers
// ============================================================

function createEmptyState(direction: "long" | "short"): DirectionalState {
  return {
    direction,
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
    priceHistory: [],
    extremePrice: 0,
    sessionRealizedPnl: 0,
    peakEquity: 0,
    chopCount: 0,
    divisionTiersHit: [],
    breakevenTriggered: false,
    waterfallPausedTicks: 0,
    activeTrailingTier: -1,
    guardPriceHistory: [],
    guardPausedUntil: 0,
    emaFastHistory: [],
    emaSlowHistory: [],
    rsiValue: null,
    lastMacdSignalTime: 0,
    lastRsiSignalTime: 0,
    lastEmaSignalTime: 0,
    lastPrice: 0,
  };
}

function hydrateDirectionalState(persisted: any): DirectionalState {
  return {
    direction: persisted.direction || "long",
    baseOrderFilled: persisted.baseOrderFilled ?? false,
    safetyOrdersFilled: persisted.safetyOrdersFilled ?? 0,
    totalAmount: new Decimal(persisted.totalAmount || 0),
    totalCost: new Decimal(persisted.totalCost || 0),
    vwap: new Decimal(persisted.vwap || 0),
    totalFees: new Decimal(persisted.totalFees || 0),
    highestPrice: persisted.highestPrice || 0,
    lowestPrice: persisted.lowestPrice || 0,
    lastSafetyTick: persisted.lastSafetyTick || 0,
    tickCount: persisted.tickCount || 0,
    pendingOrders: persisted.pendingOrders || [],
    priceHistory: persisted.priceHistory || [],
    extremePrice: persisted.extremePrice || 0,
    sessionRealizedPnl: persisted.sessionRealizedPnl || 0,
    peakEquity: persisted.peakEquity || 0,
    chopCount: persisted.chopCount || 0,
    divisionTiersHit: persisted.divisionTiersHit || [],
    breakevenTriggered: persisted.breakevenTriggered ?? false,
    waterfallPausedTicks: persisted.waterfallPausedTicks || 0,
    activeTrailingTier: persisted.activeTrailingTier ?? -1,
    guardPriceHistory: persisted.guardPriceHistory || [],
    guardPausedUntil: persisted.guardPausedUntil || 0,
    emaFastHistory: persisted.emaFastHistory || [],
    emaSlowHistory: persisted.emaSlowHistory || [],
    rsiValue: persisted.rsiValue ?? null,
    lastMacdSignalTime: persisted.lastMacdSignalTime || 0,
    lastRsiSignalTime: persisted.lastRsiSignalTime || 0,
    lastEmaSignalTime: persisted.lastEmaSignalTime || 0,
    lastPrice: persisted.lastPrice || 0,
  };
}

function buildDirectionalStateJson(s: DirectionalState): object {
  const livePrice = s.lastPrice || 0;
  const unrealizedPnl = livePrice > 0 ? getUnrealizedPnl(livePrice, s) : 0;
  const unrealizedPct = livePrice > 0 ? getUnrealizedPct(livePrice, s) : 0;
  return {
    direction: s.direction,
    baseOrderFilled: s.baseOrderFilled,
    safetyOrdersFilled: s.safetyOrdersFilled,
    totalAmount: s.totalAmount.toString(),
    totalCost: s.totalCost.toString(),
    vwap: s.vwap.toString(),
    totalFees: s.totalFees.toString(),
    highestPrice: s.highestPrice,
    lowestPrice: s.lowestPrice,
    lastSafetyTick: s.lastSafetyTick,
    tickCount: s.tickCount,
    pendingOrders: s.pendingOrders,
    priceHistory: s.priceHistory,
    extremePrice: s.extremePrice,
    sessionRealizedPnl: s.sessionRealizedPnl,
    realizedPnl: s.sessionRealizedPnl,
    peakEquity: s.peakEquity,
    chopCount: s.chopCount,
    divisionTiersHit: s.divisionTiersHit,
    breakevenTriggered: s.breakevenTriggered,
    waterfallPausedTicks: s.waterfallPausedTicks,
    activeTrailingTier: s.activeTrailingTier,
    lastMacdSignalTime: s.lastMacdSignalTime,
    lastRsiSignalTime: s.lastRsiSignalTime,
    lastEmaSignalTime: s.lastEmaSignalTime,
    livePrice,
    unrealizedPnl,
    unrealizedPct,
  };
}

function hydrateState(persisted: any): BotState {
  if (persisted && persisted.mode === "dual") {
    return {
      mode: "dual",
      long: hydrateDirectionalState(persisted.long),
      short: hydrateDirectionalState(persisted.short),
    };
  }
  return {
    mode: "single",
    state: hydrateDirectionalState(persisted),
  };
}

function buildStateJson(botState: BotState): object {
  if (botState.mode === "dual") {
    const longJson = buildDirectionalStateJson(botState.long) as any;
    const shortJson = buildDirectionalStateJson(botState.short) as any;
    return {
      mode: "dual",
      long: longJson,
      short: shortJson,
      livePrice: longJson.livePrice || shortJson.livePrice || 0,
      realizedPnl: (longJson.realizedPnl || 0) + (shortJson.realizedPnl || 0),
      unrealizedPnl: (longJson.unrealizedPnl || 0) + (shortJson.unrealizedPnl || 0),
      unrealizedPct: longJson.unrealizedPct || shortJson.unrealizedPct || 0,
    };
  }
  return buildDirectionalStateJson(botState.state);
}
