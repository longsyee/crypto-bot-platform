import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { roleMiddleware } from "../middleware/role";
import { ipAllowlistMiddleware } from "../middleware/ip-allowlist";
import { prisma } from "@crypto-bot-platform/prisma";
import { config } from "../config";

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
      ipAddress: c.req.header("x-forwarded-for"),
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
      oldValue: { tier: "pending_kol" },
      newValue: { tier: "kol", commissionRate: 0.35 },
      ipAddress: c.req.header("x-forwarded-for"),
    },
  });
  return c.json({ success: true, data: ref });
});

admin.post("/refund", async (c) => {
  const adminUser = c.get("user");
  const { transactionId, amount } = await c.req.json();
  const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
  if (!tx) return c.json({ success: false, error: "Transaction not found" }, 404);

  await prisma.$transaction([
    prisma.wallet.update({ where: { id: tx.walletId }, data: { tokenBalance: { increment: amount } } }),
    prisma.transaction.create({
      data: { walletId: tx.walletId, type: "refund", amount, currency: "TOKEN", status: "confirmed" },
    }),
  ]);

  await prisma.adminAuditLog.create({
    data: {
      adminUserId: adminUser.id,
      action: "refund",
      targetType: "transaction",
      targetId: transactionId,
      oldValue: { tokenBalance: tx.amount },
      newValue: { refunded: amount },
      ipAddress: c.req.header("x-forwarded-for"),
    },
  });

  return c.json({ success: true });
});

export default admin;
