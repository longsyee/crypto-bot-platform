import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
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
apiKeys.post("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Unnamed Key";
  const permissions = body.permissions ?? ["bots:read", "bots:write", "wallet:read", "wallet:write", "connections:read"];

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
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.permissions !== undefined) update.permissions = body.permissions;
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
