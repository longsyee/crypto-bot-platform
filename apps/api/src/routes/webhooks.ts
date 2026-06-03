import { Hono } from "hono";
import { createHmac } from "crypto";
import { createMiddleware } from "hono/factory";
import { prisma } from "@crypto-bot-platform/prisma";
import { botQueue } from "../queues/bullmq";
import { logSignal, logAlert } from "@crypto-bot-platform/shared";
import { requireAuth, requirePermission } from "../middleware/require-auth";

const webhooks = new Hono();

/**
 * Hybrid auth for webhooks:
 * - If X-API-Key or Authorization (Bearer) is present → requireAuth + bot ownership check
 * - If x-signature is present → signature verification (TradingView / external)
 * - Otherwise → 401
 *
 * This prevents unauthorized signal spam while keeping external webhook compatibility.
 */
const webhookAuth = createMiddleware(async (c, next) => {
  const signature = c.req.header("x-signature");
  const apiKey = c.req.header("X-API-Key") || c.req.header("x-api-key");
  const authHeader = c.req.header("Authorization");

  // Programmatic access (MCP, scripts, internal)
  if (apiKey || authHeader?.startsWith("Bearer ")) {
    return requireAuth(c, next);
  }

  // External webhook signature mode
  if (signature) {
    return next();
  }

  return c.json(
    { success: false, error: "Unauthorized. Provide an API key, JWT token, or webhook signature.", code: "NO_AUTH" },
    401
  );
});

webhooks.post("/signal/:botId", webhookAuth, requirePermission("signals:write"), async (c) => {
  const botId = c.req.param("botId");
  const signature = c.req.header("x-signature");
  const body = await c.req.json();

  const bot = await prisma.bot.findUnique({ where: { id: botId } });
  if (!bot || bot.status !== "running") {
    return c.json({ success: false, error: "Bot not found or not running" }, 404);
  }

  const user = c.get("user");

  if (user) {
    // ----- Programmatic mode (API key / JWT) -----
    // Verify the caller owns the bot
    if (bot.userId !== user.id) {
      return c.json({ success: false, error: "Forbidden: you do not own this bot", code: "NOT_OWNER" }, 403);
    }
  } else {
    // ----- Signature mode (external webhooks) -----
    const botConfig = bot.configJson as any;
    const secret = botConfig?.webhook_secret;
    if (!secret) {
      return c.json(
        { success: false, error: "Webhook secret not configured for this bot", code: "NO_WEBHOOK_SECRET" },
        400
      );
    }
    const expected = createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
    if (signature !== expected) {
      logAlert({
        botId,
        userId: bot.userId,
        message: "Invalid webhook signature received",
        metadata: { ip: c.req.header("x-forwarded-for") || "unknown" },
      });
      await prisma.securityEvent.create({
        data: {
          eventType: "failed_webhook",
          ipAddress: c.req.header("x-forwarded-for") || "unknown",
          detailsJson: { botId } as any,
        },
      });
      return c.json({ success: false, error: "Invalid signature" }, 401);
    }
  }

  // Check live mode token balance
  if (bot.mode === "live") {
    const wallet = await prisma.wallet.findUnique({ where: { userId: bot.userId } });
    if (!wallet || wallet.tokenBalance.lessThanOrEqualTo(0)) {
      logAlert({
        botId,
        userId: bot.userId,
        message: "Signal blocked: insufficient token balance",
      });
      return c.json({ success: false, error: "Insufficient token balance", code: "NO_FUNDS" }, 400);
    }
  }

  logSignal({
    botId,
    userId: bot.userId,
    message: `Webhook signal queued: ${body.side?.toUpperCase()} ${body.symbol ?? bot.tradingPair ?? ""}`,
    metadata: { ...body, source: user ? "api_key" : "webhook" },
  });

  await botQueue.add("signal-execute", {
    botId,
    userId: bot.userId,
    payload: body,
    mode: bot.mode,
  });

  return c.json({ success: true, data: { queued: true } });
});

export default webhooks;
