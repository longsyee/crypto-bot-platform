import { prisma } from "@crypto-bot-platform/prisma";
import { getConnector } from "../exchange/registry";
import { decrypt } from "../../api/src/services/encryption";
import { applyTradeFee } from "../services/fee-applier";
import { config } from "../config";

export async function handleSignalJob(job: any): Promise<void> {
  const { botId, userId, payload, mode } = job.data;
  const bot = await prisma.bot.findUnique({
    where: { id: botId },
    include: { connection: true },
  });
  if (!bot) return;

  const connector = getConnector(bot.connection.exchangeId, mode);
  if (mode === "live") {
    await connector.connect({
      apiKey: decrypt(bot.connection.apiKeyEncrypted),
      secret: decrypt(bot.connection.apiSecretEncrypted),
      passphrase: bot.connection.passphraseEncrypted
        ? decrypt(bot.connection.passphraseEncrypted)
        : undefined,
      testnet: bot.connection.isTestnet,
    });
  }

  const order = await connector.placeOrder({
    symbol: payload.symbol || (bot.config as any).default_symbol,
    side: payload.side || (bot.config as any).default_side,
    type: payload.order_type || (bot.config as any).default_order_type || "market",
    amount: payload.volume || (bot.config as any).default_volume || 0,
  });

  await prisma.botOrder.create({
    data: {
      botId,
      exchangeOrderId: order.orderId,
      symbol: payload.symbol || (bot.config as any).default_symbol,
      side: payload.side || (bot.config as any).default_side,
      type: payload.order_type || "market",
      amount: payload.volume || 0,
      status: order.status,
      filled: order.filled,
      remaining: order.remaining,
      feeRateAtEntry: config.GLOBAL_FEE_RATE,
    },
  });

  // Simplified PnL calc; real impl tracks entry/exit pairs
  if (mode === "live") {
    // const pnl = calculatePnL(...)
    // await applyTradeFee(botId, userId, pnl);
  }
}
