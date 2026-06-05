import { z } from "zod";

const envSchema = z.object({
  LOG_SERVER_PORT: z.coerce.number().default(3012),
  LOG_SERVER_API_KEY: z.string().min(1).default("dev-log-key-change-me"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid log-server env:", parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
