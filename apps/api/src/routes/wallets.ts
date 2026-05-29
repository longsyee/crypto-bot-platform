import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { prisma } from "@crypto-bot-platform/prisma";

const wallets = new Hono();

wallets.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  return c.json({ success: true, data: wallet });
});

wallets.post("/convert", authMiddleware, async (c) => {
  const user = c.get("user");
  const { amount, direction } = await c.req.json(); // direction: "usdt_to_token" | "token_to_usdt"
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return c.json({ success: false, error: "Wallet not found" }, 404);

  if (direction === "usdt_to_token") {
    if (wallet.usdtBalance.lessThan(amount)) {
      return c.json({ success: false, error: "Insufficient USDT balance" }, 400);
    }
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: user.id },
        data: { usdtBalance: { decrement: amount }, tokenBalance: { increment: amount } },
      }),
      prisma.transaction.create({
        data: { walletId: wallet.id, type: "convert_out", amount, currency: "USDT", status: "confirmed" },
      }),
      prisma.transaction.create({
        data: { walletId: wallet.id, type: "convert_in", amount, currency: "TOKEN", status: "confirmed" },
      }),
    ]);
  } else {
    if (wallet.tokenBalance.lessThan(amount)) {
      return c.json({ success: false, error: "Insufficient token balance" }, 400);
    }
    await prisma.$transaction([
      prisma.wallet.update({
        where: { userId: user.id },
        data: { tokenBalance: { decrement: amount }, usdtBalance: { increment: amount } },
      }),
      prisma.transaction.create({
        data: { walletId: wallet.id, type: "convert_out", amount, currency: "TOKEN", status: "confirmed" },
      }),
      prisma.transaction.create({
        data: { walletId: wallet.id, type: "convert_in", amount, currency: "USDT", status: "confirmed" },
      }),
    ]);
  }

  const updated = await prisma.wallet.findUnique({ where: { userId: user.id } });
  return c.json({ success: true, data: updated });
});

wallets.get("/transactions", authMiddleware, async (c) => {
  const user = c.get("user");
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return c.json({ success: false, error: "Wallet not found" }, 404);

  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { walletId: wallet.id },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.count({ where: { walletId: wallet.id } }),
  ]);

  return c.json({ success: true, data, meta: { page, limit, total } });
});

export default wallets;
