import { Hono } from "hono";
import { prisma } from "@crypto-bot-platform/prisma";
import { recalculateReferralTier } from "../services/referral-tier";

const internal = new Hono();

/**
 * POST /internal/deposit-confirmed
 * Callback from the wallet service when a BSC deposit reaches required confirmations.
 */
internal.post("/deposit-confirmed", async (c) => {
  const { userId, amount, txHash, confirmations } = await c.req.json();

  if (!userId || !amount || !txHash) {
    return c.json({ success: false, error: "Missing required fields" }, 400);
  }

  // Idempotency: skip if this txHash already processed
  const existingTx = await prisma.transaction.findFirst({
    where: { txHash, type: "deposit" },
  });
  if (existingTx) {
    return c.json({ success: true, data: { alreadyProcessed: true } });
  }

  const depositAmount = Number(amount);

  await prisma.$transaction(async (tx) => {
    // 1. Credit user wallet
    const wallet = await tx.wallet.update({
      where: { userId },
      data: {
        usdtBalance: { increment: depositAmount },
        totalDeposited: { increment: depositAmount },
      },
    });

    // 2. Record deposit transaction
    const depositTransaction = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "deposit",
        amount: depositAmount,
        currency: "USDT",
        status: "confirmed",
        txHash,
        metadataJson: { confirmations, source: "bsc_wallet_service" },
      },
    });

    // 3. Record in system ledger (company income)
    const lastLedger = await tx.systemLedger.findFirst({
      orderBy: { createdAt: "desc" },
    });
    const previousBalance = lastLedger ? Number(lastLedger.usdtBalance) : 0;
    await tx.systemLedger.create({
      data: {
        type: "deposit_received",
        amount: depositAmount,
        usdtBalance: previousBalance + depositAmount,
        metadata: { userId, txHash, depositAmount: amount },
      },
    });

    // 4. Check for referrer and pay commission as Reward Token (Token B)
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { referrer: { include: { wallet: true } } },
    });

    if (user?.referredBy && user.referrer?.wallet) {
      const referrer = user.referrer;

      // Recalculate tier based on active referrals count
      await recalculateReferralTier(referrer.id);

      const referral = await tx.referral.findUnique({
        where: { referredUserId: userId },
      });

      if (referral) {
        const rate = Number(referral.commissionRate);
        const commission = depositAmount * rate;

        // Credit referrer's Reward Token balance
        await tx.wallet.update({
          where: { userId: referrer.id },
          data: {
            referralTokenBalance: {
              increment: commission,
            },
            totalEarnedReferral: {
              increment: commission,
            },
          },
        });

        // Record Token B payout transaction
        const payoutTx = await tx.transaction.create({
          data: {
            walletId: user.referrer.wallet.id,
            type: "referral_payout_tokenb",
            amount: commission,
            currency: "TOKEN",
            status: "confirmed",
            metadataJson: {
              referredUserId: userId,
              depositAmount: amount,
              commissionRate: rate,
              tier: referral.tier,
            },
          },
        });

        // Commission ledger entry
        await tx.commissionLedger.create({
          data: {
            referralId: referral.id,
            transactionId: payoutTx.id,
            sourceUserId: userId,
            commissionAmount: commission,
            status: "paid",
          },
        });
      }
    }
  });

  return c.json({ success: true, data: { credited: amount, txHash } });
});

export default internal;
