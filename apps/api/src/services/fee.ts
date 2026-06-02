import { Prisma } from "@prisma/client";
import { config } from "../config";

export function calculateFee(pnl: Prisma.Decimal): Prisma.Decimal {
  if (pnl.lessThanOrEqualTo(0)) return new Prisma.Decimal(0);
  return pnl.mul(config.GLOBAL_FEE_RATE);
}

export function calculateCommission(fee: Prisma.Decimal, commissionRate: number): Prisma.Decimal {
  return fee.mul(commissionRate);
}
