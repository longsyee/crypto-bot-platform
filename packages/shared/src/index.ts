import { z } from "zod";

// ============================================================
// Types mirroring Prisma enums so apps don't import @prisma/client
// ============================================================
export type UserRole = "user" | "moderator" | "admin";
export type BotType = "signal" | "dca";
export type BotMode = "paper" | "live";
export type BotStatus = "stopped" | "running" | "paused" | "error";

// ============================================================
// Auth schemas
// ============================================================
export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  referral_code: z.string().optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const VerifyEmailSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6),
});

export const ResendOtpSchema = z.object({
  email: z.string().email(),
});

export const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const TotpCodeSchema = z.object({
  code: z.string().length(6).regex(/^\d{6}$/),
});

export const TotpDisableSchema = z.object({
  password: z.string().min(1),
});

// ============================================================
// Bot config schemas
// ============================================================
export const SignalBotConfigSchema = z.object({
  type: z.literal("signal"),
  default_symbol: z.string().min(1).optional(),
  webhook_secret: z.string().min(16).optional(),
  max_position_size: z.coerce.number().positive().optional(),
  stop_loss_pct: z.coerce.number().min(0).max(100).optional(),
  take_profit_pct: z.coerce.number().min(0).max(1000).optional(),
});

// ------------------------------------------------------------------
// Trailing take-profit tier
// ------------------------------------------------------------------
export const TrailingTierSchema = z.object({
  profit_pct: z.coerce.number().positive(),
  callback_pct: z.coerce.number().positive(),
});

// ------------------------------------------------------------------
// Division / partial exit tier
// ------------------------------------------------------------------
export const DivisionTierSchema = z.object({
  profit_pct: z.coerce.number().positive(),
  sell_pct: z.coerce.number().positive().max(100),
});

export const DcaBotConfigSchema = z.object({
  type: z.literal("dca"),
  default_symbol: z.string().min(1).optional(),

  // Direction: long, short, or both (dual / hedge)
  direction: z.enum(["long", "short", "both"]).default("long"),

  // Leverage (futures)
  leverage: z.coerce.number().int().min(1).max(125).default(1),
  leverage_type: z.enum(["cross", "isolated", "exchange"]).default("cross"),

  // Order sizing
  base_order_size: z.coerce.number().positive(),
  safety_order_size: z.coerce.number().positive(),
  price_deviation_initial: z.coerce.number().positive(),
  safety_order_max_count: z.coerce.number().int().min(1).max(50),
  safety_order_volume_scale: z.coerce.number().positive(),
  safety_order_step_scale: z.coerce.number().positive(),

  // Exit
  take_profit: z.coerce.number().positive(),
  take_profit_mode: z.enum(["fixed", "trailing"]).default("fixed"),
  stop_loss: z.coerce.number().positive().optional(),
  max_position_size: z.coerce.number().positive().optional(),

  // Execution
  max_safety_orders_active: z.coerce.number().int().min(0).max(50).default(3),
  order_type: z.enum(["market", "limit"]).default("market"),
  post_only: z.boolean().default(false),
  preplace_safety_orders: z.boolean().default(false),

  // Indicator-based entry
  indicator_type: z.enum(["none", "rsi", "macd", "ema_cross"]).default("none"),
  indicator_timeframe: z.enum(["5m", "15m", "30m", "1h", "4h", "1d"]).default("1h"),
  rsi_period: z.coerce.number().int().min(2).max(50).default(14),
  rsi_threshold: z.coerce.number().min(1).max(99).default(30),
  ema_short: z.coerce.number().int().min(2).max(50).default(9),
  ema_long: z.coerce.number().int().min(5).max(200).default(21),

  // Indicator-based cover (safety order) confirmation
  cover_indicator_type: z.enum(["none", "rsi", "macd", "ema_cross"]).default("none"),

  // Advanced exits
  trailing_tiers: z.array(TrailingTierSchema).default([
    { profit_pct: 5, callback_pct: 2 },
    { profit_pct: 10, callback_pct: 3 },
    { profit_pct: 20, callback_pct: 5 },
  ]),
  division_setting: z.array(DivisionTierSchema).default([]),
  breakeven_after_safety_orders: z.coerce.number().int().min(0).default(2),

  // Chop-loss (partial stop-loss)
  chop_loss_enabled: z.boolean().default(false),
  chop_loss_pct: z.coerce.number().positive().default(10),
  chop_sell_pct: z.coerce.number().positive().max(100).default(30),
  max_chop_count: z.coerce.number().int().min(0).default(3),

  // Risk management
  waterfall_prevention: z.boolean().default(false),
  waterfall_prevention_ratio: z.coerce.number().positive().default(3),
  max_session_loss_usdt: z.coerce.number().positive().optional(),
  max_drawdown_pct: z.coerce.number().positive().optional(),
  funding_rate_threshold: z.coerce.number().optional(),

  // Extended risk management (new)
  max_daily_loss_usdt: z.coerce.number().positive().optional(),
  max_holding_time_minutes: z.coerce.number().int().min(1).optional(),
  max_consecutive_losses: z.coerce.number().int().min(1).optional(),
  volatility_pause_pct: z.coerce.number().positive().optional(),
  max_account_risk_pct: z.coerce.number().positive().max(100).optional(),
  api_rate_limit_per_minute: z.coerce.number().int().min(1).max(300).default(60),

  // Two-way loss (双向止损) for dual/hedge mode
  two_way_loss_enabled: z.boolean().default(false),

  // Guard mode
  guard_enabled: z.boolean().default(false),
  guard_duration: z.coerce.number().int().min(1).default(2),
  guard_trigger_pct: z.coerce.number().positive().default(3),
  guard_pause_minutes: z.coerce.number().int().min(1).default(480),

  // Advanced rounds
  rounds: z
    .array(
      z.object({
        price_fluctuation_pct: z.number(),
        multiplier: z.number(),
        ema_enabled: z.boolean(),
        macd_enabled: z.boolean(),
      })
    )
    .optional(),

  // Entry signal toggles (match Sample/newRobot)
  macd_signal_enabled: z.boolean().default(false),
  rsi_signal_enabled: z.boolean().default(false),
  rsi_upper: z.coerce.number().int().min(1).max(99).default(70),
  rsi_lower: z.coerce.number().int().min(1).max(99).default(30),
  ema_entry_enabled: z.boolean().default(false),

  // EMA settings
  ema_fast: z.coerce.number().int().min(2).default(9),
  ema_slow: z.coerce.number().int().min(2).default(26),

  // Feature toggles
  double_fo_enabled: z.boolean().default(false),
  trend_dca_enabled: z.boolean().default(false),
  reverse_trend_entry_enabled: z.boolean().default(false),
  trend_following_mode: z.boolean().default(false),
  long_short_ratio: z.coerce.number().int().min(1).max(99).default(50),
});

