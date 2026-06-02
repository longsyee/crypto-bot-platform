import { prisma } from "@crypto-bot-platform/prisma";
import { getConnector } from "../exchange/registry";
import { registerBot, unregisterBot } from "./bot-registry";
import { decrypt } from "../services/encryption";
import { Decimal } from "@prisma/client/runtime/library";
import { logOrder, logTrade, logState, logFee, logAlert } from "@crypto-bot-platform/shared";
import type { ExchangeConnector } from "../exchange/connector";
import { checkIndicatorSignal } from "../indicators";

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

const MAX_CONSECUTIVE_ERRORS = 3;
const SAFETY_COOLDOWN_TICKS = 1;
const POSITION_SYNC_INTERVAL = 10;
const FUNDING_RATE_INTERVAL = 30;
const WATERFALL_WINDOW_TICKS = 12; // 60s at 5s tick
const WATERFALL_PAUSE_TICKS = 6; // 30s pause
const LIMIT_ORDER_MAX_TICKS = 10; // cancel & re-place after 50s
const BREAKEVEN_BUFFER_PCT = 0.3; // must exceed VWAP by 0.3% before breakeven activates

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

function getNextSafetyOrderSize(baseSize: number, volumeScale: number, safetyOrdersFilled: number): number {
  return baseSize * Math.pow(volumeScale, safetyOrdersFilled);
}

