import { Hono } from "hono";
import { requireAuth } from "../middleware/require-auth";
import { rateLimitMiddleware } from "../middleware/rate-limit";
import { prisma } from "@crypto-bot-platform/prisma";

const logs = new Hono();

// Track concurrent SSE log streams per user (max 3)
const streamCounts = new Map<string, number>();

/* ---------- Proxy: GET /logs/activity?botId=xxx&category=xxx ---------- */
logs.get("/activity", requireAuth, async (c) => {
  const user = c.get("user");
  const botId = c.req.query("botId");
  const category = c.req.query("category");
  const level = c.req.query("level");
  const limit = Math.min(Number(c.req.query("limit") ?? "100"), 500);
  const offset = Number(c.req.query("offset") ?? "0");

  const where: any = { userId: user.id };
  if (botId) {
    // Verify ownership before filtering by botId
    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: user.id },
      select: { id: true },
    });
    if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
    where.botId = botId;
  }
  if (category) where.category = category;
  if (level) where.level = level;

  const [data, total] = await Promise.all([
    prisma.botLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: { bot: { select: { name: true, type: true } } },
    }),
    prisma.botLog.count({ where }),
  ]);

  return c.json({ success: true, data, meta: { total, limit, offset } });
});

/* ---------- SSE Stream: GET /logs/stream?botId=xxx ---------- */
logs.get("/stream", requireAuth, rateLimitMiddleware(10, 60, "log_stream"), async (c) => {
  const user = c.get("user");
  const botId = c.req.query("botId");
  const category = c.req.query("category");

  if (botId) {
    const bot = await prisma.bot.findFirst({
      where: { id: botId, userId: user.id },
      select: { id: true },
    });
    if (!bot) return c.json({ success: false, error: "Bot not found" }, 404);
  }

  // Max 3 concurrent streams per user
  const currentCount = streamCounts.get(user.id) ?? 0;
  if (currentCount >= 3) {
    return c.json({ success: false, error: "Too many concurrent log streams", code: "STREAM_LIMIT" }, 429);
  }
  streamCounts.set(user.id, currentCount + 1);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: connected\ndata: {"ok":true}\n\n`));

      let lastSeen = new Date().toISOString();
      let closed = false;

      const tick = setInterval(async () => {
        if (closed) {
          clearInterval(tick);
          return;
        }
        try {
          const where: any = {
            userId: user.id,
            createdAt: { gt: new Date(lastSeen) },
          };
          if (botId) where.botId = botId;
          if (category) where.category = category;

          const rows = await prisma.botLog.findMany({
            where,
            orderBy: { createdAt: "asc" },
            take: 50,
            include: { bot: { select: { name: true, type: true } } },
          });

          if (rows.length > 0) {
            lastSeen = rows[rows.length - 1].createdAt.toISOString();
            for (const row of rows) {
              const payload = JSON.stringify({
                id: row.id,
                botId: row.botId,
                botName: (row as any).bot?.name,
                botType: (row as any).bot?.type,
                level: row.level,
                category: row.category,
                source: row.source,
                message: row.message,
                metadata: row.metadataJson,
                createdAt: row.createdAt,
              });
              controller.enqueue(encoder.encode(`event: log\ndata: ${payload}\n\n`));
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`)
          );
        }
      }, 5000);

      c.req.raw.signal?.addEventListener("abort", () => {
        closed = true;
        clearInterval(tick);
        controller.close();
        const count = streamCounts.get(user.id) ?? 1;
        if (count <= 1) streamCounts.delete(user.id);
        else streamCounts.set(user.id, count - 1);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

export default logs;
