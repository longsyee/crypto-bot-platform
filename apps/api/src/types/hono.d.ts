import "hono";
import type { User, ApiKey } from "@prisma/client";

declare module "hono" {
  interface ContextVariableMap {
    user: User;
    apiKey?: ApiKey;
    apiKeyPermissions?: string[];
  }
}
