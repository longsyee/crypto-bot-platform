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
    where: { wallet: { userId: user.id }, type: "referral_payout" },
    _sum: { amount: true },
  });
  return c.json({
    success: true,
    data: {
      myReferrer: ref,
      myReferrals,
      totalEarnings: earnings._sum.amount || 0,
      referralCode: user.referralCode,
    },
  });
});

export default referrals;
