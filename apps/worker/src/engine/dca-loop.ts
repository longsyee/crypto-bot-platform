import { prisma } from "@crypto-bot-platform/prisma";
import { getConnector } from "../exchange/registry";
import { registerBot, unregisterBot } from "./bot-registry";
import { Decimal } from "@prisma/client/runtime/library";
import type { ExchangeConnector } from "../exchange/connector";

interface DcaState {
  baseOrderFilled: boolean;
  safetyOrdersFilled: number;
  totalAmount: Decimal;
  totalCost: Decimal;
  vwap: Decimal;
}

const botStates = new Map<string, DcaState>();
const botIntervals = new Map<string, NodeJS.Timeout>();
const botPersistIntervals = new Map<string, NodeJS.Timeout>();

// Pure math helpers for testability
export function calculateVwap(
  totalAmount: Decimal,
  totalCost: Decimal
): Decimal {
  if (totalAmount.lessThanOrEqualTo(0)) return new Decimal(0);
  return totalCost.div(totalAmount);
}

export function getNextSafetyOrderSize(
  baseSize: number,
  volumeScale: number,
  safetyOrdersFilled: number
): number {
  return baseSize * Math.pow(volumeScale, safetyOrdersFilled);
}

export function getNextDeviationTrigger(
  initialDeviation: number,
  stepScale: number,
  safetyOrdersFilled: number
): number {
  return initialDeviation * Math.pow(stepScale, safetyOrdersFilled);
}

export function shouldTriggerTakeProfit(
  lastPrice: number,
  vwap: Decimal,
  takeProfitPercent: number
): boolean {
  const tpPrice = vwap.mul(1 + takeProfitPercent / 100);
  return new Decimal(lastPrice).gte(tpPrice);
}

export async function startDcaLoop(botId: string): Promise<void> {
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
  const connector = getConnector(bot.connection.exchangeId, bot.mode);

  if (bot.mode === "live") {
    // Live mode key decryption handled inside signal handler pattern;
    // for DCA loop, keys should be passed or loaded here.
    // Placeholder: connector.connect(...) would go here.
  }

  const symbol = cfg.default_symbol || "BTC/USDT";
  const baseOrder = await connector.placeOrder({
    symbol,
    side: "buy",
    type: "market",
    amount: cfg.base_order_size,
  });

  const totalCost = new Decimal(
    baseOrder.cost || cfg.base_order_size * 50000
  );
  const totalAmount = new Decimal(cfg.base_order_size);

  const state: DcaState = {
    baseOrderFilled: true,
    safetyOrdersFilled: 0,
    totalAmount,
    totalCost,
    vwap: calculateVwap(totalAmount, totalCost),
  };

  botStates.set(botId, state);

  // Persist state to DB every 30s
  const persistInterval = setInterval(async () => {
    const s = botStates.get(botId);
    if (!s) return;
    await prisma.botLog.create({
      data: {
        botId,
        level: "info",
        message: `DCA state: SO=${s.safetyOrdersFilled} VWAP=${s.vwap.toFixed(4)}`,
        metadataJson: {
          totalAmount: s.totalAmount.toString(),
          totalCost: s.totalCost.toString(),
          vwap: s.vwap.toString(),
        },
      },
    });
  }, 30000);
  botPersistIntervals.set(botId, persistInterval);

  // Price watch loop
  const interval = setInterval(async () => {
    if (!botStates.has(botId)) {
      clearInterval(interval);
      clearInterval(persistInterval);
      return;
    }

    const currentState = botStates.get(botId)!;
    const ticker = await connector.getTicker(symbol);
    const lastPrice = new Decimal(ticker.last);

    const deviation = currentState.vwap
      .minus(lastPrice)
      .div(currentState.vwap)
      .abs();

    const nextDeviation = getNextDeviationTrigger(
      cfg.price_deviation_initial,
      cfg.safety_order_step_scale,
      currentState.safetyOrdersFilled
    );

    if (
      deviation.gte(nextDeviation) &&
      currentState.safetyOrdersFilled < cfg.safety_order_max_count
    ) {
      const safetySize = getNextSafetyOrderSize(
        cfg.safety_order_size,
        cfg.safety_order_volume_scale,
        currentState.safetyOrdersFilled
      );
      const safetyOrder = await connector.placeOrder({
        symbol,
        side: "buy",
        type: "market",
        amount: safetySize,
      });
      currentState.safetyOrdersFilled++;
      currentState.totalAmount = currentState.totalAmount.plus(safetySize);
      currentState.totalCost = currentState.totalCost.plus(
        new Decimal(safetyOrder.cost || safetySize * ticker.last)
      );
      currentState.vwap = calculateVwap(
        currentState.totalAmount,
        currentState.totalCost
      );

      await prisma.botLog.create({
        data: {
          botId,
          level: "info",
          message: `Safety order #${currentState.safetyOrdersFilled} placed at ${ticker.last}`,
        },
      });
    }

    // Take profit check
    if (
      shouldTriggerTakeProfit(ticker.last, currentState.vwap, cfg.take_profit)
    ) {
      await connector.placeOrder({
        symbol,
        side: "sell",
        type: "market",
        amount: currentState.totalAmount.toNumber(),
      });
      await prisma.bot.update({
        where: { id: botId },
        data: { status: "stopped" },
      });
      botStates.delete(botId);
      await unregisterBot(botId);
      clearInterval(interval);
      clearInterval(persistInterval);
      return;
    }

    // Max levels reached
    if (currentState.safetyOrdersFilled >= cfg.safety_order_max_count) {
      await prisma.bot.update({
        where: { id: botId },
        data: { status: "stopped" },
      });
      await prisma.botLog.create({
        data: {
          botId,
          level: "warn",
          message: "Max safety orders reached without profit",
        },
      });
      botStates.delete(botId);
      await unregisterBot(botId);
      clearInterval(interval);
      clearInterval(persistInterval);
      return;
    }
  }, 5000);

  botIntervals.set(botId, interval);
}

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
  await unregisterBot(botId);
}
