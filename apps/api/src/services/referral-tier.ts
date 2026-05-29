import { prisma } from "@crypto-bot-platform/prisma";
import { getTierByActiveCount } from "@crypto-bot-platform/shared";

export async function recalculateReferralTier(referrerId: string): Promise<void> {
  const activeCount = await prisma.transaction.count({
    where: {
      wallet: { user: { referredBy: referrerId } },
      type: "deposit",
      status: "confirmed",
    },
    distinct: ["walletId"],
  });

  const referrals = await prisma.referral.findMany({
    where: { referrerId },
  });

  for (const ref of referrals) {
    const newTier = getTierByActiveCount(activeCount);
    let targetRate = newTier.commissionRate;
    let targetTier = newTier.name;

    if (newTier.name === "kol" && ref.tier !== "kol") {
      targetTier = "pending_kol";
      targetRate = 0.28; // hold at platinum until admin approves
    }

    if (ref.tier !== targetTier || ref.commissionRate.toNumber() !== targetRate) {
      await prisma.referral.update({
        where: { id: ref.id },
        data: { tier: targetTier, commissionRate: targetRate },
      });
    }
  }
}
