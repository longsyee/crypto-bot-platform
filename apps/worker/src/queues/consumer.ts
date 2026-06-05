import { Worker } from "bullmq";
import { redisConnection } from "../index";
import { handleSignalJob } from "../engine/signal-handler";
import { startDcaLoop, stopDcaLoop, emergencyExit } from "../engine/dca-loop";
import { reconcileRunningBots } from "../engine/bot-registry";
import { prisma } from "@crypto-bot-platform/prisma";

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
