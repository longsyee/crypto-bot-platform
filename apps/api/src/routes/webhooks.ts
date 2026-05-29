import { Hono } from "hono";
import { createHmac } from "crypto";
import { prisma } from "@crypto-bot-platform/prisma";
import { botQueue } from "../queues/bullmq";
import { config } from "../config";

const webhooks = new Hono();

webhooks.post("/signal/:botId", async (c) => {
  const botId = c.req.param("botId");
  const signature = c.req.header("x-signature");
  const body = await c.req.json();

  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot || bot.status !== "running") {
    return c.json({ success: false, error: "Bot not found or not running" }, 404);
  }

  const botConfig = bot.config as any;
  const secret = botConfig.webhook_secret;
  if (secret) {
    const expected = createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
    if (signature !== expected) {
      await prisma.securityEvent.create({
        data: { eventType: "failed_webhook", ipAddress: c.req.header("x-forwarded-for"), details: { botId } },
      });
      return c.json({ success: false, error: "Invalid signature" }, 401);
    }
  }

  // Check live mode token balance
  if (bot.mode === "live") {
    const wallet = await prisma.wallet.findUnique({ where: { userId: bot.userId } });
    if (!wallet || wallet.tokenBalance.lessThanOrEqualTo(0)) {
      return c.json({ success: false, error: "Insufficient token balance", code: "NO_FUNDS" }, 400);
    }
  }

  await botQueue.add("signal-execute", {
    botId,
    userId: bot.userId,
    payload: body,
    mode: bot.mode,
  });

  return c.json({ success: true, data: { queued: true } });
});

export default webhooks;
