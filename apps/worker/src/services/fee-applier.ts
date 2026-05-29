import { prisma } from "@crypto-bot-platform/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { config } from "../config";

export async function applyTradeFee(
  botId: string,
  userId: string,
  pnl: Decimal
): Promise<void> {
  if (pnl.lessThanOrEqualTo(0)) return;

  const fee = pnl.mul(config.GLOBAL_FEE_RATE);
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet || wallet.tokenBalance.lessThan(fee)) {
    throw new Error("Insufficient token balance for fee");
  }

  const feeTx = await prisma.transaction.create({
    data: {
      walletId: wallet.id,
      type: "trade_fee",
      amount: fee,
      currency: "TOKEN",
      status: "confirmed",
    },
  });

  await prisma.wallet.update({
    where: { userId },
    data: {
      tokenBalance: { decrement: fee },
      totalFeesPaid: { increment: fee },
    },
  });

  await prisma.botLog.create({
    data: { botId, level: "info", message: `Fee applied: ${fee.toFixed(8)}` },
  });

  // Commission to referrer
  const referral = await prisma.referral.findUnique({
    where: { referredUserId: userId },
  });
  if (referral && referral.commissionRate.greaterThan(0)) {
    const commission = fee.mul(referral.commissionRate.toNumber());
    const referrerWallet = await prisma.wallet.findUnique({
      where: { userId: referral.referrerId },
    });
    if (referrerWallet) {
      await prisma.wallet.update({
        where: { userId: referral.referrerId },
        data: {
          tokenBalance: { increment: commission },
          totalEarnedReferral: { increment: commission },
        },
      });

      await prisma.transaction.create({
        data: {
          walletId: referrerWallet.id,
          type: "referral_payout",
          amount: commission,
          currency: "TOKEN",
          status: "confirmed",
        },
      });

      await prisma.commissionLedger.create({
        data: {
          referralId: referral.id,
          transactionId: feeTx.id,
          sourceUserId: userId,
          commissionAmount: commission,
          status: "paid",
        },
      });
    }
  }
}
