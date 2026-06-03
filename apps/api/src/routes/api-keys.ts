import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { prisma } from "@crypto-bot-platform/prisma";
import { randomBytes, createHash } from "crypto";

const apiKeys = new Hono();

function generateApiKey(): { fullKey: string; prefix: string; hash: string } {
  const prefix = randomBytes(4).toString("hex"); // 8 chars
  const secret = randomBytes(32).toString("hex"); // 64 chars
  const fullKey = `nb_${prefix}_${secret}`;
  const hash = createHash("sha256").update(fullKey).digest("hex");
  return { fullKey, prefix: `nb_${prefix}`, hash };
}

// List API keys (mask full key, only show prefix)
apiKeys.get("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const data = await prisma.apiKey.findMany({
    where: { userId: user.id, revoked: false },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      permissions: true,
      lastUsedAt: true,
      expiresAt: true,
      revoked: true,
      createdAt: true,
    },
  });
  return c.json({ success: true, data });
});

// Create new API key (returns plaintext ONCE)
apiKeys.post("/", rateLimitMiddleware(5, 900, "api-key-create"), authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  // Validate name
  const rawName = typeof body.name === "string" ? body.name.trim() : "";
  if (!rawName || rawName.length > 100) {
    return c.json({ success: false, error: "Key name is required and must be ≤ 100 characters", code: "BAD_NAME" }, 400);
  }
  const name = rawName;

  // Validate permissions
  const defaultPerms = ["bots:read", "bots:write", "wallet:read", "wallet:write", "connections:read"];
  let permissions = defaultPerms;
  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions) || body.permissions.length > 20) {
      return c.json({ success: false, error: "permissions must be an array with ≤ 20 items", code: "BAD_PERMISSIONS" }, 400);
    }
    const validPerms = new Set([
      "bots:read", "bots:write", "bots:delete",
      "wallet:read", "wallet:write",
      "connections:read", "connections:write",
      "signals:write", "logs:read", "referrals:read",
    ]);
    const invalid = body.permissions.filter((p: any) => typeof p !== "string" || !validPerms.has(p));
    if (invalid.length > 0) {
      return c.json({ success: false, error: `Invalid permissions: ${invalid.join(", ")}`, code: "BAD_PERMISSIONS" }, 400);
    }
    permissions = body.permissions;
  }

  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const { fullKey, prefix, hash } = generateApiKey();

  await prisma.apiKey.create({
    data: {
      userId: user.id,
      name,
      keyHash: hash,
      keyPrefix: prefix,
      permissions,
      expiresAt,
    },
  });

  return c.json({
    success: true,
    data: {
      apiKey: fullKey,
      name,
      prefix,
      permissions,
      expiresAt,
      warning: "This key is shown only once. Store it securely.",
    },
  }, 201);
});

// Revoke an API key
apiKeys.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const key = await prisma.apiKey.findFirst({
    where: { id, userId: user.id },
  });

  if (!key) {
    return c.json({ success: false, error: "API key not found" }, 404);
  }

  await prisma.apiKey.update({
    where: { id },
    data: { revoked: true },
  });

  return c.json({ success: true, data: { id, revoked: true } });
});

// Rename / update permissions
apiKeys.patch("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();

  const key = await prisma.apiKey.findFirst({
    where: { id, userId: user.id },
  });

  if (!key) {
    return c.json({ success: false, error: "API key not found" }, 404);
  }

  const update: any = {};

  if (body.name !== undefined) {
    const rawName = typeof body.name === "string" ? body.name.trim() : "";
    if (!rawName || rawName.length > 100) {
      return c.json({ success: false, error: "Key name must be 1–100 characters", code: "BAD_NAME" }, 400);
    }
    update.name = rawName;
  }

  if (body.permissions !== undefined) {
    if (!Array.isArray(body.permissions) || body.permissions.length > 20) {
      return c.json({ success: false, error: "permissions must be an array with ≤ 20 items", code: "BAD_PERMISSIONS" }, 400);
    }
    const validPerms = new Set([
      "bots:read", "bots:write", "bots:delete",
      "wallet:read", "wallet:write",
      "connections:read", "connections:write",
      "signals:write", "logs:read", "referrals:read",
    ]);
    const invalid = body.permissions.filter((p: any) => typeof p !== "string" || !validPerms.has(p));
    if (invalid.length > 0) {
      return c.json({ success: false, error: `Invalid permissions: ${invalid.join(", ")}`, code: "BAD_PERMISSIONS" }, 400);
    }
    update.permissions = body.permissions;
  }

  if (body.expiresAt !== undefined) update.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;

  const updated = await prisma.apiKey.update({
    where: { id },
    data: update,
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      permissions: true,
      lastUsedAt: true,
      expiresAt: true,
      revoked: true,
      createdAt: true,
    },
  });

  return c.json({ success: true, data: updated });
});

export default apiKeys;
