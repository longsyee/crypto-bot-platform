import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  GLOBAL_FEE_RATE: z.coerce.number().min(0).max(1).default(0.2),
  WALLET_MASTER_KEY: z.string().length(64),
});

export const config = envSchema.parse(process.env);
