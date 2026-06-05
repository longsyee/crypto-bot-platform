import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { Redis } from "ioredis";
import { config } from "../config";

const redis = new Redis(config.REDIS_URL);
const subscribers = new Map<string, Set<ReadableStreamDefaultController>>();

export function broadcastToUser(userId: string, event: string, data: unknown): void {
  const set = subscribers.get(userId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const controller of set) {
    try {
      controller.enqueue(payload);
    } catch {
      // controller may be closed
    }
  }
}

export function setupSSE(app: Hono) {
  app.get("/events", async (c) => {
    // In real implementation, add authMiddleware here
    const user = c.get("user") as { id: string } | undefined;
    const userId = user?.id;
    if (!userId) return c.json({ success: false, error: "Unauthorized" }, 401);

    return streamSSE(c, async (stream) => {
      const controller = stream as unknown as ReadableStreamDefaultController;
      let set = subscribers.get(userId);
      if (!set) {
        set = new Set();
        subscribers.set(userId, set);
      }
      set.add(controller);
      stream.onAbort(() => {
        const s = subscribers.get(userId);
        if (s) {
          s.delete(controller);
          if (s.size === 0) subscribers.delete(userId);
        }
      });
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
    try {
      const { userId, event, data } = JSON.parse(message);
      broadcastToUser(userId, event, data);
    } catch (err) {
      console.error("[SSE] Failed to parse Redis message:", err);
    }
  });
}
