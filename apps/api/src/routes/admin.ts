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

/**
 * GET /admin/referral-withdrawals
 * List pending (or all) referral withdrawal requests.
 */
admin.get("/referral-withdrawals", async (c) => {
  const status = c.req.query("status") || "pending";
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);

  const where: any = {};
  if (status !== "all") where.status = status;

  const [data, total] = await Promise.all([
    prisma.referralWithdrawRequest.findMany({
      where,
      include: { wallet: { include: { user: { select: { id: true, email: true } } } } },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { requestedAt: "desc" },
    }),
    prisma.referralWithdrawRequest.count({ where }),
  ]);

  return c.json({ success: true, data, meta: { page, limit, total } });
});

/**
 * POST /admin/referral-withdrawals/:id/approve
 * Approve a pending withdrawal request → credit USDT to referrer.
 */
admin.post("/referral-withdrawals/:id/approve", async (c) => {
  const id = c.req.param("id");
  const adminUser = c.get("user");

  const request = await prisma.referralWithdrawRequest.findUnique({
    where: { id },
    include: { wallet: { include: { user: true } } },
  });

  if (!request) return c.json({ success: false, error: "Request not found" }, 404);
  if (request.status !== "pending") {
    return c.json({ success: false, error: `Request already ${request.status}` }, 400);
  }

  const wallet = request.wallet;
  if (!wallet) return c.json({ success: false, error: "Referrer wallet not found" }, 404);

  await prisma.$transaction(async (tx) => {
    // 1. Credit USDT to referrer
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { usdtBalance: { increment: request.amount.toNumber() } },
    });

    // 2. Mark request approved
    await tx.referralWithdrawRequest.update({
      where: { id },
      data: {
        status: "approved",
        processedAt: new Date(),
        processedBy: adminUser.id,
      },
    });

    // 3. Record approval transaction
    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "referral_withdraw_approved",
        amount: request.amount.toNumber(),
        currency: "USDT",
        status: "confirmed",
        metadataJson: { requestId: id, approvedBy: adminUser.id },
      },
    });

    // 4. Record company payout in system ledger
    const lastLedger = await tx.systemLedger.findFirst({
      orderBy: { createdAt: "desc" },
    });
    const previousBalance = lastLedger ? Number(lastLedger.usdtBalance) : 0;
    await tx.systemLedger.create({
      data: {
        type: "referral_paid",
        amount: request.amount.toNumber(),
        usdtBalance: previousBalance - request.amount.toNumber(),
        metadata: { requestId: id, userId: request.userId, amount: request.amount.toNumber() },
      },
    });

    // 5. Audit log
    await tx.adminAuditLog.create({
      data: {
        adminUserId: adminUser.id,
        action: "override_commission",
        targetType: "referral_withdrawal",
        targetId: id,
        oldValueJson: { status: "pending", amount: request.amount.toNumber() } as any,
        newValueJson: { status: "approved", usdtCredited: request.amount.toNumber() } as any,
        ipAddress: c.req.header("x-forwarded-for") || "unknown",
      },
    });
  });

  return c.json({ success: true, data: { message: "Withdrawal approved and USDT credited" } });
});

/**
 * POST /admin/referral-withdrawals/:id/reject
 * Reject a pending withdrawal request → refund Reward Token to referrer.
 */
admin.post("/referral-withdrawals/:id/reject", async (c) => {
  const id = c.req.param("id");
  const adminUser = c.get("user");
  const { notes } = await c.req.json().catch(() => ({}));

  const request = await prisma.referralWithdrawRequest.findUnique({
    where: { id },
    include: { wallet: { include: { user: true } } },
  });

  if (!request) return c.json({ success: false, error: "Request not found" }, 404);
  if (request.status !== "pending") {
    return c.json({ success: false, error: `Request already ${request.status}` }, 400);
  }

  const wallet = request.wallet;
  if (!wallet) return c.json({ success: false, error: "Referrer wallet not found" }, 404);

  await prisma.$transaction(async (tx) => {
    // 1. Refund Reward Token
    await tx.wallet.update({
      where: { id: wallet.id },
      data: { referralTokenBalance: { increment: request.amount.toNumber() } },
    });

    // 2. Mark request rejected
    await tx.referralWithdrawRequest.update({
      where: { id },
      data: {
        status: "rejected",
        processedAt: new Date(),
        processedBy: adminUser.id,
        notes: notes || undefined,
      },
    });

    // 3. Audit log
    await tx.adminAuditLog.create({
      data: {
        adminUserId: adminUser.id,
        action: "override_commission",
        targetType: "referral_withdrawal",
        targetId: id,
        oldValueJson: { status: "pending", amount: request.amount.toNumber() } as any,
        newValueJson: { status: "rejected", notes } as any,
        ipAddress: c.req.header("x-forwarded-for") || "unknown",
      },
    });
  });

  return c.json({ success: true, data: { message: "Withdrawal rejected and Reward Token refunded" } });
});

/**
 * GET /admin/company-stats
 * Company financial overview: deposits received, referral payouts, net balance.
 */
admin.get("/company-stats", async (c) => {
  const depositAgg = await prisma.systemLedger.aggregate({
    where: { type: "deposit_received" },
    _sum: { amount: true },
  });
  const payoutAgg = await prisma.systemLedger.aggregate({
    where: { type: "referral_paid" },
    _sum: { amount: true },
  });
  const pendingAgg = await prisma.referralWithdrawRequest.aggregate({
    where: { status: "pending" },
    _sum: { amount: true },
  });

  const lastLedger = await prisma.systemLedger.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return c.json({
    success: true,
    data: {
      totalDepositsReceived: depositAgg._sum.amount || 0,
      totalReferralPayouts: payoutAgg._sum.amount || 0,
      pendingWithdrawalAmount: pendingAgg._sum.amount || 0,
      companyUsdtBalance: lastLedger?.usdtBalance || 0,
    },
  });
});

export default admin;
