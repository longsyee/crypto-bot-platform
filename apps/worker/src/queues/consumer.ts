import { Worker } from "bullmq";
import { redisConnection } from "../index";
import { handleSignalJob } from "../engine/signal-handler";
import { startDcaLoop, stopDcaLoop, emergencyExit } from "../engine/dca-loop";
import { reconcileRunningBots } from "../engine/bot-registry";
import { prisma } from "@crypto-bot-platform/prisma";
import { getConnector } from "../exchange/registry";
import { decrypt } from "../services/encryption";
import { logAlert } from "@crypto-bot-platform/shared";

async function handleCancelOrderJob(job: any) {
  const { botId, exchangeOrderId, symbol, mode, connection: connectionId } = job.data;
  try {
    const connection = await prisma.exchangeConnection.findUnique({
      where: { id: connectionId },
    });
    if (!connection) throw new Error("Connection not found");

    const connector = getConnector(connection.exchangeId, mode, botId);
    if (mode === "live") {
      await connector.connect({
        apiKey: decrypt(connection.apiKeyEncrypted),
        secret: decrypt(connection.apiSecretEncrypted),
        passphrase: connection.passphraseEncrypted
          ? decrypt(connection.passphraseEncrypted)
          : undefined,
        testnet: connection.isTestnet,
      });
    } else {
      await connector.connect({ apiKey: "", secret: "" });
    }

    if (exchangeOrderId) {
      await connector.cancelOrder(exchangeOrderId, symbol);
    }

    await prisma.botOrder.updateMany({
      where: { botId, exchangeOrderId: exchangeOrderId || undefined },
      data: { status: "canceled" },
    });

    logAlert({
      botId,
      message: `Order ${exchangeOrderId || "unknown"} on ${symbol} canceled`,
      metadata: { exchangeOrderId, symbol },
    });
  } catch (err: any) {
    logAlert({
      botId,
      message: `Cancel order failed: ${err.message}`,
      metadata: { error: err.message, exchangeOrderId, symbol },
    });
    throw err;
  }
}

export const botWorker = new Worker(
  "bot",
  async (job) => {
    try {
      switch (job.name) {
        case "signal-execute":
          await handleSignalJob(job);
          break;
        case "dca-start":
          await startDcaLoop(job.data.botId);
          break;
        case "bot-stop":
          await stopDcaLoop(job.data.botId);
          break;
        case "dca-exit":
          await emergencyExit(job.data.botId);
          break;
        case "order-cancel":
          await handleCancelOrderJob(job);
          break;
        case "dca-sync":
          // Position sync happens automatically every 10 ticks in the DCA loop.
          // This job is a no-op but can be used to trigger UI updates.
          console.log(`[WORKER] Sync requested for bot ${job.data.botId} — sync runs automatically`);
          break;
        default:
          console.warn(`[WORKER] Unknown job type: ${job.name}`);
      }
    } catch (err: any) {
      console.error(`[WORKER] Job ${job.id} (${job.name}) failed:`, err);
      throw err; // Let BullMQ handle retry
    }
  },
  { connection: redisConnection as any, concurrency: 10 }
);

botWorker.on("completed", (job) => console.log(`[WORKER] Job ${job.id} completed`));
botWorker.on("failed", (job, err) =>
  console.error(`[WORKER] Job ${job?.id} failed permanently:`, err)
);

// Reconcile running bots on startup with retry
async function reconcile() {
  const running = await reconcileRunningBots();
  console.log(`[WORKER] Reconciling ${running.length} running bots...`);
  for (const botId of running) {
    try {
      const bot = await prisma.bot.findUnique({ where: { id: botId } });
      if (!bot) continue;
      if (bot.type === "dca") {
        await startDcaLoop(botId);
      }
    } catch (err: any) {
      console.error(`[WORKER] Failed to reconcile bot ${botId}:`, err.message);
      // Don't let one bad bot crash the whole worker startup
    }
  }
}
reconcile().catch((err) => {
  console.error("[WORKER] Reconcile failed:", err);
});
