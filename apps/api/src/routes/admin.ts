import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { roleMiddleware } from "../middleware/role";
import { ipAllowlistMiddleware } from "../middleware/ip-allowlist";
import { prisma } from "@crypto-bot-platform/prisma";
import { config } from "../config";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const admin = new Hono();

admin.use("/*", authMiddleware, roleMiddleware("admin"), ipAllowlistMiddleware);

admin.get("/dashboard", async (c) => {
  const [totalUsers, totalBots, totalFees, activeBots] = await Promise.all([
    prisma.user.count(),
    prisma.bot.count(),
    prisma.transaction.aggregate({ where: { type: "trade_fee" }, _sum: { amount: true } }),
    prisma.bot.count({ where: { status: "running" } }),
  ]);
  return c.json({
    success: true,
    data: { totalUsers, totalBots, totalFees: totalFees._sum.amount, activeBots },
  });
});

admin.get("/audit-log", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const [data, total] = await Promise.all([
    prisma.adminAuditLog.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.adminAuditLog.count(),
  ]);
  return c.json({ success: true, data, meta: { page, limit, total } });
});

admin.get("/security-events", async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const [data, total] = await Promise.all([
    prisma.securityEvent.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.securityEvent.count(),
  ]);
  return c.json({ success: true, data, meta: { page, limit, total } });
});

admin.post("/bots/:id/kill", async (c) => {
  const id = c.req.param("id");
  const adminUser = c.get("user");
  await prisma.bot.update({ where: { id }, data: { status: "stopped" } });
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: adminUser.id,
      action: "kill_bot",
      targetType: "bot",
      targetId: id,
      ipAddress: c.req.header("x-forwarded-for") || "unknown",
    },
  });
  return c.json({ success: true, data: { status: "stopped" } });
});

admin.post("/referrals/:id/approve-kol", async (c) => {
  const id = c.req.param("id");
  const adminUser = c.get("user");
  const ref = await prisma.referral.update({
    where: { id },
    data: { tier: "kol", commissionRate: 0.35 },
  });
  await prisma.adminAuditLog.create({
    data: {
      adminUserId: adminUser.id,
      action: "approve_kol",
      targetType: "referral",
      targetId: id,
      oldValueJson: { tier: "pending_kol" } as any,
      newValueJson: { tier: "kol", commissionRate: 0.35 } as any,
      ipAddress: c.req.header("x-forwarded-for") || "unknown",
    },
  });
  return c.json({ success: true, data: ref });
});

const RefundSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.coerce.number().positive(),
});

admin.post("/refund", zValidator("json", RefundSchema), async (c) => {
  const adminUser = c.get("user");
  const { transactionId, amount } = c.req.valid("json");
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) return c.json({ success: false, error: "Transaction not found" }, 404);
  if (tx.type !== "trade_fee") return c.json({ success: false, error: "Transaction must be of type trade_fee" }, 400);
  if (amount > tx.amount.toNumber()) return c.json({ success: false, error: `Refund amount cannot exceed transaction amount (${tx.amount.toNumber()})` }, 400);

  const existingRefund = await prisma.transaction.findFirst({
    where: {
      walletId: tx.walletId,
      type: "refund",
      metadataJson: { path: ["originalTransactionId"], equals: transactionId },
    },
  });
  if (existingRefund) return c.json({ success: false, error: "Transaction has already been refunded" }, 400);

  const wallet = await prisma.wallet.findUnique({ where: { id: tx.walletId } });
  const oldBalance = wallet?.tokenBalance.toNumber() ?? 0;

  await prisma.$transaction([
    prisma.wallet.update({ where: { id: tx.walletId }, data: { tokenBalance: { increment: amount } } }),
    prisma.transaction.create({
      data: {
        walletId: tx.walletId,
        type: "refund",
        amount,
        currency: "TOKEN",
        status: "confirmed",
        metadataJson: { originalTransactionId: transactionId },
      },
    }),
    prisma.adminAuditLog.create({
      data: {
        adminUserId: adminUser.id,
        action: "refund",
        targetType: "transaction",
        targetId: transactionId,
        oldValueJson: { tokenBalance: oldBalance } as any,
        newValueJson: { refunded: amount } as any,
        ipAddress: c.req.header("x-forwarded-for") || "unknown",
      },
    }),
  ]);

  return c.json({ success: true });
});

export default admin;