export const BotConfigSchema = z.discriminatedUnion("type", [
  SignalBotConfigSchema,
  DcaBotConfigSchema,
]);

export const CreateBotSchema = z.object({
  name: z.string().min(1).max(100),
  connectionId: z.string().uuid(),
  mode: z.enum(["paper", "live"]).optional().default("paper"),
  tradingPair: z.string().optional(),
  paperInitialBalance: z.record(z.number()).optional(),
  parentBotId: z.string().uuid().optional(),
  config: BotConfigSchema,
});

// ============================================================
// Exchange helpers
// ============================================================
const SUPPORTED_EXCHANGES = [
  "binance",
  "bybit",
  "okx",
  "gate",
  "kucoin",
  "bitget",
  "mexc",
  "bingx",
  "htx",
  "bitmart",
];

export function isSupportedExchange(id: string): boolean {
  return SUPPORTED_EXCHANGES.includes(id.toLowerCase());
}

// ============================================================
// Referral tier logic
// ============================================================
export interface ReferralTierInfo {
  name: "bronze" | "silver" | "gold" | "platinum" | "pending_kol" | "kol";
  commissionRate: number;
  minReferrals: number;
}

const TIERS: ReferralTierInfo[] = [
  { name: "bronze", commissionRate: 0.05, minReferrals: 0 },
  { name: "silver", commissionRate: 0.12, minReferrals: 3 },
  { name: "gold", commissionRate: 0.20, minReferrals: 6 },
  { name: "platinum", commissionRate: 0.28, minReferrals: 11 },
  { name: "kol", commissionRate: 0.35, minReferrals: 21 },
];

export function getTierByActiveCount(activeCount: number): ReferralTierInfo {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (activeCount >= TIERS[i].minReferrals) {
      return TIERS[i];
    }
  }
  return TIERS[0];
}

// Logger client
export * from "./logger";
