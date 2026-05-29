import { createMiddleware } from "hono/factory";
import { Redis } from "ioredis";
import { config } from "../config";

const redis = new Redis(config.REDIS_URL);

export function rateLimitMiddleware(
  maxRequests: number,
  windowSeconds: number,
  keyPrefix: string
) {
  return createMiddleware(async (c, next) => {
    const ip = c.req.header("x-forwarded-for") || "unknown";
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
