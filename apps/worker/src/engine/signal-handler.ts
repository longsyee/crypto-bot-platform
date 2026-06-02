import { prisma } from "@crypto-bot-platform/prisma";
import { getConnector } from "../exchange/registry";
import { decrypt } from "../services/encryption";
import { applyTradeFee } from "../services/fee-applier";
import { logSignal, logOrder, logTrade } from "@crypto-bot-platform/shared";
import { config } from "../config";

export async function handleSignalJob(job: any): Promise<void> {
  const { botId, userId, payload } = job.data;
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { connection: true },
  });
  if (!bot) return;

  const connector = getConnector(bot.connection.exchangeId, bot.mode, botId);
  if (bot.mode === "live") {
    await connector.connect({
      apiKey: decrypt(bot.connection.apiKeyEncrypted),
      secret: decrypt(bot.connection.apiSecretEncrypted),
      passphrase: bot.connection.passphraseEncrypted
        ? decrypt(bot.connection.passphraseEncrypted)
        : undefined,
      testnet: bot.connection.isTestnet,
    });
  } else {
    await connector.connect({ apiKey: "", secret: "" });
  }

  const symbol =
    bot.tradingPair ||
    payload.symbol ||
    (bot.configJson as any).default_symbol ||
    "BTC/USDT";

  logSignal({
    botId,
    userId,
    message: `Signal received: ${payload.side?.toUpperCase()} ${symbol} @ ${payload.price ?? "market"}`,
    metadata: { ...payload },
  });

  const order = await connector.placeOrder({
    symbol,
    side: payload.side || (bot.configJson as any).default_side,
    type: payload.order_type || (bot.configJson as any).default_order_type || "market",
    amount: payload.volume || (bot.configJson as any).default_volume || 0,
  });

  logOrder({
    botId,
    userId,
    message: `Order placed: ${payload.side?.toUpperCase()} ${symbol} filled=${order.filled}/${payload.volume}`,
    metadata: { orderId: order.orderId, status: order.status, cost: order.cost },
  });

  await prisma.botOrder.create({
    data: {
      botId,
      exchangeOrderId: order.orderId,
      symbol,
      side: payload.side || (bot.configJson as any).default_side,
      type: payload.order_type || "market",
      amount: payload.volume || 0,
      status: order.status,
      filled: order.filled,
      remaining: order.remaining,
      feeRateAtEntry: config.GLOBAL_FEE_RATE,
    },
  });

  // Simplified PnL calc; real impl tracks entry/exit pairs
  if (bot.mode === "live") {
    // const pnl = calculatePnL(...)
    // await applyTradeFee(botId, userId, pnl);
  }
}
