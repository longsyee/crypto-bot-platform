import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { config } from "../config";

const redisConnection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });

export const botQueue = new Queue("bot", { connection: redisConnection });

// A minimal worker here is just for monitoring; real worker is separate process
export const botQueueWorker = new Worker(
  "bot",
  async (job) => {
    console.log(`Job ${job.id} of type ${job.name} received in API worker (monitoring only)`);
  },
  { connection: redisConnection }
);
