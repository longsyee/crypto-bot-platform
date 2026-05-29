import { Decimal } from "@prisma/client/runtime/library";
import { config } from "../config";

export function calculateFee(pnl: Decimal): Decimal {
  if (pnl.lessThanOrEqualTo(0)) return new Decimal(0);
  return pnl.mul(config.GLOBAL_FEE_RATE);
}

export function calculateCommission(fee: Decimal, commissionRate: number): Decimal {
  return fee.mul(commissionRate);
}
