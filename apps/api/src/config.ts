import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  WALLET_MASTER_KEY: z.string().length(64), // 32 bytes hex
  GLOBAL_FEE_RATE: z.coerce.number().min(0).max(1).default(0.2),
  MIN_WITHDRAWAL: z.coerce.number().positive().default(5),
  ADMIN_ALLOWED_IPS: z.string().default("127.0.0.1,::1"),
  WALLET_SERVICE_URL: z.string().url().default("http://localhost:3001"),
  API_CALLBACK_URL: z.string().url().default("http://localhost:3000/internal/deposit-confirmed"),
  API_PORT: z.coerce.number().default(3000),
});

export const config = envSchema.parse(process.env);
