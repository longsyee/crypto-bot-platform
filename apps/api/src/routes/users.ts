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

// GET /users/me/avatar — return avatar as base64 data URL
users.get("/me/avatar", requireAuth, async (c) => {
  const user = c.get("user");
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatar: true },
  });
  if (!dbUser?.avatar) {
    return c.json({ success: false, error: "No avatar set" }, 404);
  }
  // Detect MIME type from magic bytes
  const buf = Buffer.from(dbUser.avatar);
  let mime = "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) mime = "image/jpeg";
  else if (buf[0] === 0x47 && buf[1] === 0x49) mime = "image/gif";
  else if (buf[0] === 0x52 && buf[1] === 0x49) mime = "image/webp";
  const base64 = buf.toString("base64");
  return c.json({ success: true, data: `data:${mime};base64,${base64}` });
});

// POST /users/me/avatar — upload avatar (multipart/form-data)
const MAX_AVATAR_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

users.post("/me/avatar", requireAuth, async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody({ all: true });
  const file = body.avatar;

  if (!file || !(file instanceof File)) {
    return c.json({ success: false, error: "No file uploaded" }, 400);
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return c.json({ success: false, error: "Invalid file type. Only JPEG, PNG, GIF, WebP allowed." }, 400);
  }

  if (file.size > MAX_AVATAR_SIZE) {
    return c.json({ success: false, error: "File too large. Max 2 MB allowed." }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  await prisma.user.update({
    where: { id: user.id },
    data: { avatar: buffer },
  });

  return c.json({ success: true, data: { uploaded: true, size: file.size } });
});

// DELETE /users/me/avatar — remove avatar
users.delete("/me/avatar", requireAuth, async (c) => {
  const user = c.get("user");
  await prisma.user.update({
    where: { id: user.id },
    data: { avatar: null },
  });
  return c.json({ success: true });
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
