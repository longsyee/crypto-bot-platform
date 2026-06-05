import { createMiddleware } from "hono/factory";
import { getConnInfo } from "@hono/node-server/conninfo";
import { Redis } from "ioredis";
import { config } from "../config";

const redis = new Redis(config.REDIS_URL);

export function rateLimitMiddleware(
  maxRequests: number,
  windowSeconds: number,
  keyPrefix: string
) {
  return createMiddleware(async (c, next) => {
    let ip: string;
    try {
      const info = getConnInfo(c);
      ip = info.remote.address || "unknown";
    } catch {
      ip = "unknown";
    }
    const key = `ratelimit:${keyPrefix}:${ip}`;
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    if (current > maxRequests) {
      return c.json({ success: false, error: "Rate limit exceeded", code: "RATE_LIMIT" }, 429);
    }
    await next();
  });
}
