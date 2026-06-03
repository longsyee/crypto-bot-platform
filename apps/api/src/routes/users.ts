import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import { requireAuth } from "../middleware/require-auth";
import { roleMiddleware } from "../middleware/role";
import { prisma } from "@crypto-bot-platform/prisma";

const users = new Hono();

users.get("/me", requireAuth, async (c) => {
  const user = c.get("user");
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { wallet: true },
  });
  return c.json({ success: true, data: fullUser });
});

users.get("/", authMiddleware, roleMiddleware("admin"), async (c) => {
  const page = parseInt(c.req.query("page") || "1");
  const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
  const role = c.req.query("role");
  const search = c.req.query("search");

  const where: any = {};
  if (role) where.role = role;
  if (search) where.email = { contains: search, mode: "insensitive" };

  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.user.count({ where }),
  ]);

  return c.json({ success: true, data, meta: { page, limit, total } });
});

users.patch("/:id/role", authMiddleware, roleMiddleware("admin"), async (c) => {
  const id = c.req.param("id");
  const { role } = await c.req.json();
  const user = await prisma.user.update({ where: { id }, data: { role } });
  return c.json({ success: true, data: user });
});

users.patch("/:id", authMiddleware, roleMiddleware("admin"), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const data: any = {};
  if (typeof body.showcasePaperTrades === "boolean") data.showcasePaperTrades = body.showcasePaperTrades;
  if (typeof body.suspended === "boolean") data.suspended = body.suspended;

  const user = await prisma.user.update({ where: { id }, data });
  return c.json({ success: true, data: user });
});

export default users;
