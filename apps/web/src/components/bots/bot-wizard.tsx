import React, { useRef, useState, useCallback, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { z } from "zod";
import {
  useExchangeConnections,
  useExchangeMarkets,
  useExchangeBalance,
  useCreateBot,
} from "../../hooks/use-api";
import { ExchangeConnectionManager } from "./exchange-connection-manager";
import { useToast } from "../../hooks/use-toast";
import { Progress } from "../ui/progress";
import { Select } from "../ui/select";
import { Input } from "../ui/input";
import { Tabs, TabsList, TabsTrigger } from "../ui/tabs";
import { Skeleton } from "../ui/skeleton";
import {
  Activity,
  TrendingUp,
  ArrowRight,
  ArrowLeft,
  Check,
  Zap,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Search,
  BookOpen,
  Wallet,
  Signal,
  BarChart3,
  BrainCircuit,
  Timer,
} from "lucide-react";

/* ------------------------------------------------------------------ */
// Types & Schemas
/* ------------------------------------------------------------------ */

export type BotType = "signal" | "dca";

const Step1Schema = z.object({
  botType: z.enum(["signal", "dca"]),
});

const Step2Schema = z.object({
  connectionId: z.string().min(1, "Select an exchange connection"),
  tradingPair: z.string().optional(),
  mode: z.enum(["paper", "live"]),
});

const SignalConfigSchema = z.object({
  name: z.string().min(1, "Bot name is required").max(100),
  default_symbol: z.string().optional(),
  webhook_secret: z.string().min(16).optional().or(z.literal("")),
  max_position_size: z.coerce.number().positive().optional(),
  stop_loss_pct: z.coerce.number().min(0).max(100).optional(),
  take_profit_pct: z.coerce.number().min(0).max(1000).optional(),
});

const DcaConfigSchema = z.object({
  name: z.string().min(1, "Bot name is required").max(100),
  default_symbol: z.string().optional(),
  direction: z.enum(["long", "short", "both"]).default("long"),
  leverage: z.coerce.number().int().min(1).max(125).default(1),
  leverage_type: z.enum(["cross", "isolated", "exchange"]).default("cross"),
  base_order_size: z.coerce.number().positive("Must be positive"),
  safety_order_size: z.coerce.number().positive("Must be positive"),
  price_deviation_initial: z.coerce.number().positive("Must be positive"),
  safety_order_max_count: z.coerce.number().int().min(1).max(50),
  safety_order_volume_scale: z.coerce.number().positive("Must be positive"),
  safety_order_step_scale: z.coerce.number().positive("Must be positive"),
  take_profit: z.coerce.number().positive("Must be positive"),
  take_profit_mode: z.enum(["fixed", "trailing"]).default("fixed"),
  stop_loss: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : val,
    z.coerce.number().positive().optional()
  ),
  max_position_size: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : val,
    z.coerce.number().positive().optional()
  ),
  max_safety_orders_active: z.coerce.number().int().min(0).max(50).default(3),
  order_type: z.enum(["market", "limit"]).default("market"),
  post_only: z.boolean().default(false),
  indicator_type: z.enum(["none", "rsi", "macd", "ema_cross"]).default("none"),
  indicator_timeframe: z.enum(["5m", "15m", "1h", "4h", "1d"]).default("1h"),
  rsi_period: z.coerce.number().int().min(2).max(50).default(14),
  rsi_threshold: z.coerce.number().min(1).max(99).default(30),
  ema_short: z.coerce.number().int().min(2).max(50).default(9),
  ema_long: z.coerce.number().int().min(5).max(200).default(21),
  cover_indicator_type: z.enum(["none", "rsi", "macd", "ema_cross"]).default("none"),
  waterfall_prevention: z.boolean().default(false),
  waterfall_prevention_ratio: z.coerce.number().positive().default(3),
  breakeven_after_safety_orders: z.coerce.number().int().min(0).default(2),
  chop_loss_enabled: z.boolean().default(false),
  chop_loss_pct: z.coerce.number().positive().default(10),
  chop_sell_pct: z.coerce.number().positive().max(100).default(30),
  max_chop_count: z.coerce.number().int().min(0).default(3),
  max_session_loss_usdt: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : val,
    z.coerce.number().positive().optional()
  ),
  max_drawdown_pct: z.preprocess(
    (val) => (val === "" || val === undefined || val === null) ? undefined : val,
    z.coerce.number().positive().optional()
  ),
});

const steps = [
  { label: "Choose Type", desc: "Select bot strategy" },
  { label: "Exchange", desc: "Pick a connection" },
  { label: "Configure", desc: "Set parameters" },
  { label: "Review", desc: "Confirm and create" },
];

/* ------------------------------------------------------------------ */
// Confetti component
/* ------------------------------------------------------------------ */

function ConfettiBurst({ onComplete }: { onComplete: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current) return;
      const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6"];
      const particles: HTMLDivElement[] = [];

      for (let i = 0; i < 60; i++) {
        const el = document.createElement("div");
        el.className = "absolute rounded-full";
        el.style.width = `${Math.random() * 8 + 4}px`;
        el.style.height = el.style.width;
        el.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        el.style.left = "50%";
        el.style.top = "40%";
        containerRef.current.appendChild(el);
        particles.push(el);
      }

      gsap.to(particles, {
        x: () => (Math.random() - 0.5) * 400,
        y: () => (Math.random() - 0.5) * 300 + 100,
        opacity: 0,
        scale: 0,
        rotation: () => Math.random() * 720 - 360,
        duration: 1.5,
        stagger: 0.01,
        ease: "power3.out",
        onComplete: () => {
          particles.forEach((p) => p.remove());
          onComplete();
        },
      });
    },
    { scope: containerRef }
  );

  return <div ref={containerRef} className="absolute inset-0 pointer-events-none overflow-hidden" />;
}

/* ------------------------------------------------------------------ */
// Wizard
/* ------------------------------------------------------------------ */

