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
  if (!bot.connection) {
    throw new Error(`Bot ${botId} missing exchange connection`);
  }

  // Seed paperInitialBalance from current wallet SimFunds on first signal (if empty)
  if (bot.mode === "paper") {
    const currentInitial = (bot as any).paperInitialBalance as Record<string, number> | null;
    if (!currentInitial || (currentInitial.USDT ?? 0) <= 0) {
      try {
        const wallet = await prisma.wallet.findUnique({
          where: { userId: bot.userId },
          select: { simFundsBalance: true },
        });
        const simFunds = wallet?.simFundsBalance?.toNumber() ?? 0;
        if (simFunds > 0) {
          await prisma.bot.update({
            where: { id: botId },
            data: { paperInitialBalance: { USDT: simFunds } as any },
          });
        }
      } catch (_e) {
        // ignore
      }
    }
  }

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

  const cfg = bot.configJson as any;
  const isLimit = (payload.order_type || cfg.default_order_type || "market") === "limit";
  const price = isLimit ? (payload.price || cfg.default_price) : undefined;
  const amount = payload.volume || cfg.default_volume || 0;

  if (!amount || amount <= 0) {
    throw new Error(`Invalid order amount: ${amount}. Must be > 0.`);
  }

  const order = await connector.placeOrder({
    symbol,
    side: payload.side || cfg.default_side,
    type: payload.order_type || cfg.default_order_type || "market",
    amount,
    price,
    reduceOnly: payload.reduce_only || cfg.reduce_only || false,
    positionSide: payload.position_side || cfg.position_side || undefined,
  });

  logOrder({
    botId,
    userId,
    message: `Order placed: ${payload.side?.toUpperCase()} ${symbol} filled=${order.filled}/${payload.volume}`,
    metadata: { orderId: order.orderId, status: order.status, cost: order.cost },
  });

  // BotOrder is now recorded automatically by CCXTConnector.placeOrder
  // so both paper and live have a persistent, unified order ledger.

  // Simplified PnL calc; real impl tracks entry/exit pairs
  if (bot.mode === "live") {
    // const pnl = calculatePnL(...)
    // await applyTradeFee(botId, userId, pnl);
  }
}
