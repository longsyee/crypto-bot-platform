import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { prisma } from "@crypto-bot-platform/prisma";

const referrals = new Hono();

referrals.get("/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const ref = await prisma.referral.findUnique({
    where: { referredUserId: user.id },
    include: { referrer: { select: { id: true, email: true } } },
  });
  const myReferrals = await prisma.referral.findMany({
    where: { referrerId: user.id },
    include: { referredUser: { select: { id: true, email: true, createdAt: true } } },
  });
  const earnings = await prisma.transaction.aggregate({
    where: {
      wallet: { userId: user.id },
      type: { in: ["referral_payout", "referral_payout_tokenb"] },
    },
    _sum: { amount: true },
  });
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  return c.json({
    success: true,
    data: {
      myReferrer: ref,
      myReferrals,
      totalEarnings: earnings._sum.amount || 0,
      referralTokenBalance: wallet?.referralTokenBalance || 0,
      referralCode: user.referralCode,
    },
  });
});

/**
 * POST /referrals/withdraw
 * Request withdrawal of Reward Token (Token B) to USDT.
 * Deducts referralTokenBalance immediately and creates a pending request.
 */
referrals.post("/withdraw", authMiddleware, async (c) => {
  const user = c.get("user");
  const { amount } = await c.req.json();
  const reqAmount = Number(amount);

  if (reqAmount <= 0) {
    return c.json({ success: false, error: "Amount must be positive" }, 400);
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return c.json({ success: false, error: "Wallet not found" }, 404);

  if (Number(wallet.referralTokenBalance) < reqAmount) {
    return c.json({ success: false, error: "Insufficient Reward Token balance" }, 400);
  }

  // Deduct immediately to prevent double requests
  await prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { userId: user.id },
      data: { referralTokenBalance: { decrement: reqAmount } },
    });

    await tx.referralWithdrawRequest.create({
      data: {
        userId: user.id,
        amount: reqAmount,
        status: "pending",
      },
    });

    await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "referral_withdraw_request",
        amount: reqAmount,
        currency: "TOKEN",
        status: "confirmed",
        metadataJson: { note: "Reward Token withdrawal request deducted from balance" },
      },
    });
  });

  return c.json({ success: true, data: { message: "Withdrawal request submitted for admin approval" } });
});

/**
 * GET /referrals/withdrawals
 * List the current user's withdrawal requests.
 */
referrals.get("/withdrawals", authMiddleware, async (c) => {
  const user = c.get("user");
  const requests = await prisma.referralWithdrawRequest.findMany({
    where: { userId: user.id },
    orderBy: { requestedAt: "desc" },
  });
  return c.json({ success: true, data: requests });
});

export default referrals;
