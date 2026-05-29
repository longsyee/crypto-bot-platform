import { Redis } from "ioredis";
import { config } from "../config";

const redis = new Redis(config.REDIS_URL);

export async function writeHeartbeat(): Promise<void> {
  await redis.set("worker:heartbeat", Date.now(), "EX", 60);
}
