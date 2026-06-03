import { createMiddleware } from "hono/factory";
import { authMiddleware } from "./auth";
import { apiKeyAuthMiddleware } from "./api-key-auth";

/**
 * Unified auth middleware: tries JWT Bearer first, then falls back to X-API-Key.
 * This lets the same endpoints work for both web sessions (JWT) and programmatic access (API key).
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  // JWT path
  if (authHeader?.startsWith("Bearer ")) {
    return authMiddleware(c, next);
  }

  // API key path
  const apiKey = c.req.header("X-API-Key") || c.req.header("x-api-key");
  if (apiKey) {
    return apiKeyAuthMiddleware(c, next);
  }

  return c.json({ success: false, error: "Unauthorized", code: "NO_TOKEN_OR_KEY" }, 401);
});

/**
 * Require a specific permission when authenticated via API key.
 * JWT sessions bypass permission checks (they have full non-admin access).
 */
export function requirePermission(permission: string) {
  return createMiddleware(async (c, next) => {
    const apiKey = c.get("apiKey");
    if (apiKey) {
      const perms = c.get("apiKeyPermissions") || [];
      if (!perms.includes(permission)) {
        return c.json(
          { success: false, error: `Permission denied: ${permission}`, code: "MISSING_PERMISSION" },
          403
        );
      }
    }
    await next();
  });
}
