import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { roleMiddleware } from "../middleware/role";
import { prisma } from "@crypto-bot-platform/prisma";
import { CreateBotSchema, DcaBotConfigSchema, logState, logOrder } from "@crypto-bot-platform/shared";
import { zValidator } from "@hono/zod-validator";
import { Queue } from "bullmq";
import { config } from "../config";
import { fetchTicker } from "../services/ccxt-markets";

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

bots.post("/", authMiddleware, zValidator("json", CreateBotSchema), async (c) => {
  const user = c.get("user");
  const body = c.req.valid("json");

  const config = body.config;
  const bot = await prisma.bot.create({
    data: {
      userId: user.id,
      connectionId: body.connectionId,
      name: body.name,
      type: config.type,
      status: "stopped",
      mode: body.mode || "paper",
      configJson: config as any,
      leverage: config.type === "dca" ? (config.leverage ?? 1) : 1,
      leverageType: config.type === "dca" ? (config.leverage_type ?? "cross") : "cross",
      maxSafetyOrdersActive: config.type === "dca" ? (config.max_safety_orders_active ?? 3) : 3,
      tradingPair: body.tradingPair || undefined,
      paperInitialBalance: body.mode === "paper" ? body.paperInitialBalance : undefined,
    },
  });

  logState({
    botId: bot.id,
    userId: user.id,
    message: `Bot "${bot.name}" created in ${bot.mode} mode`,
    metadata: { type: bot.type, tradingPair: body.tradingPair, config },
  });

  return c.json({ success: true, data: bot }, 201);
});

bots.get("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const bot = await prisma.bot.findFirst({
    where: { id, userId: user.id },
    include: { connection: { select: { id: true, name: true, exchangeId: true } } },
  });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  return c.json({ success: true, data: bot });
});

bots.get("/:id/orders", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const bot = await prisma.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  const data = await prisma.botOrder.findMany({
    where: { botId: id },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ success: true, data });
});

bots.get("/:id/logs", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const bot = await prisma.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);

  const category = c.req.query("category");
  const level = c.req.query("level");
  const limit = Number(c.req.query("limit") ?? "200");

  const where: any = { botId: id };
  if (category) where.category = category;
  if (level) where.level = level;

  const data = await prisma.botLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 500),
  });
  return c.json({ success: true, data });
});

bots.patch("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const bot = await prisma.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  const update: any = {};
  if (body.name !== undefined) update.name = body.name;
  if (body.configJson !== undefined) {
    // Validate DCA config if applicable
    if (bot.type === "dca") {
      const parsed = DcaBotConfigSchema.safeParse(body.configJson);
      if (!parsed.success) {
        return c.json({ success: false, error: "Invalid DCA config", details: parsed.error.flatten() }, 400);
      }
      update.configJson = parsed.data;
    } else {
      update.configJson = body.configJson;
    }
  }
  const updated = await prisma.bot.update({ where: { id }, data: update });
  return c.json({ success: true, data: updated });
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

  logState({
    botId: bot.id,
    userId: user.id,
    message: `Bot started in ${bot.mode} mode`,
    metadata: { action: "start", mode: bot.mode },
  });

  return c.json({ success: true, data: { status: "running" } });
});

bots.post("/:id/stop", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const bot = await prisma.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  await prisma.bot.update({ where: { id }, data: { status: "stopped" } });
  await botQueue.add("bot-stop", { botId: bot.id, userId: user.id });

  logState({
    botId: bot.id,
    userId: user.id,
    message: `Bot stopped by user`,
    metadata: { action: "stop" },
  });

  return c.json({ success: true, data: { status: "stopped" } });
});

bots.post("/:id/exit", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const bot = await prisma.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  if (bot.status !== "running") {
    return c.json({ success: false, error: "Bot must be running to exit", code: "BOT_STOPPED" }, 400);
  }
  await botQueue.add("dca-exit", { botId: bot.id, userId: user.id });
  logState({
    botId: bot.id,
    userId: user.id,
    message: "Emergency exit requested by user",
    metadata: { action: "exit" },
  });
  return c.json({ success: true, data: { message: "Emergency exit command sent to worker" } });
});

bots.post("/:id/sync", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const bot = await prisma.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  if (bot.status !== "running") {
    return c.json({ success: false, error: "Bot must be running to sync", code: "BOT_STOPPED" }, 400);
  }
  if (bot.type !== "dca") {
    return c.json({ success: false, error: "Only DCA bots support manual sync", code: "NOT_DCA" }, 400);
  }
  await botQueue.add("dca-sync", { botId: bot.id, userId: user.id });
  logState({
    botId: bot.id,
    userId: user.id,
    message: "Manual position sync requested",
    metadata: { action: "sync" },
  });
  return c.json({ success: true, data: { message: "Sync command sent to worker" } });
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

  logState({
    botId: bot.id,
    userId: user.id,
    message: `Bot mode changed to ${mode}`,
    metadata: { action: "mode_change", previousMode: bot.mode, newMode: mode },
  });

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

bots.delete("/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const bot = await prisma.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  await prisma.bot.delete({ where: { id } });
  return c.json({ success: true });
});

bots.get("/:id/paper-trades", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const bot = await prisma.bot.findFirst({ where: { id, userId: user.id } });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  const data = await prisma.paperTrade.findMany({
    where: { botId: id },
    orderBy: { createdAt: "desc" },
  });
  return c.json({ success: true, data });
});

bots.get("/:id/price", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const bot = await prisma.bot.findFirst({
    where: { id, userId: user.id },
    include: { connection: { select: { id: true, exchangeId: true } } },
  });
  if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  if (!bot.tradingPair) return c.json({ success: false, error: "No trading pair set" }, 400);
  if (!bot.connection) return c.json({ success: false, error: "No exchange connection" }, 400);

  try {
    const ticker = await fetchTicker(bot.connection.id, bot.tradingPair);
    return c.json({ success: true, data: ticker });
  } catch (err: any) {
    return c.json({ success: false, error: err.message || "Failed to fetch ticker" }, 500);
  }
});

// Admin: emergency stop
bots.post("/:id/emergency-stop", authMiddleware, roleMiddleware("admin"), async (c) => {
  const id = c.req.param("id");
  const bot = await prisma.bot.findUnique({ where: { id } });
  await prisma.bot.update({ where: { id }, data: { status: "stopped" } });
  await botQueue.add("bot-stop", { botId: id, emergency: true });

  logState({
    botId: id,
    userId: bot?.userId,
    level: "error",
    message: "Bot emergency stopped by admin",
    metadata: { action: "emergency_stop", adminId: c.get("user")?.id },
  });

  return c.json({ success: true, data: { status: "stopped" } });
});

export default bots;
