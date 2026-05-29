import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config";
import { handleSignalJob } from "../engine/signal-handler";
import { startDcaLoop, stopDcaLoop } from "../engine/dca-loop";
import { reconcileRunningBots } from "../engine/bot-registry";
import { prisma } from "@crypto-bot-platform/prisma";

const redisConnection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const botWorker = new Worker(
  "bot",
  async (job) => {
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
      default:
        console.warn(`Unknown job type: ${job.name}`);
    }
  },
  { connection: redisConnection, concurrency: 10 }
);

botWorker.on("completed", (job) => console.log(`Job ${job.id} completed`));
botWorker.on("failed", (job, err) =>
  console.error(`Job ${job?.id} failed:`, err)
);

// Reconcile running bots on startup
async function reconcile() {
  const running = await reconcileRunningBots();
  for (const botId of running) {
    const bot = await prisma.bot.findUnique({ where: { id: botId } });
    if (bot && bot.type === "dca") {
      await startDcaLoop(botId);
    }
  }
}
reconcile().catch(console.error);