function getNextDeviationTrigger(initialDeviation: number, stepScale: number, safetyOrdersFilled: number): number {
  return initialDeviation * Math.pow(stepScale, safetyOrdersFilled);
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

function shouldTriggerStopLoss(
  lastPrice: number,
  vwap: Decimal,
  stopLossPercent: number,
  direction: "long" | "short"
): boolean {
  if (direction === "long") {
    const slPrice = vwap.mul(1 - stopLossPercent / 100);
    return new Decimal(lastPrice).lte(slPrice);
  } else {
    const slPrice = vwap.mul(1 + stopLossPercent / 100);
    return new Decimal(lastPrice).gte(slPrice);
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

function checkWaterfall(state: DirectionalState, ratio: number): boolean {
  if (state.priceHistory.length < 3) return false;
  const prices = state.priceHistory;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
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
        } else if (cfg.indicator_type && cfg.indicator_type !== "none") {
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
          logState({
            botId,
            message: `DCA bot waiting for ${cfg.indicator_type} signal (${cfg.indicator_timeframe || "1h"}) before first order`,
            metadata: {
              indicator_type: cfg.indicator_type,
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

    // Persist state to DB every 30s
    const persistInterval = setInterval(async () => {
      const s = botStates.get(botId);
      if (!s) return;
      await prisma.bot.update({
        where: { id: botId },
        data: { stateJson: buildStateJson(s) as any },
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

          // Update price history for waterfall detection
          currentState.priceHistory.push(lastPrice);
          if (currentState.priceHistory.length > WATERFALL_WINDOW_TICKS) {
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
          if (cfg.indicator_type && cfg.indicator_type !== "none") {
            try {
              const candles = await connector.fetchOHLCV(
                symbol,
                cfg.indicator_timeframe || "1h",
                100
              );
              const closes = candles.map((c) => c.close);
              const result = checkIndicatorSignal(cfg.indicator_type, closes, {
                rsiPeriod: cfg.rsi_period,
                rsiThreshold: cfg.rsi_threshold,
                emaShort: cfg.ema_short,
                emaLong: cfg.ema_long,
              });
              if (result.signal) {
                await placeBaseOrder({
                  botId,
                  symbol,
                  orderType,
                  leverage,
                  connector,
                  cfg,
                  direction,
                  lastPrice,
                  reason: result.reason,
                });
              } else {
                logState({
                  botId,
                  message: `Waiting for ${cfg.indicator_type} signal: ${result.reason}`,
                  metadata: {
                    indicator: cfg.indicator_type,
                    timeframe: cfg.indicator_timeframe,
                    reason: result.reason,
                    price: lastPrice,
                  },
                });
                continue;
              }
            } catch (indicatorErr: any) {
              logAlert({
                botId,
                message: `Indicator check failed: ${indicatorErr.message}. Will retry on next tick.`,
                metadata: { error: indicatorErr.message },
              });
              continue;
            }
          } else {
            await placeBaseOrder({ botId, symbol, orderType, leverage, connector, cfg, direction, lastPrice });
          }
        }

        // Must have base order to proceed
        if (!currentState.baseOrderFilled) continue;

        // --- Reconcile pending orders ---
        await reconcilePendingOrders({ botId, symbol, connector, state: currentState });

        // --- Position sync ---
        if (currentState.tickCount % POSITION_SYNC_INTERVAL === 0 && connector.fetchPositions) {
          await syncPosition({ botId, symbol, connector, state: currentState });
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

        // --- Risk limits ---
        const unrealizedPnl = getUnrealizedPnl(lastPrice, currentState);
        const currentEquity = currentState.totalCost.toNumber() + unrealizedPnl;
        if (currentEquity > currentState.peakEquity) {
          currentState.peakEquity = currentEquity;
        }

        if (cfg.max_session_loss_usdt && getTotalSessionPnl(botState) < -cfg.max_session_loss_usdt) {
          logAlert({
            botId,
            message: `Session loss limit reached: $${currentState.sessionRealizedPnl.toFixed(2)} < -$${cfg.max_session_loss_usdt}. Stopping bot.`,
            metadata: { sessionRealizedPnl: currentState.sessionRealizedPnl, maxSessionLoss: cfg.max_session_loss_usdt },
          });
          await emergencyExit(botId);
          return;
        }

        if (cfg.max_drawdown_pct && currentState.peakEquity > 0) {
          const drawdown = ((currentState.peakEquity - currentEquity) / currentState.peakEquity) * 100;
          if (drawdown >= cfg.max_drawdown_pct) {
            logAlert({
              botId,
              message: `Max drawdown reached: ${drawdown.toFixed(2)}% ≥ ${cfg.max_drawdown_pct}%. Stopping bot.`,
              metadata: { drawdown, maxDrawdown: cfg.max_drawdown_pct, peakEquity: currentState.peakEquity, currentEquity },
            });
            await emergencyExit(botId);
            return;
          }
        }

        // --- Waterfall prevention ---
        if (cfg.waterfall_prevention) {
          if (currentState.waterfallPausedTicks > 0) {
            currentState.waterfallPausedTicks--;
            logState({
              botId,
              message: `Waterfall pause active: ${currentState.waterfallPausedTicks} ticks remaining`,
              metadata: { waterfallPausedTicks: currentState.waterfallPausedTicks },
            });
          } else if (checkWaterfall(currentState, cfg.waterfall_prevention_ratio || 3)) {
            currentState.waterfallPausedTicks = WATERFALL_PAUSE_TICKS;
            logAlert({
              botId,
              message: `Waterfall detected! Volatility exceeded ${cfg.waterfall_prevention_ratio}%. Pausing safety orders for ${WATERFALL_PAUSE_TICKS} ticks.`,
              metadata: { priceHistory: currentState.priceHistory.slice(-5) },
            });
          }
        }

        // --- Safety orders ---
        const nextDeviation = getNextDeviationTrigger(
          cfg.price_deviation_initial,
          cfg.safety_order_step_scale,
          currentState.safetyOrdersFilled
        );

        const canPlaceSafety =
          currentState.waterfallPausedTicks <= 0 &&
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
              const closes = candles.map((c) => c.close);
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

        // --- Breakeven stop-loss ---
        if (
          cfg.breakeven_after_safety_orders > 0 &&
          currentState.safetyOrdersFilled >= cfg.breakeven_after_safety_orders &&
          !currentState.breakevenTriggered
        ) {
          const bePrice = getBreakevenPrice(currentState.vwap, BREAKEVEN_BUFFER_PCT, direction);
          const hitBreakeven = direction === "long"
            ? new Decimal(lastPrice).gte(bePrice)
            : new Decimal(lastPrice).lte(bePrice);

          if (hitBreakeven) {
            currentState.breakevenTriggered = true;
            logState({
              botId,
              message: `Breakeven SL armed at ${currentState.vwap.toFixed(2)} + ${BREAKEVEN_BUFFER_PCT}% buffer`,
              metadata: { breakevenPrice: currentState.vwap.toString(), bufferPct: BREAKEVEN_BUFFER_PCT },
            });
          }
        }

        // --- Stop loss check (fixed + breakeven) ---
        let slTriggered = false;
        let slReason = "";
        if (cfg.stop_loss && cfg.stop_loss > 0) {
          if (shouldTriggerStopLoss(lastPrice, currentState.vwap, cfg.stop_loss, direction)) {
            slTriggered = true;
            slReason = `fixed SL ${cfg.stop_loss}%`;
          }
        }
        if (currentState.breakevenTriggered) {
          const beTrigger = direction === "long"
            ? new Decimal(lastPrice).lte(currentState.vwap)
            : new Decimal(lastPrice).gte(currentState.vwap);
          if (beTrigger) {
            slTriggered = true;
            slReason = "breakeven SL";
          }
        }

        if (slTriggered) {
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

          logAlert({
            botId,
            message: `Stop loss triggered (${slReason}) at ${lastPrice}. Realized PnL: $${pnl.toFixed(4)}`,
            metadata: {
              exitPrice: lastPrice,
              slPrice: currentState.vwap.toString(),
              vwap: currentState.vwap.toString(),
              pnl,
              fees: currentState.totalFees.plus(sellFee).toString(),
              reason: slReason,
            },
          });

          currentState.baseOrderFilled = false;
          anyStopped = true;
        }

        // --- Chop-loss (partial stop-loss) ---
        if (cfg.chop_loss_enabled && cfg.chop_loss_pct > 0 && cfg.chop_sell_pct > 0) {
          const unrealizedPct = Math.abs(getUnrealizedPct(lastPrice, currentState));
          if (unrealizedPct >= cfg.chop_loss_pct) {
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

              if (cfg.max_chop_count && currentState.chopCount >= cfg.max_chop_count) {
                logAlert({
                  botId,
                  message: `Max chop count (${cfg.max_chop_count}) reached. Stopping bot.`,
                });
                await stopDcaLoop(botId);
                return;
              }

              if (currentState.totalAmount.lessThanOrEqualTo(0)) {
                logAlert({ botId, message: `[${direction}] Position fully chopped.` });
                currentState.baseOrderFilled = false;
                anyStopped = true;
              }
            }
          }
        }

        // --- Max levels reached ---
        if (currentState.safetyOrdersFilled >= cfg.safety_order_max_count) {
          logAlert({
            botId,
            message: `[${direction}] Max safety orders reached without profit`,
            metadata: {
              maxSafetyOrders: cfg.safety_order_max_count,
              totalAmount: currentState.totalAmount.toString(),
              vwap: currentState.vwap.toString(),
            },
          });
          currentState.baseOrderFilled = false;
          anyStopped = true;
        }
      } // end for direction loop

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

  const baseAmount = usdtToAmount(cfg.base_order_size, execPrice);

  if (cfg.max_position_size && baseAmount > cfg.max_position_size) {
    logAlert({
      botId,
      message: `Base order skipped: ${baseAmount} exceeds max position size ${cfg.max_position_size}`,
    });
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
}) {
  const { botId, symbol, orderType, leverage, connector, cfg, state, lastPrice } = opts;

  const safetyUsdt = getNextSafetyOrderSize(
    cfg.safety_order_size,
    cfg.safety_order_volume_scale,
    state.safetyOrdersFilled
  );
  const safetyAmount = usdtToAmount(safetyUsdt, lastPrice);

  // Enforce max position size
  if (cfg.max_position_size) {
    const projectedAmount = state.totalAmount.toNumber() + safetyAmount;
    if (projectedAmount > cfg.max_position_size) {
      logAlert({
        botId,
        message: `Safety order #${state.safetyOrdersFilled + 1} skipped: projected size ${projectedAmount.toFixed(6)} exceeds max ${cfg.max_position_size}`,
      });
      return;
    }
  }

  let price: number | undefined;
  if (orderType === "limit") {
    const nextDeviation = getNextDeviationTrigger(
      cfg.price_deviation_initial,
      cfg.safety_order_step_scale,
      state.safetyOrdersFilled
    );
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

    // Liquidation proximity check
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
  };
}

function buildDirectionalStateJson(s: DirectionalState): object {
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
    peakEquity: s.peakEquity,
    chopCount: s.chopCount,
    divisionTiersHit: s.divisionTiersHit,
    breakevenTriggered: s.breakevenTriggered,
    waterfallPausedTicks: s.waterfallPausedTicks,
    activeTrailingTier: s.activeTrailingTier,
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
    return {
      mode: "dual",
      long: buildDirectionalStateJson(botState.long),
      short: buildDirectionalStateJson(botState.short),
    };
  }
  return buildDirectionalStateJson(botState.state);
}
