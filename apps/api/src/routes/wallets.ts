import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { requireAuth } from "../middleware/require-auth";
import { prisma } from "@crypto-bot-platform/prisma";
import { config } from "../config";

const wallets = new Hono();

wallets.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  return c.json({ success: true, data: wallet });
});

wallets.post("/convert", requireAuth, async (c) => {
  const user = c.get("user");
  const { amount } = await c.req.json();
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return c.json({ success: false, error: "Wallet not found" }, 404);

  if (wallet.usdtBalance.lessThan(amount)) {
    return c.json({ success: false, error: "Insufficient USDT balance" }, 400);
  }

  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId: user.id },
      data: { usdtBalance: { decrement: amount }, tokenBalance: { increment: amount } },
    }),
    prisma.transaction.create({
      data: { walletId: wallet.id, type: "convert_out", amount, currency: "USDT", status: "confirmed" },
    }),
    prisma.transaction.create({
      data: { walletId: wallet.id, type: "convert_in", amount, currency: "TOKEN", status: "confirmed" },
    }),
  ]);

  const updated = await prisma.wallet.findUnique({ where: { userId: user.id } });
  return c.json({ success: true, data: updated });
});

wallets.post("/generate-address", requireAuth, async (c) => {
  const user = c.get("user");

  // Call wallet service to generate a real BSC deposit address
  const walletServiceUrl = config.WALLET_SERVICE_URL;
  const res = await fetch(`${walletServiceUrl}/internal/generate-address`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: user.id }),
  });

  const json = await res.json();
  if (!json.success) {
    return c.json({ success: false, error: json.error || "Wallet service failed to generate address" }, 502);
  }

  const address: string = json.data.address;
  const index: number = json.data.addressIndex ?? 0;

  // Update API's Prisma wallet record with the new address
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) {
    return c.json({ success: false, error: "Wallet not found" }, 404);
  }

  const updated = await prisma.wallet.update({
    where: { userId: user.id },
    data: { bscAddress: address, bscAddressIndex: index },
  });

  return c.json({ success: true, data: updated });
});

wallets.get("/transactions", requireAuth, async (c) => {
  const user = c.get("user");
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return c.json({ success: false, error: "Wallet not found" }, 404);

  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where: { walletId: wallet.id },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
    prisma.transaction.count({ where: { walletId: wallet.id } }),
  ]);

  return c.json({ success: true, data, meta: { page, limit, total } });
});

wallets.post("/topup-paper", requireAuth, async (c) => {
  const user = c.get("user");
  const { usdtAmount } = await c.req.json();
  if (!usdtAmount || usdtAmount <= 0) {
    return c.json({ success: false, error: "Invalid amount" }, 400);
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
  if (!wallet) return c.json({ success: false, error: "Wallet not found" }, 404);
  if (wallet.usdtBalance.lessThan(usdtAmount)) {
    return c.json({ success: false, error: "Insufficient USDT balance" }, 400);
  }

  // Read rate from global settings (default 100 SimFunds per 1 USDT)
  const rateSetting = await prisma.globalSetting.findUnique({ where: { key: "paper_mock_rate_usdt" } });
  const rate = rateSetting ? parseFloat(rateSetting.value) : 100;
  const simFunds = usdtAmount * rate;

  await prisma.$transaction([
    prisma.wallet.update({
      where: { userId: user.id },
      data: {
        usdtBalance: { decrement: usdtAmount },
        simFundsBalance: { increment: simFunds },
      },
    }),
    prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: "paper_topup",
        amount: usdtAmount,
        currency: "USDT",
        status: "confirmed",
        metadataJson: { simFundsReceived: simFunds, rate } as any,
      },
    }),
    prisma.transaction.create({
      data: {
        walletId: wallet.id,
        type: "paper_topup",
        amount: simFunds,
        currency: "USDT",
        status: "confirmed",
        metadataJson: { type: "sim_funds_credit", rate } as any,
      },
    }),
  ]);

  const updated = await prisma.wallet.findUnique({ where: { userId: user.id } });
  return c.json({ success: true, data: { simFundsBalance: updated?.simFundsBalance, rate } });
});

wallets.get("/config", requireAuth, async (c) => {
  const settings = await prisma.globalSetting.findMany({
    where: {
      key: {
        in: [
          "live_profit_fee_pct",
          "paper_mock_rate_usdt",
          "paper_free_mock_usdt",
          "max_paper_bots_per_user",
          "paper_daily_signal_limit",
        ],
      },
    },
  });
  const map = Object.fromEntries(settings.map((s) => [s.key, s.value]));
  return c.json({ success: true, data: map });
});

export default wallets;
