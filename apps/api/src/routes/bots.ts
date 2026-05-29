import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { roleMiddleware } from "../middleware/role";
import { prisma } from "@crypto-bot-platform/prisma";
import { BotConfigSchema } from "@crypto-bot-platform/shared";
import { zValidator } from "@hono/zod-validator";
import { Queue } from "bullmq";
import { config } from "../config";

const botQueue = new Queue("bot", { connection: { url: config.REDIS_URL } });

const bots = new Hono();

bots.get("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const status = c.req.query("status");
  const where: any = { userId: user.id };
  if (status) where.status = status;
  const data = await prisma.bot.findMany({
    where,
    include: { connection: { select: { id: true, name: true, exchangeId: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return c.json({ success: true, data });
});

bots.post("/", authMiddleware, zValidator("json", BotConfigSchema), async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const configParsed = BotConfigSchema.parse(body.config);

  const bot = await prisma.bot.create({
    data: {
      userId: user.id,
      connectionId: body.connectionId,
      name: body.name,
      type: configParsed.type,
      status: "stopped",
      mode: body.mode || "paper",
      config: configParsed as any,
    },
  });
  return c.json({ success: true, data: bot }, 201);
});

bots.post("/:id/start", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const bot = await prisma.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);

  if (bot.mode === "live") {
    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
    if (!wallet || wallet.tokenBalance.lessThanOrEqualTo(0)) {
      return c.json({ success: false, error: "Insufficient token balance to start live bot", code: "NO_FUNDS" }, 400);
    }
  }

  await prisma.bot.update({ where: { id }, data: { status: "running" } });
  await botQueue.add(`${bot.type}-start`, { botId: bot.id, userId: user.id });
  return c.json({ success: true, data: { status: "running" } });
});

bots.post("/:id/stop", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const bot = await prisma.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  await prisma.bot.update({ where: { id }, data: { status: "stopped" } });
  await botQueue.add("bot-stop", { botId: bot.id, userId: user.id });
  return c.json({ success: true, data: { status: "stopped" } });
});

bots.patch("/:id/mode", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const { mode } = await c.req.json();
  const bot = await prisma.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  if (bot.status !== "stopped") {
    return c.json({ success: false, error: "Stop bot before toggling mode", code: "BOT_RUNNING" }, 400);
  }
  await prisma.bot.update({ where: { id }, data: { mode } });
  return c.json({ success: true, data: { mode } });
});

// Admin: list all bots
bots.get("/admin/all", authMiddleware, roleMiddleware("admin"), async (c) => {
  const status = c.req.query("status");
  const where: any = {};
  if (status) where.status = status;
  const data = await prisma.bot.findMany({
    where,
    include: { user: { select: { id: true, email: true } }, connection: { select: { exchangeId: true } } },
    orderBy: { updatedAt: "desc" },
  });
  return c.json({ success: true, data });
});

// Admin: emergency stop
bots.post("/:id/emergency-stop", authMiddleware, roleMiddleware("admin"), async (c) => {
  const id = c.req.param("id");
  await prisma.bot.update({ where: { id }, data: { status: "stopped" } });
  await botQueue.add("bot-stop", { botId: id, emergency: true });
  return c.json({ success: true, data: { status: "stopped" } });
});

export default bots;
