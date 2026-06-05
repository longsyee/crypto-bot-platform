import { z } from "zod";

const envSchema = z.object({
  BSC_RPC_URL: z.string().url(),
  BSCSCAN_API_KEY: z.string().min(1),
  HOT_WALLET_PRIVATE_KEY: z.string().length(64),
  SWEEP_MIN_THRESHOLD: z.coerce.number().positive().default(2.0),
  API_CALLBACK_URL: z.string().url(),
  INTERNAL_API_SECRET: z.string().default(""),
  WALLET_PORT: z.coerce.number().default(3011),
});

export const walletConfig = envSchema.parse(process.env);
