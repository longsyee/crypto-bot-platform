import { prisma } from "@crypto-bot-platform/prisma";
import { Prisma } from "@prisma/client";
import { config } from "../config";

export async function applyTradeFee(
  botId: string,
  userId: string,
  pnl: Prisma.Decimal
): Promise<void> {
  if (pnl.lessThanOrEqualTo(0)) return;

  const fee = pnl.mul(config.GLOBAL_FEE_RATE);

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.tokenBalance.lessThan(fee)) {
      throw new Error("Insufficient token balance for fee");
    }

    const feeTx = await tx.transaction.create({
      data: {
        walletId: wallet.id,
        type: "trade_fee",
        amount: fee,
        currency: "TOKEN",
        status: "confirmed",
      },
    });

    await tx.wallet.update({
      where: { userId },
      data: {
        tokenBalance: { decrement: fee },
        totalFeesPaid: { increment: fee },
      },
    });

    await tx.botLog.create({
      data: { botId, level: "info", message: `Fee applied: ${fee.toFixed(8)}` },
    });
  });
}
