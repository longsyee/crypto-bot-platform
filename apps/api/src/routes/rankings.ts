import { Hono } from "hono";
import { requireAuth } from "../middleware/require-auth";
import { prisma } from "@crypto-bot-platform/prisma";

const rankings = new Hono();

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "daily":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "weekly":
      const day = now.getDay();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    default:
      return new Date(0);
  }
}

function computeTier(score: number): "S" | "A" | "B" | "C" | "D" {
  if (score >= 5000) return "S";
  if (score >= 2000) return "A";
  if (score >= 500) return "B";
  if (score >= 100) return "C";
  return "D";
}

rankings.get("/", requireAuth, async (c) => {
  const period = c.req.query("period") || "overall";
  const periodStart = getPeriodStart(period);
  const limit = Math.min(parseInt(c.req.query("limit") || "50"), 100);

  const users = await prisma.user.findMany({
    where: { role: { not: "admin" } },
    include: {
      wallet: true,
      bots: {
        include: {
          paperTrades: {
            where: period === "overall" ? undefined : { createdAt: { gte: periodStart } },
          },
          botOrders: {
            where: period === "overall" ? undefined : { createdAt: { gte: periodStart } },
          },
        },
      },
    },
  });

  const rows = users.map((user) => {
    let paperPnl = 0;
    let paperTradeCount = 0;
    let winningPaperTrades = 0;

    for (const bot of user.bots) {
      for (const pt of bot.paperTrades) {
        const pnl = Number(pt.pnl);
        paperPnl += pnl;
        paperTradeCount++;
        if (pnl > 0) winningPaperTrades++;
      }
    }

    const liveFeeVolume = Number(user.wallet?.totalFeesPaid || 0);
    const liveOrderCount = user.bots.reduce((sum, b) => sum + b.botOrders.length, 0);

    const effectivePnl = user.showcasePaperTrades ? paperPnl : 0;
    const score = effectivePnl + liveFeeVolume * 10 + liveOrderCount * 5;

    const winRate = paperTradeCount > 0 ? (winningPaperTrades / paperTradeCount) * 100 : 0;

    return {
      userId: user.id,
      email: user.email,
      avatar: user.email.charAt(0).toUpperCase(),
      showcasePaperTrades: user.showcasePaperTrades,
      paperPnl,
      paperTradeCount,
      liveOrderCount,
      liveFeeVolume,
      winRate,
      score,
      tier: computeTier(score),
    };
  });

  rows.sort((a, b) => b.score - a.score);

  const ranked = rows.slice(0, limit).map((r, i) => ({
    rank: i + 1,
    ...r,
  }));

  return c.json({ success: true, data: ranked, meta: { period, limit, total: rows.length } });
});

export default rankings;
