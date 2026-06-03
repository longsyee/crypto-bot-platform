import { createMiddleware } from "hono/factory";
import { prisma } from "@crypto-bot-platform/prisma";

/**
 * Middleware that authenticates via X-API-Key header.
 * Looks up the key hash, validates expiry/revocation, and sets user + apiKey in context.
 */
export const apiKeyAuthMiddleware = createMiddleware(async (c, next) => {
  const key = c.req.header("X-API-Key") || c.req.header("x-api-key");
  if (!key) {
    return c.json({ success: false, error: "Missing API key", code: "NO_API_KEY" }, 401);
  }

  // Keys format: nb_<prefix>_<secret>
  // We store a hash of the full key. The prefix is used for lookup optimization.
  const parts = key.split("_");
  if (parts.length < 3 || parts[0] !== "nb") {
    return c.json({ success: false, error: "Invalid API key format", code: "BAD_API_KEY_FORMAT" }, 401);
  }

  const prefix = parts.slice(0, 2).join("_"); // e.g., "nb_a1b2c3d4"

  // Find candidate keys by prefix (fast index lookup)
  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix: prefix, revoked: false },
    include: { user: true },
  });

  if (candidates.length === 0) {
    return c.json({ success: false, error: "Invalid API key", code: "INVALID_API_KEY" }, 401);
  }

  // Use Bun's native password verify if available, otherwise fallback to simple timing-safe compare
  const { timingSafeEqual, createHash } = await import("crypto");

  let matched: (typeof candidates)[0] | null = null;
  const keyHash = createHash("sha256").update(key).digest("hex");

  for (const candidate of candidates) {
    // Timing-safe comparison of SHA-256 hashes
    const candidateBuf = Buffer.from(candidate.keyHash, "hex");
    const keyBuf = Buffer.from(keyHash, "hex");
    if (candidateBuf.length === keyBuf.length && timingSafeEqual(candidateBuf, keyBuf)) {
      matched = candidate;
      break;
    }
  }

  if (!matched) {
    return c.json({ success: false, error: "Invalid API key", code: "INVALID_API_KEY" }, 401);
  }

  // Check expiration
  if (matched.expiresAt && new Date() > matched.expiresAt) {
    return c.json({ success: false, error: "API key expired", code: "API_KEY_EXPIRED" }, 401);
  }

  // Check user suspension
  if (matched.user.suspended) {
    return c.json({ success: false, error: "Account suspended", code: "ACCOUNT_SUSPENDED" }, 403);
  }

  // Update lastUsedAt (fire-and-forget)
  prisma.apiKey.update({
    where: { id: matched.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

  const permissions = Array.isArray(matched.permissions) ? (matched.permissions as string[]) : [];

  c.set("user", matched.user);
  c.set("apiKey", matched);
  c.set("apiKeyPermissions", permissions);
  await next();
});
