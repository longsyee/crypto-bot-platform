import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "@crypto-bot-platform/prisma";
import { config } from "../config.js";

const ingestSchema = z.object({
  botId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  level: z.enum(["info", "warn", "error"]).default("info"),
  category: z.enum(["order", "signal", "state", "system", "trade", "fee", "alert"]).default("system"),
  source: z.enum(["worker", "api", "webhook", "user", "system"]).default("system"),
  message: z.string().min(1).max(2000),
  metadata: z.record(z.any()).optional(),
});

const querySchema = z.object({
  botId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  category: z.enum(["order", "signal", "state", "system", "trade", "fee", "alert"]).optional(),
  level: z.enum(["info", "warn", "error"]).optional(),
  source: z.enum(["worker", "api", "webhook", "user", "system"]).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const logs = new Hono();

/* ---------- Auth middleware (internal API key) ---------- */
const internalAuth = async (c: any, next: any) => {
  const key = c.req.header("x-log-api-key");
  if (key !== config.LOG_SERVER_API_KEY) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  await next();
};

/* ---------- Ingest ---------- */
logs.post("/logs", internalAuth, async (c) => {
  const raw = await c.req.json();
  const parsed = ingestSchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.errors[0]?.message ?? "Invalid body" }, 400);
  }
  const body = parsed.data;

  const botExists = await prisma.bot.findUnique({ where: { id: body.botId }, select: { id: true } });
  if (!botExists) {
    return c.json({ success: false, error: "Bot not found", code: "BOT_NOT_FOUND" }, 404);
  }

  const log = await prisma.botLog.create({
    data: {
      botId: body.botId,
      userId: body.userId,
      level: body.level,
      category: body.category as any,
      source: body.source as any,
      message: body.message,
      metadataJson: body.metadata as any,
    },
  });

  return c.json({ success: true, data: log }, 201);
});

/* ---------- Batch ingest ---------- */
logs.post("/logs/batch", internalAuth, async (c) => {
  const body = await c.req.json();
  if (!Array.isArray(body) || body.length === 0) {
    return c.json({ success: false, error: "Expected non-empty array" }, 400);
  }
  if (body.length > 100) {
    return c.json({ success: false, error: "Batch limit is 100" }, 400);
  }

  const botIds = [...new Set(body.map((item: any) => item.botId).filter(Boolean))];
  const existingBots = await prisma.bot.findMany({
    where: { id: { in: botIds } },
    select: { id: true },
  });
  const validBotIds = new Set(existingBots.map((b) => b.id));

  const validEntries = body.filter((item: any) => validBotIds.has(item.botId));
  const skipped = body.length - validEntries.length;

  if (validEntries.length === 0) {
    return c.json({ success: false, error: "No valid bot IDs in batch", code: "BOTS_NOT_FOUND", skipped }, 404);
  }

  const created = await prisma.botLog.createMany({
    data: validEntries.map((item: any) => ({
      botId: item.botId,
      userId: item.userId,
      level: item.level ?? "info",
      category: (item.category ?? "system") as any,
      source: (item.source ?? "system") as any,
      message: item.message,
      metadataJson: item.metadata as any,
    })),
    skipDuplicates: false,
  });

  return c.json({ success: true, data: { inserted: created.count, skipped } }, 201);
});

/* ---------- Query ---------- */
logs.get("/logs", internalAuth, async (c) => {
  const raw: any = {};
  const qp = c.req.query.bind(c.req);
  if (qp("botId")) raw.botId = qp("botId");
  if (qp("userId")) raw.userId = qp("userId");
  if (qp("category")) raw.category = qp("category");
  if (qp("level")) raw.level = qp("level");
  if (qp("source")) raw.source = qp("source");
  if (qp("from")) raw.from = qp("from");
  if (qp("to")) raw.to = qp("to");
  if (qp("limit")) raw.limit = qp("limit");
  if (qp("offset")) raw.offset = qp("offset");

  const parsed = querySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.errors[0]?.message ?? "Invalid query" }, 400);
  }
  const q = parsed.data;

  const where: any = {};
  if (q.botId) where.botId = q.botId;
  if (q.userId) where.userId = q.userId;
  if (q.category) where.category = q.category;
  if (q.level) where.level = q.level;
  if (q.source) where.source = q.source;
  if (q.from || q.to) {
    where.createdAt = {};
    if (q.from) where.createdAt.gte = q.from;
    if (q.to) where.createdAt.lte = q.to;
  }

  const [data, total] = await Promise.all([
    prisma.botLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: q.limit,
      skip: q.offset,
    }),
    prisma.botLog.count({ where }),
  ]);

  return c.json({ success: true, data, meta: { total, limit: q.limit, offset: q.offset } });
});

/* ---------- SSE Stream ---------- */
logs.get("/logs/stream", internalAuth, async (c) => {
  const botId = c.req.query("botId");
  const userId = c.req.query("userId");
  const lastId = c.req.query("lastId");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: connected\ndata: {"ok":true}\n\n`));

      let lastSeenId = lastId ?? "";
      let closed = false;

      const interval = setInterval(async () => {
        if (closed) {
          clearInterval(interval);
          return;
        }
        try {
          const where: any = {};
          if (botId) where.botId = botId;
          if (userId) where.userId = userId;
          if (lastSeenId) {
            where.id = { gt: lastSeenId };
          }

          const rows = await prisma.botLog.findMany({
            where,
            orderBy: { createdAt: "asc" },
            take: 50,
          });

          if (rows.length > 0) {
            lastSeenId = rows[rows.length - 1].id;
            for (const row of rows) {
              const payload = JSON.stringify({
                id: row.id,
                botId: row.botId,
                userId: row.userId,
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
      }, 1000);

      c.req.raw.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        controller.close();
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

/* ---------- Stats ---------- */
logs.get("/logs/stats", internalAuth, async (c) => {
  const botId = c.req.query("botId");
  const userId = c.req.query("userId");
  const hours = Number(c.req.query("hours") ?? "24");
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const where: any = { createdAt: { gte: since } };
  if (botId) where.botId = botId;
  if (userId) where.userId = userId;

  const [byCategory, byLevel, total] = await Promise.all([
    prisma.botLog.groupBy({ by: ["category"], where, _count: { category: true } }),
    prisma.botLog.groupBy({ by: ["level"], where, _count: { level: true } }),
    prisma.botLog.count({ where }),
  ]);

  return c.json({
    success: true,
    data: {
      periodHours: hours,
      total,
      byCategory: byCategory.map((r) => ({ category: r.category, count: r._count.category })),
      byLevel: byLevel.map((r) => ({ level: r.level, count: r._count.level })),
    },
  });
});

export { logs as logRoutes };
