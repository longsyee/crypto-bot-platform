import { createMiddleware } from "hono/factory";
import { config } from "../config";

const allowedIps = config.ADMIN_ALLOWED_IPS.split(",").map((s) => s.trim());

export const ipAllowlistMiddleware = createMiddleware(async (c, next) => {
  const ip = c.req.header("x-forwarded-for") || c.env?.remoteAddress || "unknown";
  if (!allowedIps.includes(ip)) {
    return c.json({ success: false, error: "Admin access denied from this IP", code: "IP_BLOCKED" }, 403);
  }
  await next();
});
