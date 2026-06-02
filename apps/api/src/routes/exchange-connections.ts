import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { prisma } from "@crypto-bot-platform/prisma";
import { encrypt } from "../services/encryption";
import { isSupportedExchange } from "@crypto-bot-platform/shared";
import { fetchMarkets, fetchBalance } from "../services/ccxt-markets";

const connections = new Hono();

connections.get("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const data = await prisma.exchangeConnection.findMany({
    where: { userId: user.id },
    select: { id: true, name: true, exchangeId: true, isActive: true, createdAt: true },
  });
  return c.json({ success: true, data });
});

connections.post("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  if (!isSupportedExchange(body.exchangeId)) {
    return c.json({ success: false, error: "Unsupported exchange", code: "BAD_EXCHANGE" }, 400);
  }
  const conn = await prisma.exchangeConnection.create({
    data: {
      userId: user.id,
      exchangeId: body.exchangeId,
      name: body.name,
      apiKeyEncrypted: encrypt(body.apiKey),
      apiSecretEncrypted: encrypt(body.apiSecret),
      passphraseEncrypted: body.passphrase ? encrypt(body.passphrase) : null,
      isTestnet: false,
    },
  });
  return c.json({ success: true, data: { id: conn.id, name: conn.name, exchangeId: conn.exchangeId } }, 201);
});

connections.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await prisma.exchangeConnection.deleteMany({ where: { id, userId: user.id } });
  return c.json({ success: true });
});

connections.get("/:id/markets", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const quote = c.req.query("quote") || "USDT";

  const conn = await prisma.exchangeConnection.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!conn) {
    return c.json({ success: false, error: "Connection not found" }, 404);
  }

  try {
    const data = await fetchMarkets(id, quote);
    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch markets" }, 502);
  }
});

connections.get("/:id/balance", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const conn = await prisma.exchangeConnection.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!conn) {
    return c.json({ success: false, error: "Connection not found" }, 404);
  }

  try {
    const data = await fetchBalance(id);
    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch balance" }, 502);
  }
});

export default connections;
