import { Redis } from "ioredis";
import { config } from "../config";
import { prisma } from "@crypto-bot-platform/prisma";

const redis = new Redis(config.REDIS_URL);
const runningBots = new Set<string>();

export async function registerBot(botId: string): Promise<void> {
  runningBots.add(botId);
  await redis.sadd("worker:bot-loops", botId);
}

export async function unregisterBot(botId: string): Promise<void> {
  runningBots.delete(botId);
  await redis.srem("worker:bot-loops", botId);
}

export function isBotRunning(botId: string): boolean {
  return runningBots.has(botId);
}

export async function reconcileRunningBots(): Promise<string[]> {
  const dbRunning = await prisma.bot.findMany({
    where: { status: "running" },
    select: { id: true },
  });
  return dbRunning.map((b) => b.id);
}
