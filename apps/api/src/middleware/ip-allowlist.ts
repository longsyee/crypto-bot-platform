import { createMiddleware } from "hono/factory";
import { config } from "../config";

const allowedIps = config.ADMIN_ALLOWED_IPS.split(",").map((s) => s.trim()).filter(Boolean);

function getClientIp(c: any): string {
  // Headers commonly set by reverse proxies
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    // First IP in the chain is the original client
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }

  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp;

  // Hono node-server adapter exposes the raw Node socket
  const raw = c.req.raw as any;
  if (raw?.socket?.remoteAddress) return raw.socket.remoteAddress;

  // Cloudflare Workers / Deno / Bun edge runtime
  if (c.env?.remoteAddress) return c.env.remoteAddress;

  return "unknown";
}

export const ipAllowlistMiddleware = createMiddleware(async (c, next) => {
  const ip = getClientIp(c);

  // Always allow localhost / loopback for development
  const isLocalhost =
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip === "localhost" ||
    ip === "unknown"; // Vite proxy hides the IP in dev — don't block it

  if (isLocalhost) {
    return await next();
  }

  if (!allowedIps.includes(ip)) {
    return c.json({ success: false, error: "Admin access denied from this IP", code: "IP_BLOCKED" }, 403);
  }

  await next();
});
