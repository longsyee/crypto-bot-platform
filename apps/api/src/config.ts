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
  ADMIN_EMAILS: z.string().default(""), // comma-separated emails that auto-get admin role
  FIRST_USER_ADMIN: z.coerce.boolean().default(false), // first registered user becomes admin
  WALLET_SERVICE_URL: z.string().url().default("http://localhost:3011"),
  INTERNAL_API_SECRET: z.string().default(""),
  API_CALLBACK_URL: z.string().url().default("http://localhost:3010/internal/deposit-confirmed"),
  API_PORT: z.coerce.number().default(3010),
  CORS_ORIGINS: z.string().default("http://localhost:5183,http://localhost:4173,http://localhost:4174"),
  SMTP_HOST: z.string().default(""),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().default(""),
  SMTP_PASS: z.string().default(""),
  SMTP_FROM: z.string().default("noreply@botplatform.local"),
});

export const config = envSchema.parse(process.env);
