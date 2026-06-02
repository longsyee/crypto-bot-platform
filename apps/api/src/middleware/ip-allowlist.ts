import { createMiddleware } from "hono/factory";
import { config } from "../config";

const allowedIps = config.ADMIN_ALLOWED_IPS.split(",").map((s) => s.trim());

export const ipAllowlistMiddleware = createMiddleware(async (c, next) => {
  // x-forwarded-for should only be trusted when behind a verified proxy
  const ip = c.req.header("x-real-ip") || c.env?.remoteAddress || "unknown";
  if (!ip || ip === "unknown") {
    return c.json({ success: false, error: "Unable to determine client IP", code: "IP_UNKNOWN" }, 403);
  }
  if (!allowedIps.includes(ip)) {
    return c.json({ success: false, error: "Admin access denied from this IP", code: "IP_BLOCKED" }, 403);
  }
  await next();
});
