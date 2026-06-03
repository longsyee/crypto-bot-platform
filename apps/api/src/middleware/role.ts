import { createMiddleware } from "hono/factory";
import type { UserRole } from "@crypto-bot-platform/shared";

export function roleMiddleware(requiredRole: UserRole | UserRole[]) {
  const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
  return createMiddleware(async (c, next) => {
    const user = c.get("user");
    const apiKey = c.get("apiKey");
    if (!user) {
      return c.json({ success: false, error: "Unauthorized", code: "NO_USER" }, 401);
    }
    // Block API keys from admin routes entirely for safety
    if (apiKey) {
      return c.json({ success: false, error: "API keys cannot access admin routes", code: "API_KEY_ADMIN_BLOCKED" }, 403);
    }
    if (!roles.includes(user.role as UserRole)) {
      return c.json({ success: false, error: "Forbidden", code: "INSUFFICIENT_ROLE" }, 403);
    }
    await next();
  });
}
