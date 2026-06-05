import { createMiddleware } from "hono/factory";
import { walletConfig } from "../config";

export const internalAuthMiddleware = createMiddleware(async (c, next) => {
  if (!walletConfig.INTERNAL_API_SECRET) {
    // If no secret is configured, skip auth (dev convenience)
    await next();
    return;
  }
  const secret = c.req.header("X-Internal-Secret");
  if (secret !== walletConfig.INTERNAL_API_SECRET) {
    return c.json({ success: false, error: "Unauthorized" }, 401);
  }
  await next();
});
