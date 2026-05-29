import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Redis } from "ioredis";
import { config } from "../config";

const redis = new Redis(config.REDIS_URL);
const subscribers = new Map<string, ReadableStreamDefaultController>();

export function broadcastToUser(userId: string, event: string, data: unknown): void {
  const controller = subscribers.get(userId);
  if (controller) {
    controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

export function setupSSE(app: Hono) {
  app.get("/events", async (c) => {
    // In real implementation, add authMiddleware here
    const userId = c.get("user")?.id;
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    return streamSSE(c, async (stream) => {
      subscribers.set(userId, stream as unknown as ReadableStreamDefaultController);
      stream.onAbort(() => subscribers.delete(userId));
      // Keep alive
      while (true) {
        await stream.write(`:ping\n\n`);
        await new Promise((r) => setTimeout(r, 30000));
      }
    });
  });

  // Subscribe to Redis Pub/Sub and forward to SSE
  redis.subscribe("events:trade", "events:bot-status", "events:balance");
  redis.on("message", (channel, message) => {
    const { userId, event, data } = JSON.parse(message);
    broadcastToUser(userId, event, data);
  });
}