interface BotWizardProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export const BotWizard: React.FC<BotWizardProps> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [botType, setBotType] = useState<BotType | null>(null);
  const [connectionId, setConnectionId] = useState<string>("");
  const [mode, setMode] = useState<"paper" | "live">("paper");
  const [tradingPair, setTradingPair] = useState<string>("");
  const [paperInitialBalance, setPaperInitialBalance] = useState<Record<string, number>>({
    USDT: 10000,
  });
  const [activeQuoteTab, setActiveQuoteTab] = useState<string>("USDT");
  const [pairSearch, setPairSearch] = useState<string>("");

  const [signalForm, setSignalForm] = useState({
    name: "",
    default_symbol: "",
    webhook_secret: "",
    max_position_size: "",
    stop_loss_pct: "",
    take_profit_pct: "",
  });

  const [dcaForm, setDcaForm] = useState({
    name: "",
    default_symbol: "",
    direction: "long" as "long" | "short" | "both",
    leverage: "10",
    leverage_type: "cross",
    base_order_size: "10",
    safety_order_size: "20",
    price_deviation_initial: "1",
    safety_order_max_count: "5",
    safety_order_volume_scale: "1.5",
    safety_order_step_scale: "1.5",
    take_profit: "1",
    take_profit_mode: "fixed" as "fixed" | "trailing",
    stop_loss: "",
    max_position_size: "",
    max_safety_orders_active: "3",
    order_type: "market",
    post_only: false,
    indicator_type: "none" as "none" | "rsi" | "macd" | "ema_cross",
    indicator_timeframe: "1h" as "5m" | "15m" | "1h" | "4h" | "1d",
    rsi_period: "14",
    rsi_threshold: "30",
    ema_short: "9",
    ema_long: "21",
    cover_indicator_type: "none" as "none" | "rsi" | "macd" | "ema_cross",
    waterfall_prevention: false,
    waterfall_prevention_ratio: "3",
    breakeven_after_safety_orders: "2",
    chop_loss_enabled: false,
    chop_loss_pct: "10",
    chop_sell_pct: "30",
    max_chop_count: "3",
    max_session_loss_usdt: "",
    max_drawdown_pct: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [finished, setFinished] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showSignalDocs, setShowSignalDocs] = useState(false);

  const toast = useToast();
  const createBot = useCreateBot();
  const { data: connections, isLoading: connLoading } = useExchangeConnections();
  const { data: markets, isLoading: marketsLoading } = useExchangeMarkets(connectionId);
  const { data: balance, isLoading: balanceLoading } = useExchangeBalance(connectionId);

  const contentRef = useRef<HTMLDivElement>(null);
  const stepContentRef = useRef<HTMLDivElement>(null);

  const pct = ((step - 1) / (steps.length - 1)) * 100;

  const connectionOptions =
    connections?.map((c: any) => ({
      value: c.id,
      label: `${c.name} (${c.exchangeId})`,
    })) || [];

  const quotes = React.useMemo(() => {
    if (!markets) return [];
    const set = new Set<string>();
    markets.forEach((m: any) => {
      const quote = m.quote || m.quoteCurrency || m.symbol?.split("/")[1];
      if (quote) set.add(quote);
    });
    return Array.from(set).sort();
  }, [markets]);

  useEffect(() => {
    if (quotes.length > 0 && !quotes.includes(activeQuoteTab)) {
      setActiveQuoteTab(quotes[0]);
    }
  }, [quotes, activeQuoteTab]);

  const filteredMarkets = React.useMemo(() => {
    if (!markets) return [];
    const list = markets.filter((m: any) => {
      const quote = m.quote || m.quoteCurrency || m.symbol?.split("/")[1];
      return quote === activeQuoteTab;
    });
    if (!pairSearch.trim()) return list;
    return list.filter((m: any) =>
      m.symbol.toLowerCase().includes(pairSearch.toLowerCase())
    );
  }, [markets, activeQuoteTab, pairSearch]);

  /* -------------------- Validation -------------------- */

  const validateStep = useCallback((): boolean => {
    setErrors({});
    try {
      if (step === 1) {
        Step1Schema.parse({ botType });
        return true;
      }
      if (step === 2) {
        const parsed = Step2Schema.parse({ connectionId, tradingPair, mode });
        if (botType === "dca" && (!parsed.tradingPair || parsed.tradingPair === "")) {
          setErrors({ tradingPair: "Select a trading pair" });
          return false;
        }
        if (mode === "paper") {
          const hasBalance = Object.values(paperInitialBalance).some((v) => v > 0);
          if (!hasBalance) {
            setErrors({ paperInitialBalance: "At least one paper balance must be greater than 0" });
            return false;
          }
        }
        return true;
      }
      if (step === 3) {
        if (botType === "signal") {
          SignalConfigSchema.parse(signalForm);
        } else {
          DcaConfigSchema.parse(dcaForm);
        }
        return true;
      }
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const map: Record<string, string> = {};
        err.errors.forEach((e) => {
          map[e.path[0]] = e.message;
        });
        setErrors(map);
      }
      return false;
    }
  }, [step, botType, connectionId, tradingPair, mode, paperInitialBalance, signalForm, dcaForm]);

  const canNext =
    (step === 1 && botType !== null) ||
    (step === 2 && connectionId !== "" && (botType === "signal" || tradingPair !== "")) ||
    (step === 3 && (botType === "signal" ? signalForm.name.trim() !== "" : dcaForm.name.trim() !== "")) ||
    step === 4;

  const nextDisabledReason = (() => {
    if (step === 1 && botType === null) return "Select a bot type (Signal or DCA)";
    if (step === 2 && connectionId === "") return "Select an exchange connection";
    if (step === 2 && botType === "dca" && tradingPair === "") return "Select a trading pair";
    if (step === 3 && botType === "signal" && signalForm.name.trim() === "") return "Enter a bot name";
    if (step === 3 && botType === "dca" && dcaForm.name.trim() === "") return "Enter a bot name";
    return null;
  })();

  /* -------------------- Step transitions -------------------- */

  const animateStepChange = useCallback(
    (direction: "next" | "prev", cb: () => void) => {
      if (!stepContentRef.current) {
        cb();
        return;
      }
      const xOffset = direction === "next" ? -30 : 30;
      gsap.to(stepContentRef.current, {
        x: xOffset,
        opacity: 0,
        duration: 0.2,
        ease: "power2.in",
        onComplete: () => {
          cb();
          if (stepContentRef.current) {
            gsap.fromTo(
              stepContentRef.current,
              { x: -xOffset, opacity: 0 },
              { x: 0, opacity: 1, duration: 0.25, ease: "power2.out" }
            );
          }
        },
      });
    },
    []
  );

  const handleNext = () => {
    if (!validateStep()) return;
    if (step === 4) {
      handleCreate();
      return;
    }
    animateStepChange("next", () => setStep((s) => Math.min(steps.length, s + 1)));
  };

  const handleBack = () => {
    if (step === 1) return;
    animateStepChange("prev", () => setStep((s) => Math.max(1, s - 1)));
  };

  /* -------------------- Create -------------------- */

  const handleCreate = () => {
    const payload =
      botType === "signal"
        ? {
            name: signalForm.name,
            connectionId,
            mode,
            tradingPair,
            paperInitialBalance: mode === "paper" ? paperInitialBalance : undefined,
            config: {
              type: "signal" as const,
              default_symbol: signalForm.default_symbol || undefined,
              webhook_secret: signalForm.webhook_secret || undefined,
              max_position_size: signalForm.max_position_size
                ? Number(signalForm.max_position_size)
                : undefined,
              stop_loss_pct: signalForm.stop_loss_pct
                ? Number(signalForm.stop_loss_pct)
                : undefined,
              take_profit_pct: signalForm.take_profit_pct
                ? Number(signalForm.take_profit_pct)
                : undefined,
            },
          }
        : {
            name: dcaForm.name,
            connectionId,
            mode,
            tradingPair,
            paperInitialBalance: mode === "paper" ? paperInitialBalance : undefined,
            config: {
              type: "dca" as const,
              default_symbol: dcaForm.default_symbol || undefined,
              direction: dcaForm.direction,
              leverage: Number(dcaForm.leverage),
              leverage_type: dcaForm.leverage_type as "cross" | "isolated" | "exchange",
              base_order_size: Number(dcaForm.base_order_size),
              safety_order_size: Number(dcaForm.safety_order_size),
              price_deviation_initial: Number(dcaForm.price_deviation_initial),
              safety_order_max_count: Number(dcaForm.safety_order_max_count),
              safety_order_volume_scale: Number(dcaForm.safety_order_volume_scale),
              safety_order_step_scale: Number(dcaForm.safety_order_step_scale),
              take_profit: Number(dcaForm.take_profit),
              take_profit_mode: dcaForm.take_profit_mode,
              stop_loss: dcaForm.stop_loss ? Number(dcaForm.stop_loss) : undefined,
              max_position_size: dcaForm.max_position_size
                ? Number(dcaForm.max_position_size)
                : undefined,
              max_safety_orders_active: Number(dcaForm.max_safety_orders_active),
              order_type: dcaForm.order_type as "market" | "limit",
              post_only: dcaForm.post_only,
              indicator_type: dcaForm.indicator_type,
              indicator_timeframe: dcaForm.indicator_timeframe,
              rsi_period: Number(dcaForm.rsi_period),
              rsi_threshold: Number(dcaForm.rsi_threshold),
              ema_short: Number(dcaForm.ema_short),
              ema_long: Number(dcaForm.ema_long),
              cover_indicator_type: dcaForm.cover_indicator_type,
              waterfall_prevention: dcaForm.waterfall_prevention,
              waterfall_prevention_ratio: Number(dcaForm.waterfall_prevention_ratio),
              breakeven_after_safety_orders: Number(dcaForm.breakeven_after_safety_orders),
              chop_loss_enabled: dcaForm.chop_loss_enabled,
              chop_loss_pct: Number(dcaForm.chop_loss_pct),
              chop_sell_pct: Number(dcaForm.chop_sell_pct),
              max_chop_count: Number(dcaForm.max_chop_count),
              max_session_loss_usdt: dcaForm.max_session_loss_usdt
                ? Number(dcaForm.max_session_loss_usdt)
                : undefined,
              max_drawdown_pct: dcaForm.max_drawdown_pct
                ? Number(dcaForm.max_drawdown_pct)
                : undefined,
            },
          };

    createBot.mutate(payload, {
      onSuccess: () => {
        setShowConfetti(true);
        setFinished(true);
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to create bot");
      },
    });
  };

  /* -------------------- DCA Calculator / Order Ladder -------------------- */

  const calculator = React.useMemo(() => {
    if (botType !== "dca") return null;

    const leverage = Number(dcaForm.leverage) || 1;
    const basePrice = 1;
    const deviationPct = Number(dcaForm.price_deviation_initial) || 0;
    let currentDeviation = deviationPct;

    const baseOrder = Number(dcaForm.base_order_size) || 0;
    let currentOrderSize = Number(dcaForm.safety_order_size) || 0;
    const maxSO = Number(dcaForm.safety_order_max_count) || 0;
    const volScale = Number(dcaForm.safety_order_volume_scale) || 1;
    const stepScale = Number(dcaForm.safety_order_step_scale) || 1;

    const rows: {
      order: number;
      type: string;
      priceDrop: string;
      price: number;
      size: number;
      margin: number;
      cumulative: number;
      marginCumulative: number;
    }[] = [];

    let totalInvested = baseOrder;
    let totalAmount = baseOrder / basePrice;

    rows.push({
      order: 1,
      type: "Base",
      priceDrop: "Entry",
      price: basePrice,
      size: baseOrder,
      margin: baseOrder / leverage,
      cumulative: baseOrder,
      marginCumulative: baseOrder / leverage,
    });

    for (let i = 0; i < maxSO; i++) {
      const soPrice = basePrice * (1 - currentDeviation / 100);
      if (soPrice <= 0) break;
      totalInvested += currentOrderSize;
      totalAmount += currentOrderSize / soPrice;
      rows.push({
        order: i + 2,
        type: `SO ${i + 1}`,
        priceDrop: `-${currentDeviation.toFixed(1)}%`,
        price: soPrice,
        size: currentOrderSize,
        margin: currentOrderSize / leverage,
        cumulative: totalInvested,
        marginCumulative: totalInvested / leverage,
      });
      currentDeviation *= stepScale;
      currentOrderSize *= volScale;
    }

    const breakeven = totalInvested / totalAmount;
    const breakevenPct = ((breakeven - basePrice * (1 - deviationPct / 100)) / (basePrice * (1 - deviationPct / 100))) * 100;
    const tpPrice = breakeven * (1 + Number(dcaForm.take_profit) / 100);

    return {
      leverage,
      dropPct: deviationPct,
      totalInvested,
      totalMargin: totalInvested / leverage,
      breakevenPrice: breakeven,
      breakevenPct: Math.max(0, breakevenPct),
      tpPrice,
      rows,
    };
  }, [dcaForm, botType]);

  /* -------------------- Success screen -------------------- */

  if (finished) {
    return (
      <div className="relative rounded-xl p-8 text-center">
        {showConfetti && (
          <ConfettiBurst onComplete={() => setShowConfetti(false)} />
        )}
        <div className="relative z-10 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--success)]/10 border border-[var(--success)]/20 shadow-[0_0_20px_rgba(var(--success-rgb),0.2)]">
          <Sparkles className="h-8 w-8 text-[var(--success)]" />
        </div>
        <h3 className="relative z-10 text-xl font-semibold text-[var(--text-primary)]">Bot Created Successfully</h3>
        <p className="relative z-10 mt-2 text-sm text-[var(--text-muted)]">
          Your {botType?.toUpperCase()} bot is ready. Redirecting you to the bot list...
        </p>
        <button
          onClick={() => onSuccess?.()}
          className="relative z-10 mt-6 inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] shadow-lg shadow-[var(--shadow-lg)] transition-all hover:bg-[var(--primary)] active:scale-[0.98]"
        >
          Go to My Bots
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  /* -------------------- Render -------------------- */

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-1">
          {steps.map((s, idx) => {
            const isActive = idx + 1 === step;
            const isDone = idx + 1 < step;
            return (
              <div key={s.label} className="flex flex-col items-center gap-1 flex-1">
                <div
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all",
                    isActive
                      ? "bg-[var(--primary)] text-[var(--text-primary)] shadow-[0_0_12px_rgba(59,130,246,0.4)]"
                      : isDone
                      ? "bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/30"
                      : "bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)]/30",
                  ].join(" ")}
                >
                  {isDone ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <div className="hidden sm:block text-center">
                  <span
                    className={[
                      "text-xs font-medium",
                      isActive ? "text-[var(--accent)]" : isDone ? "text-[var(--success)]" : "text-[var(--text-muted)]",
                    ].join(" ")}
                  >
                    {s.label}
                  </span>
                  <p className="text-[10px] text-[var(--text-muted)] hidden lg:block">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
        <Progress value={pct} max={100} size="sm" animated />
      </div>

      {/* Step content */}
      <div ref={contentRef} className="min-h-[280px]">
        <div ref={stepContentRef}>
          {/* Step 1: Choose Bot Type */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-muted)]">
                Select the trading strategy you want to automate.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                {([
                  {
                    key: "signal" as BotType,
                    label: "Signal Bot",
                    desc: "Execute trades automatically when receiving external trading signals via webhooks or API.",
                    icon: <Activity className="h-6 w-6" />,
                    color: "cyan",
                  },
                  {
                    key: "dca" as BotType,
                    label: "DCA Bot",
                    desc: "Dollar-cost average with safety orders to lower your average entry price over time.",
                    icon: <TrendingUp className="h-6 w-6" />,
                    color: "purple",
                  },
                ]).map((opt) => {
                  const selected = botType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => setBotType(opt.key)}
                      className={[
                        "relative rounded-xl border p-6 text-left transition-all duration-200",
                        selected
                          ? `border-${opt.color}-500 bg-${opt.color}-500/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]`
                          : "border-[var(--border-subtle)]/50 bg-[var(--bg-card)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]/20",
                      ].join(" ")}
                      style={
                        selected
                          ? {
                              borderColor:
                                opt.color === "cyan"
                                  ? "rgba(6,182,212,0.5)"
                                  : "rgba(139,92,246,0.5)",
                              backgroundColor:
                                opt.color === "cyan"
                                  ? "rgba(6,182,212,0.08)"
                                  : "rgba(139,92,246,0.08)",
                            }
                          : undefined
                      }
                    >
                      <div
                        className={[
                          "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg",
                          selected
                            ? opt.color === "cyan"
                              ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                              : "bg-[var(--accent)]/20 text-[var(--accent)]"
                            : "bg-[var(--bg-surface)] text-[var(--text-muted)]",
                        ].join(" ")}
                      >
                        {opt.icon}
                      </div>
                      <p className="text-base font-semibold text-[var(--text-primary)]">{opt.label}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">{opt.desc}</p>
                      {selected && (
                        <div className="absolute top-4 right-4">
                          <Check className="h-5 w-5 text-[var(--accent)]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {errors.botType && (
                <p className="text-xs text-[var(--danger)]">{errors.botType}</p>
              )}
            </div>
          )}

          {/* Step 2: Select Exchange */}
          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm text-[var(--text-muted)]">
                {botType === "signal"
                  ? "Choose an exchange connection. Signal bots use the trading pair sent dynamically from your webhook (Telegram / TradingView)."
                  : "Choose one of your saved exchange connections and select a trading pair."}
              </p>

              {botType === "signal" && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowSignalDocs((s) => !s)}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary)]/10 text-xs font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    📖 TradingView Setup Guide
                    <span className="text-[var(--primary)]/60">{showSignalDocs ? "(hide)" : "(show)"}</span>
                  </button>

                  {showSignalDocs && (
                    <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/[0.03] p-4 space-y-3">
                      <div className="flex items-center gap-2 text-[var(--primary)]">
                        <Signal className="w-4 h-4" />
                        <span className="font-medium text-sm">How to connect TradingView alerts</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        After creating this bot, copy your unique webhook URL from the bot detail page
                        and paste it into the{" "}
                        <strong className="text-[var(--text-secondary)]">Webhook URL</strong>{" "}
                        field in your TradingView alert.
                      </p>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-[var(--text-secondary)]">Alert Message JSON (copy into TradingView)</p>
                        <pre className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs font-mono text-[var(--text-secondary)] dark:text-[var(--text-secondary)] overflow-x-auto">
{`{
  "side": "buy",
  "symbol": "BTC/USDT",
  "volume": 0.001,
  "order_type": "market"
}`}
                        </pre>
                        <p className="text-xs text-[var(--text-muted)] dark:text-[var(--text-muted)]">
                          Use {"{{"}close{"}}"}, {"{{"}volume{"}}"}, {"{{"}ticker{"}}"} placeholders for dynamic values.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          { name: "{{ticker}}", desc: "Symbol" },
                          { name: "{{close}}", desc: "Close price" },
                          { name: "{{volume}}", desc: "Volume" },
                          { name: "{{open}}", desc: "Open price" },
                          { name: "{{high}}", desc: "High price" },
                          { name: "{{low}}", desc: "Low price" },
                        ].map((p) => (
                          <div key={p.name} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-2">
                            <code className="text-[11px] font-mono text-[var(--accent)]">{p.name}</code>
                            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{p.desc}</p>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] dark:text-[var(--text-muted)]">
                        <strong className="text-[var(--text-secondary)]">Tip:</strong>{" "}
                        You can also add a webhook secret below for HMAC-SHA256 signature verification.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {connLoading ? (
                <div className="rounded-lg border border-[var(--border-subtle)]/50 bg-[var(--bg-card)] p-8 text-center text-sm text-[var(--text-muted)]">
                  Loading connections...
                </div>
              ) : connectionOptions.length === 0 ? (
                <div className="space-y-4">
                  <div className="rounded-lg border border-[var(--border-subtle)]/50 bg-[var(--bg-card)] p-4 text-center">
                    <Zap className="mx-auto mb-2 h-6 w-6 text-[var(--text-muted)]" />
                    <p className="text-sm text-[var(--text-muted)]">No exchange connections found.</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      Add an exchange connection below to continue.
                    </p>
                  </div>
                  <ExchangeConnectionManager />
                </div>
              ) : (
                <Select
                  options={connectionOptions}
                  value={connectionId}
                  onChange={(v) => {
                    setConnectionId(v);
                    setTradingPair("");
                    setPairSearch("");
                  }}
                  label="Exchange Connection"
                  placeholder="Select connection..."
                  error={errors.connectionId}
                />
              )}

              {connectionId && botType === "dca" && (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Trading Pair</label>
                  {marketsLoading ? (
                    <div className="space-y-2">
                      <Skeleton height={40} />
                      <Skeleton height={120} />
                    </div>
                  ) : !markets || markets.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">No markets available for this connection.</p>
                  ) : (
                    <div className="rounded-lg border border-[var(--border-subtle)]/50 bg-[var(--bg-card)] space-y-2">
                      <div className="px-2 pt-2">
                        <Tabs value={activeQuoteTab} onValueChange={setActiveQuoteTab}>
                          <TabsList className="border-b-0">
                            {quotes.map((q) => (
                              <TabsTrigger key={q} value={q}>
                                {q}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                        </Tabs>
                      </div>
                      <div className="px-3">
                        <div className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1.5">
                          <Search className="h-4 w-4 text-[var(--text-muted)]" />
                          <input
                            type="text"
                            value={pairSearch}
                            onChange={(e) => setPairSearch(e.target.value)}
                            placeholder="Search pair..."
                            className="w-full bg-transparent text-sm text-gray-100 placeholder:text-[var(--text-muted)] focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto px-1 pb-2">
                        {filteredMarkets.length === 0 && (
                          <div className="px-3 py-2 text-sm text-[var(--text-muted)]">No pairs found</div>
                        )}
                        {filteredMarkets.map((m: any) => {
                          const base = m.base || m.symbol?.split("/")[0];
                          const quote = m.quote || m.symbol?.split("/")[1];
                          const selected = tradingPair === m.symbol;
                          return (
                            <button
                              key={m.symbol}
                              onClick={() => setTradingPair(m.symbol)}
                              className={[
                                "flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors",
                                selected
                                  ? "bg-[var(--primary)]/10 text-[var(--accent)]"
                                  : "hover:bg-[var(--bg-surface)] text-[var(--text-secondary)]",
                              ].join(" ")}
                            >
                              <div className="flex flex-col">
                                <span className="font-medium">{m.symbol}</span>
                                <span className="text-xs text-[var(--text-muted)]">
                                  {base} / {quote}
                                </span>
                              </div>
                              <span className="text-xs text-[var(--text-muted)]">
                                min {m.minAmount ?? m.minCost ?? m.limits?.amount?.min ?? "-"}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {errors.tradingPair && (
                    <p className="text-xs text-[var(--danger)]">{errors.tradingPair}</p>
                  )}
                </div>
              )}

              {connectionId && botType === "signal" && (
                <div className="rounded-lg border border-[var(--success)]/20 bg-[var(--success)]/[0.03] p-4">
                  <div className="flex items-center gap-2 text-[var(--success)] mb-2">
                    <Signal className="w-4 h-4" />
                    <span className="text-sm font-medium">Dynamic Pair Selection</span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                    Signal bots do not require a fixed trading pair. The symbol is sent dynamically
                    from your TradingView webhook (or Telegram) payload via the{" "}
                    <code className="text-[var(--success)] bg-[var(--success)]/10 px-1 rounded">symbol</code>{" "}
                    field in the JSON. You can trade any pair the exchange supports.
                  </p>
                  {signalForm.default_symbol && (
                    <p className="text-xs text-[var(--text-muted)] mt-2">
                      Fallback default:{" "}
                      <span className="text-[var(--text-secondary)] font-medium">{signalForm.default_symbol}</span>
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <label className="text-sm font-medium text-[var(--text-secondary)]">Trading Mode</label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <button
                    onClick={() => setMode("paper")}
                    className={[
                      "relative rounded-xl border p-5 text-left transition-all duration-200",
                      mode === "paper"
                        ? "border-blue-500/50 bg-[var(--primary)]/10 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                        : "border-[var(--border-subtle)]/50 bg-[var(--bg-card)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]/20",
                    ].join(" ")}
                    style={
                      mode === "paper"
                        ? { borderColor: "rgba(59,130,246,0.5)", backgroundColor: "rgba(59,130,246,0.08)" }
                        : undefined
                    }
                  >
                    <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--primary)]/20 text-[var(--accent)]">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Paper Trading</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      Practice with virtual funds using real market data
                    </p>
                    {mode === "paper" && (
                      <div className="absolute top-3 right-3">
                        <Check className="h-5 w-5 text-[var(--accent)]" />
                      </div>
                    )}
                  </button>

                  <button
                    onClick={() => setMode("live")}
                    className={[
                      "relative rounded-xl border p-5 text-left transition-all duration-200",
                      mode === "live"
                        ? "border-[var(--danger)]/50 bg-[var(--danger)]/10 shadow-[0_0_20px_rgba(var(--danger-rgb),0.15)]"
                        : "border-[var(--border-subtle)]/50 bg-[var(--bg-card)] hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]/20",
                    ].join(" ")}
                    style={
                      mode === "live"
                        ? { borderColor: "rgba(239,68,68,0.5)", backgroundColor: "rgba(239,68,68,0.08)" }
                        : undefined
                    }
                  >
                    <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--danger)]/20 text-[var(--danger)]">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Live Trading</p>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">
                      Trade with real funds from your exchange account
                    </p>
                    {mode === "live" && (
                      <div className="absolute top-3 right-3">
                        <Check className="h-5 w-5 text-[var(--danger)]" />
                      </div>
                    )}
                  </button>
                </div>

                {mode === "paper" && (
                  <div className="rounded-lg border border-[var(--border-subtle)]/30 bg-[var(--bg-card)]/30 p-4 space-y-3">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">Initial Paper Balance</p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {Object.entries(paperInitialBalance).map(([currency, amount]) => (
                        <Input
                          key={currency}
                          label={currency}
                          type="number"
                          value={String(amount)}
                          onChange={(e) =>
                            setPaperInitialBalance((prev) => ({
                              ...prev,
                              [currency]: Number(e.target.value),
                            }))
                          }
                        />
                      ))}
                    </div>
                    {errors.paperInitialBalance && (
                      <p className="text-xs text-[var(--danger)]">{errors.paperInitialBalance}</p>
                    )}
                  </div>
                )}

                {mode === "live" && connectionId && (
                  <div className="rounded-lg border border-[var(--border-subtle)]/30 bg-[var(--bg-card)]/30 p-4 space-y-3">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">Exchange Balance</p>
                    {balanceLoading ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Skeleton height={60} />
                        <Skeleton height={60} />
                      </div>
                    ) : balance && Object.keys(balance).length > 0 ? (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {Object.entries(balance as Record<string, any>).map(([currency, bal]) => (
                          <div
                            key={currency}
                            className="rounded-md border border-[var(--border-subtle)]/50 bg-[var(--bg-elevated)] p-3"
                          >
                            <span className="text-xs text-[var(--text-muted)]">{currency}</span>
                            <span className="block text-sm font-semibold text-[var(--text-primary)]">
                              {typeof bal === "object" ? (bal.free ?? 0) : bal} available
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--text-muted)]">Unable to fetch balance</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Configure */}
          {step === 3 && botType === "signal" && (
            <div className="space-y-4">
              <Input
                label="Bot Name"
                placeholder="e.g. BTC Signal Bot"
                value={signalForm.name}
                onChange={(e) =>
                  setSignalForm((prev) => ({ ...prev, name: e.target.value }))
                }
                error={errors.name}
              />
              <Input
                label="Default Symbol"
                placeholder="e.g. BTC/USDT"
                value={signalForm.default_symbol}
                onChange={(e) =>
                  setSignalForm((prev) => ({ ...prev, default_symbol: e.target.value }))
                }
                helperText="Optional fallback symbol if signal doesn't specify one."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Webhook Secret"
                  placeholder="min 16 characters"
                  value={signalForm.webhook_secret}
                  onChange={(e) =>
                    setSignalForm((prev) => ({ ...prev, webhook_secret: e.target.value }))
                  }
                  error={errors.webhook_secret}
                  helperText="Optional secret for webhook verification."
                />
                <Input
                  label="Max Position Size"
                  type="number"
                  placeholder="USDT amount"
                  value={signalForm.max_position_size}
                  onChange={(e) =>
                    setSignalForm((prev) => ({ ...prev, max_position_size: e.target.value }))
                  }
                  error={errors.max_position_size}
                  helperText="Optional max position in USDT."
                />
                <Input
                  label="Stop Loss %"
                  type="number"
                  step={0.1}
                  placeholder="e.g. 5"
                  value={signalForm.stop_loss_pct}
                  onChange={(e) =>
                    setSignalForm((prev) => ({ ...prev, stop_loss_pct: e.target.value }))
                  }
                  error={errors.stop_loss_pct}
                  helperText="Optional SL percentage."
                />
                <Input
                  label="Take Profit %"
                  type="number"
                  step={0.1}
                  placeholder="e.g. 10"
                  value={signalForm.take_profit_pct}
                  onChange={(e) =>
                    setSignalForm((prev) => ({ ...prev, take_profit_pct: e.target.value }))
                  }
                  error={errors.take_profit_pct}
                  helperText="Optional TP percentage."
                />
              </div>
            </div>
          )}

          {step === 3 && botType === "dca" && (
            <div className="space-y-5">
              <Input
                label="Bot Name"
                placeholder="e.g. BTC Futures DCA"
                value={dcaForm.name}
                onChange={(e) =>
                  setDcaForm((prev) => ({ ...prev, name: e.target.value }))
                }
                error={errors.name}
              />

              {/* Preset Templates */}
              <div className="rounded-xl border border-[var(--border-subtle)]/50 bg-[var(--bg-card)]/40 p-4 space-y-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Quick Presets</p>
                <div className="flex flex-wrap gap-2">
                  {([
                    {
                      key: "conservative",
                      label: "Conservative",
                      desc: "Low risk, wide safety spacing",
                      config: {
                        leverage: "3",
                        base_order_size: "10",
                        safety_order_size: "15",
                        price_deviation_initial: "2",
                        safety_order_max_count: "5",
                        safety_order_volume_scale: "1.2",
                        safety_order_step_scale: "1.5",
                        take_profit: "1.5",
                        take_profit_mode: "trailing" as const,
                        stop_loss: "",
                        max_position_size: "500",
                        order_type: "market" as const,
                        waterfall_prevention: true,
                        breakeven_after_safety_orders: "1",
                        chop_loss_enabled: true,
                        chop_loss_pct: "5",
                        chop_sell_pct: "50",
                      },
                    },
                    {
                      key: "aggressive",
                      label: "Aggressive",
                      desc: "High leverage, tight spacing",
                      config: {
                        leverage: "20",
                        base_order_size: "20",
                        safety_order_size: "30",
                        price_deviation_initial: "0.5",
                        safety_order_max_count: "8",
                        safety_order_volume_scale: "1.5",
                        safety_order_step_scale: "1.3",
                        take_profit: "0.8",
                        take_profit_mode: "fixed" as const,
                        stop_loss: "15",
                        max_position_size: "1000",
                        order_type: "market" as const,
                        waterfall_prevention: false,
                        breakeven_after_safety_orders: "3",
                        chop_loss_enabled: false,
                      },
                    },
                    {
                      key: "balanced",
                      label: "Balanced",
                      desc: "Moderate settings, division exits",
                      config: {
                        leverage: "10",
                        base_order_size: "15",
                        safety_order_size: "25",
                        price_deviation_initial: "1",
                        safety_order_max_count: "6",
                        safety_order_volume_scale: "1.5",
                        safety_order_step_scale: "1.5",
                        take_profit: "1.2",
                        take_profit_mode: "trailing" as const,
                        stop_loss: "10",
                        max_position_size: "750",
                        order_type: "market" as const,
                        waterfall_prevention: true,
                        breakeven_after_safety_orders: "2",
                        chop_loss_enabled: true,
                        chop_loss_pct: "8",
                        chop_sell_pct: "30",
                      },
                    },
                  ] as const).map((preset) => (
                    <button
                      key={preset.key}
                      onClick={() => setDcaForm((prev) => ({ ...prev, ...preset.config }))}
                      className="flex flex-col items-start rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-left hover:border-blue-500/30 hover:bg-[var(--primary)]/5 transition-all"
                    >
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{preset.label}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{preset.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* What is DCA / Safety Orders */}
              <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/[0.03] p-4 space-y-2">
                <div className="flex items-center gap-2 text-[var(--primary)]">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-sm font-medium">How Safety Orders Work</span>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  <strong className="text-[var(--text-secondary)]">1. Base Order:</strong>{" "}
                  First buy to test the market. If price goes up, you hit take-profit and win.
                  If price drops, safety orders kick in. You can also wait for an RSI/MACD/EMA signal before this first buy.
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  <strong className="text-[var(--text-secondary)]">2. Safety Orders (Cover Up):</strong>{" "}
                  Automatic extra buys as price drops. Each buy lowers your average entry price,
                  so a smaller bounce-back gets you to profit.
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  <strong className="text-[var(--text-secondary)]">3. Take-Profit:</strong>{" "}
                  When price rises above your average entry by the target %, all orders close for profit.
                </p>
              </div>

              {/* Entry Signal (Technical Indicator) */}
              <div className="rounded-xl border border-[var(--border-subtle)]/50 bg-[var(--bg-card)]/40 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-[var(--accent)]" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Entry Signal (Optional)
                  </p>
                </div>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Instead of buying immediately when the bot starts, wait for a technical indicator
                  to confirm a good entry. This helps avoid buying into a falling knife.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)]">Indicator</label>
                    <div className="flex flex-wrap gap-1.5">
                      {([
                        { key: "none", label: "None" },
                        { key: "rsi", label: "RSI (Oversold)" },
                        { key: "macd", label: "MACD" },
                        { key: "ema_cross", label: "EMA Cross" },
                      ] as const).map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() =>
                            setDcaForm((prev) => ({ ...prev, indicator_type: opt.key }))
                          }
                          className={[
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                            dcaForm.indicator_type === opt.key
                              ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30"
                              : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-secondary)] border border-[var(--border-subtle)]/50",
                          ].join(" ")}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)]">Timeframe</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(["5m", "15m", "1h", "4h", "1d"] as const).map((tf) => (
                        <button
                          key={tf}
                          onClick={() =>
                            setDcaForm((prev) => ({ ...prev, indicator_timeframe: tf }))
                          }
                          className={[
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                            dcaForm.indicator_timeframe === tf
                              ? "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30"
                              : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-secondary)] border border-[var(--border-subtle)]/50",
                          ].join(" ")}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {dcaForm.indicator_type === "rsi" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="RSI Period"
                      type="number"
                      value={dcaForm.rsi_period}
                      onChange={(e) =>
                        setDcaForm((prev) => ({ ...prev, rsi_period: e.target.value }))
                      }
                      helperText="Standard is 14 candles. Shorter = more sensitive."
                    />
                    <Input
                      label="RSI Threshold (%)"
                      type="number"
                      value={dcaForm.rsi_threshold}
                      onChange={(e) =>
                        setDcaForm((prev) => ({ ...prev, rsi_threshold: e.target.value }))
                      }
                      helperText="Buy when RSI drops below this level. Default 30 = oversold."
                    />
                  </div>
                )}

                {dcaForm.indicator_type === "ema_cross" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="EMA Short Period"
                      type="number"
                      value={dcaForm.ema_short}
                      onChange={(e) =>
                        setDcaForm((prev) => ({ ...prev, ema_short: e.target.value }))
                      }
                      helperText="Fast EMA. Default 9."
                    />
                    <Input
                      label="EMA Long Period"
                      type="number"
                      value={dcaForm.ema_long}
                      onChange={(e) =>
                        setDcaForm((prev) => ({ ...prev, ema_long: e.target.value }))
                      }
                      helperText="Slow EMA. Default 21."
                    />
                  </div>
                )}

                {dcaForm.indicator_type !== "none" && (
                  <div className="flex items-start gap-2 rounded-md bg-[var(--accent)]/5 border border-[var(--accent)]/10 px-3 py-2">
                    <Timer className="h-4 w-4 text-[var(--accent)] shrink-0 mt-0.5" />
                    <p className="text-xs text-purple-700 dark:text-purple-300">
                      The bot will monitor {dcaForm.indicator_timeframe} candles and place the first order only when the signal fires. Safety orders and take-profit work normally after that.
                    </p>
                  </div>
                )}
              </div>

              {/* Leverage Section */}
              <div className="rounded-xl border border-[var(--border-subtle)]/50 bg-[var(--bg-card)]/40 p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[var(--warning)]" />
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Leverage (Futures)</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)]">Margin Type</label>
                    <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
                      {(["cross", "isolated", "exchange"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setDcaForm((prev) => ({ ...prev, leverage_type: t }))}
                          className={[
                            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-all",
                            dcaForm.leverage_type === t
                              ? "bg-[var(--primary)]/20 text-[var(--primary)] border border-blue-500/30"
                              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-secondary)]",
                          ].join(" ")}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)]">Leverage</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 3, 5, 10, 20, 50, 100, 125].map((x) => (
                        <button
                          key={x}
                          onClick={() => setDcaForm((prev) => ({ ...prev, leverage: String(x) }))}
                          className={[
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                            Number(dcaForm.leverage) === x
                              ? "bg-[var(--warning)]/20 text-[var(--warning)] border border-[var(--warning)]/30"
                              : "bg-[var(--bg-surface)] text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-secondary)] border border-[var(--border-subtle)]/50",
                          ].join(" ")}
                        >
                          {x}×
                        </button>
                      ))}
                      <input
                        type="number"
                        min={1}
                        max={125}
                        value={dcaForm.leverage}
                        onChange={(e) => setDcaForm((prev) => ({ ...prev, leverage: e.target.value }))}
                        className="w-16 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {calculator && (
                  <div className="flex items-center gap-2 rounded-md bg-[var(--warning)]/5 border border-[var(--warning)]/10 px-3 py-2">
                    <AlertCircle className="h-4 w-4 text-[var(--warning)] shrink-0" />
                    <p className="text-xs text-[var(--warning)]">
                      Margin required: <span className="font-semibold">${calculator.totalMargin.toFixed(2)} USDT</span>
                      {" "}(Total {calculator.totalInvested.toFixed(2)} USDT ÷ {calculator.leverage}×)
                    </p>
                  </div>
                )}
              </div>

              {/* Direction */}
              <div className="rounded-xl border border-[var(--border-subtle)]/50 bg-[var(--bg-card)]/40 p-4 space-y-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Position Direction</p>
                <div className="space-y-2">
                  <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
                    {(["long", "short", "both"] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDcaForm((prev) => ({ ...prev, direction: d }))}
                        className={[
                          "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-all",
                          dcaForm.direction === d
                            ? d === "long"
                              ? "bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/30"
                              : d === "short"
                              ? "bg-[var(--danger)]/20 text-[var(--danger)] border border-[var(--danger)]/30"
                              : "bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30"
                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-secondary)]",
                        ].join(" ")}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    {dcaForm.direction === "both"
                      ? "Dual / Hedge mode opens independent long and short positions simultaneously. Each side has its own safety orders, VWAP, and exits."
                      : dcaForm.direction === "long"
                      ? "Long-only futures bot. Buys to open, sells to close."
                      : "Short-only futures bot. Sells to open, buys to close."}
                  </p>
                </div>
              </div>

              {/* Order Strategy */}
              <div className="rounded-xl border border-[var(--border-subtle)]/50 bg-[var(--bg-card)]/40 p-4 space-y-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Order Strategy (Cover Up)</p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Base Order Size (USDT)"
                    type="number"
                    value={dcaForm.base_order_size}
                    onChange={(e) =>
                      setDcaForm((prev) => ({ ...prev, base_order_size: e.target.value }))
                    }
                    error={errors.base_order_size}
                    helperText="Your first buy. If price rises, you win. If it drops, safety orders activate."
                  />
                  <Input
                    label="Safety Order Size (USDT)"
                    type="number"
                    value={dcaForm.safety_order_size}
                    onChange={(e) =>
                      setDcaForm((prev) => ({ ...prev, safety_order_size: e.target.value }))
                    }
                    error={errors.safety_order_size}
                    helperText="First cover order. Buys more when price drops to lower your average entry."
                  />
                  <Input
                    label="Max Safety Orders"
                    type="number"
                    value={dcaForm.safety_order_max_count}
                    onChange={(e) =>
                      setDcaForm((prev) => ({ ...prev, safety_order_max_count: e.target.value }))
                    }
                    error={errors.safety_order_max_count}
                    helperText="How many cover orders the bot will place total. More = deeper drawdown coverage."
                  />
                  <Input
                    label="Volume Scale (e.g. 1.5×)"
                    type="number"
                    step={0.1}
                    value={dcaForm.safety_order_volume_scale}
                    onChange={(e) =>
                      setDcaForm((prev) => ({ ...prev, safety_order_volume_scale: e.target.value }))
                    }
                    error={errors.safety_order_volume_scale}
                    helperText="Multiplier for each safety order size. 1.5× means each cover order is 50% bigger."
                  />
                  <Input
                    label="First Safety Trigger (%)"
                    type="number"
                    step={0.1}
                    value={dcaForm.price_deviation_initial}
                    onChange={(e) =>
                      setDcaForm((prev) => ({ ...prev, price_deviation_initial: e.target.value }))
                    }
                    error={errors.price_deviation_initial}
                    helperText="% price must drop from your entry before the first safety order fires."
                  />
                  <Input
                    label="Step Scale (e.g. 1.5×)"
                    type="number"
                    step={0.1}
                    value={dcaForm.safety_order_step_scale}
                    onChange={(e) =>
                      setDcaForm((prev) => ({ ...prev, safety_order_step_scale: e.target.value }))
                    }
                    error={errors.safety_order_step_scale}
                    helperText="Multiplier for each price gap. 1.5× means each trigger is 50% further apart."
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-[var(--text-muted)]">Take-Profit Mode</label>
                    <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
                      {(["fixed", "trailing"] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setDcaForm((prev) => ({ ...prev, take_profit_mode: m }))}
                          className={[
                            "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-all",
                            dcaForm.take_profit_mode === m
                              ? "bg-[var(--success)]/20 text-emerald-600 dark:text-[var(--success)] border border-[var(--success)]/30"
                              : "text-[var(--text-muted)] hover:text-[var(--text-primary)] dark:hover:text-[var(--text-secondary)]",
                          ].join(" ")}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-[var(--text-muted)]">
                      {dcaForm.take_profit_mode === "fixed"
                        ? "Close everything at a fixed profit % above entry."
                        : "Activate tiered trailing — exit if price retraces from a new peak."}
                    </p>
                  </div>
                  <Input
                    label="Take-Profit Target (%)"
                    type="number"
                    step={0.1}
                    value={dcaForm.take_profit}
                    onChange={(e) =>
                      setDcaForm((prev) => ({ ...prev, take_profit: e.target.value }))
                    }
                    error={errors.take_profit}
                    helperText="% profit above your average entry price to close all orders."
                  />
                  <Input
                    label="Stop Loss (%)"
                    type="number"
                    step={0.1}
                    value={dcaForm.stop_loss}
                    onChange={(e) =>
                      setDcaForm((prev) => ({ ...prev, stop_loss: e.target.value }))
                    }
                    error={errors.stop_loss}
                    helperText="Optional. % below your average entry to emergency exit all positions."
                  />
                  <Input
                    label="Max Position Size (USDT)"
                    type="number"
                    value={dcaForm.max_position_size}
                    onChange={(e) =>
                      setDcaForm((prev) => ({ ...prev, max_position_size: e.target.value }))
                    }
                    error={errors.max_position_size}
                    helperText="Optional. Absolute cap on total position so you never overspend."
                  />
                  <Input
                    label="Active Safety Orders (on exchange)"
                    type="number"
                    value={dcaForm.max_safety_orders_active}
                    onChange={(e) =>
                      setDcaForm((prev) => ({ ...prev, max_safety_orders_active: e.target.value }))
                    }
                    error={errors.max_safety_orders_active}
                    helperText="How many pending cover orders sit on the exchange at once."
                  />
                  <Input
                    label="Breakeven After N Safety Orders"
                    type="number"
                    value={dcaForm.breakeven_after_safety_orders}
                    onChange={(e) =>
                      setDcaForm((prev) => ({ ...prev, breakeven_after_safety_orders: e.target.value }))
                    }
                    helperText="Move stop-loss to breakeven after this many safety orders fill."
                  />
                </div>
              </div>

              {/* Risk Management */}
              <div className="rounded-xl border border-[var(--border-subtle)]/50 bg-[var(--bg-card)]/40 p-4 space-y-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Risk Management</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-[var(--text-secondary)]">Waterfall Prevention</p>
                      <p className="text-[10px] text-[var(--text-muted)]">Pause safety orders during high volatility.</p>
                    </div>
                    <button
                      onClick={() => setDcaForm((prev) => ({ ...prev, waterfall_prevention: !prev.waterfall_prevention }))}
                      className={[
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        dcaForm.waterfall_prevention ? "bg-[var(--primary)]" : "bg-[var(--bg-surface)]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-block h-3 w-3 transform rounded-full bg-[var(--text-invert)] transition-transform",
                          dcaForm.waterfall_prevention ? "translate-x-5" : "translate-x-1",
                        ].join(" ")}
                      />
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2">
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-[var(--text-secondary)]">Chop-Loss (Partial SL)</p>
                      <p className="text-[10px] text-[var(--text-muted)]">Sell a portion when loss exceeds threshold.</p>
                    </div>
                    <button
                      onClick={() => setDcaForm((prev) => ({ ...prev, chop_loss_enabled: !prev.chop_loss_enabled }))}
                      className={[
                        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                        dcaForm.chop_loss_enabled ? "bg-[var(--primary)]" : "bg-[var(--bg-surface)]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-block h-3 w-3 transform rounded-full bg-[var(--text-invert)] transition-transform",
                          dcaForm.chop_loss_enabled ? "translate-x-5" : "translate-x-1",
                        ].join(" ")}
                      />
                    </button>
                  </div>
                  <Input
                    label="Max Session Loss (USDT)"
                    type="number"
                    value={dcaForm.max_session_loss_usdt}
                    onChange={(e) => setDcaForm((prev) => ({ ...prev, max_session_loss_usdt: e.target.value }))}
                    helperText="Optional. Stop bot if realized losses exceed this amount."
                  />
                  <Input
                    label="Max Drawdown (%)"
                    type="number"
                    value={dcaForm.max_drawdown_pct}
                    onChange={(e) => setDcaForm((prev) => ({ ...prev, max_drawdown_pct: e.target.value }))}
                    helperText="Optional. Stop bot if equity drops this % from peak."
                  />
                </div>
              </div>

              {/* Order Preview Table */}
              {calculator && calculator.rows.length > 0 && (
                <div className="rounded-xl border border-[var(--border-subtle)]/50 bg-[var(--bg-card)]/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[var(--primary)]" />
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Order Preview</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--border-subtle)]/50 text-[var(--text-muted)]">
                          <th className="py-2 text-left font-medium">#</th>
                          <th className="py-2 text-left font-medium">Type</th>
                          <th className="py-2 text-left font-medium">Trigger</th>
                          <th className="py-2 text-right font-medium">Size (USDT)</th>
                          <th className="py-2 text-right font-medium">Margin</th>
                          <th className="py-2 text-right font-medium">Total (USDT)</th>
                        </tr>
                      </thead>
                      <tbody className="text-[var(--text-secondary)] dark:text-[var(--text-secondary)]">
                        {calculator.rows.map((row) => (
                          <tr key={row.order} className="border-b border-[var(--border-subtle)]/20 last:border-0">
                            <td className="py-1.5 text-left">{row.order}</td>
                            <td className="py-1.5 text-left">
                              <span
                                className={[
                                  "rounded px-1.5 py-0.5 text-[10px] font-medium",
                                  row.type === "Base"
                                    ? "bg-[var(--primary)]/10 text-[var(--primary)]"
                                    : "bg-[var(--accent)]/10 text-[var(--accent)]",
                                ].join(" ")}
                              >
                                {row.type}
                              </span>
                            </td>
                            <td className="py-1.5 text-left text-[var(--text-muted)]">{row.priceDrop}</td>
                            <td className="py-1.5 text-right font-medium">${row.size.toFixed(2)}</td>
                            <td className="py-1.5 text-right text-[var(--text-muted)]">${row.margin.toFixed(2)}</td>
                            <td className="py-1.5 text-right font-semibold text-emerald-600 dark:text-[var(--success)]">
                              ${row.cumulative.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="rounded-md bg-[var(--bg-elevated)] p-3 text-center">
                      <span className="block text-[10px] text-[var(--text-muted)]">Total Invested</span>
                      <span className="mt-0.5 block text-base font-bold text-[var(--primary)]">
                        ${calculator.totalInvested.toFixed(2)}
                      </span>
                    </div>
                    <div className="rounded-md bg-[var(--bg-elevated)] p-3 text-center">
                      <span className="block text-[10px] text-[var(--text-muted)]">Total Margin</span>
                      <span className="mt-0.5 block text-base font-bold text-[var(--warning)]">
                        ${calculator.totalMargin.toFixed(2)}
                      </span>
                    </div>
                    <div className="rounded-md bg-[var(--bg-elevated)] p-3 text-center">
                      <span className="block text-[10px] text-[var(--text-muted)]">Breakeven Recovery</span>
                      <span className="mt-0.5 block text-base font-bold text-emerald-600 dark:text-[var(--success)]">
                        +{calculator.breakevenPct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                    At max drawdown you hold <span className="text-[var(--text-secondary)]">${calculator.totalInvested.toFixed(2)} USDT</span> total position.
                    A +{dcaForm.take_profit}% bounce from average entry closes everything in profit.
                    Margin locked: <span className="text-[var(--warning)]">${calculator.totalMargin.toFixed(2)} USDT</span>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border-subtle)]/50 bg-[var(--bg-card)] p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                  <span className="text-sm text-[var(--text-muted)]">Bot Type</span>
                  <span className="text-sm font-semibold capitalize text-[var(--text-primary)]">
                    {botType} Bot
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                  <span className="text-sm text-[var(--text-muted)]">Name</span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {botType === "signal" ? signalForm.name : dcaForm.name}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                  <span className="text-sm text-[var(--text-muted)]">Exchange</span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {connectionOptions.find((c) => c.value === connectionId)?.label ||
                      connectionId}
                  </span>
                </div>
                {botType === "dca" && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                    <span className="text-sm text-[var(--text-muted)]">Trading Pair</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{tradingPair}</span>
                  </div>
                )}
                {botType === "signal" && signalForm.default_symbol && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                    <span className="text-sm text-[var(--text-muted)]">Default Pair (Fallback)</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">{signalForm.default_symbol}</span>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                  <span className="text-sm text-[var(--text-muted)]">Mode</span>
                  <span
                    className={[
                      "text-sm font-semibold capitalize",
                      mode === "live" ? "text-[var(--danger)]" : "text-[var(--accent)]",
                    ].join(" ")}
                  >
                    {mode}
                  </span>
                </div>
                {mode === "paper" && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                    <span className="text-sm text-[var(--text-muted)]">Paper Initial Balance</span>
                    <span className="text-sm font-semibold text-[var(--text-primary)]">
                      {Object.entries(paperInitialBalance)
                        .filter(([_, v]) => v > 0)
                        .map(([k, v]) => `${v} ${k}`)
                        .join(", ")}
                    </span>
                  </div>
                )}
                {botType === "dca" && (
                  <>
                    {dcaForm.default_symbol && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                        <span className="text-sm text-[var(--text-muted)]">Default Symbol</span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{dcaForm.default_symbol}</span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                      <span className="text-sm text-[var(--text-muted)]">Leverage</span>
                      <span className="text-sm font-semibold text-[var(--warning)]">{dcaForm.leverage}× {dcaForm.leverage_type}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                      <span className="text-sm text-[var(--text-muted)]">Base Order Size</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">${dcaForm.base_order_size} USDT</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                      <span className="text-sm text-[var(--text-muted)]">Safety Order Size</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">${dcaForm.safety_order_size} USDT</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                      <span className="text-sm text-[var(--text-muted)]">Price Deviation (Initial)</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{dcaForm.price_deviation_initial}%</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                      <span className="text-sm text-[var(--text-muted)]">Max Safety Orders</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{dcaForm.safety_order_max_count}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                      <span className="text-sm text-[var(--text-muted)]">Volume Scale</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{dcaForm.safety_order_volume_scale}×</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                      <span className="text-sm text-[var(--text-muted)]">Step Scale</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{dcaForm.safety_order_step_scale}×</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                      <span className="text-sm text-[var(--text-muted)]">Take-Profit</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{dcaForm.take_profit}%</span>
                    </div>
                    {dcaForm.stop_loss && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                        <span className="text-sm text-[var(--text-muted)]">Stop Loss</span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{dcaForm.stop_loss}%</span>
                      </div>
                    )}
                    {dcaForm.max_position_size && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                        <span className="text-sm text-[var(--text-muted)]">Max Position Size</span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">${dcaForm.max_position_size} USDT</span>
                      </div>
                    )}
                    {dcaForm.indicator_type !== "none" && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-sm text-[var(--text-muted)]">Entry Signal</span>
                        <span className="text-sm font-semibold text-[var(--accent)] capitalize">
                          {dcaForm.indicator_type.replace("_", " ")} ({dcaForm.indicator_timeframe})
                        </span>
                      </div>
                    )}
                  </>
                )}
                {botType === "signal" && (
                  <>
                    {signalForm.default_symbol && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                        <span className="text-sm text-[var(--text-muted)]">Default Symbol</span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{signalForm.default_symbol}</span>
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                      <span className="text-sm text-[var(--text-muted)]">Webhook Secret</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{signalForm.webhook_secret ? "Configured" : "Not set"}</span>
                    </div>
                    {signalForm.max_position_size && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                        <span className="text-sm text-[var(--text-muted)]">Max Position Size</span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">${signalForm.max_position_size} USDT</span>
                      </div>
                    )}
                    {signalForm.stop_loss_pct && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-[var(--border-subtle)]/30 pb-3">
                        <span className="text-sm text-[var(--text-muted)]">Stop Loss</span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{signalForm.stop_loss_pct}%</span>
                      </div>
                    )}
                    {signalForm.take_profit_pct && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <span className="text-sm text-[var(--text-muted)]">Take Profit</span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{signalForm.take_profit_pct}%</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              {mode === "live" && (
                <div className="flex items-start gap-2 rounded-lg border border-[var(--warning)]/20 bg-[var(--warning)]/10 p-3 text-xs text-[var(--warning)]">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    Live mode will use real funds. Make sure you have sufficient balance and understand the risks.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={handleBack}
          disabled={step === 1 || createBot.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-sm font-medium text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-elevated)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex items-center gap-3">
          {nextDisabledReason && (
            <span className="text-xs text-[var(--danger)] dark:text-[var(--danger)] flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              {nextDisabledReason}
            </span>
          )}
          <button
            onClick={handleNext}
            disabled={!canNext || createBot.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-5 py-2 text-sm font-medium text-[var(--text-primary)] shadow-lg shadow-[var(--shadow-lg)] transition-all hover:bg-[var(--primary)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97]"
          >
            {createBot.isPending ? (
              <>
                <span className="h-4 w-4 rounded-full border-2 border-[var(--text-invert)]/30 border-t-[var(--text-invert)] animate-spin" />
                Creating...
              </>
            ) : step === 4 ? (
              <>
                Create Bot
                <Sparkles className="h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BotWizard;
