import { createMiddleware } from "hono/factory";
import { verifyAccessToken } from "../services/jwt";
import { prisma } from "@crypto-bot-platform/prisma";

export const authMiddleware = createMiddleware(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ success: false, error: "Unauthorized", code: "NO_TOKEN" }, 401);
  }
  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user) {
      return c.json({ success: false, error: "User not found", code: "USER_GONE" }, 401);
    }
    c.set("user", user);
    await next();
  } catch {
    return c.json({ success: false, error: "Invalid or expired token", code: "INVALID_TOKEN" }, 401);
  }
});
