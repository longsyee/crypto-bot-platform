import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import {
  useBot,
  useBotOrders,
  useBotLogs,
  useStartBot,
  useStopBot,
  useToggleBotMode,
  useUpdateBot,
  useBotPaperTrades,
  useExchangeBalance,
  useExitBot,
  useBotLivePrice,
} from "../../hooks/use-api";
import { useToast } from "../../hooks/use-toast";
import { Badge } from "../../components/ui/badge";
import { ConfirmModal } from "../../components/ui/confirm-modal";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../../components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Dialog } from "../../components/ui/dialog";
import { Tooltip } from "../../components/ui/tooltip";
import { PageWrapper } from "../../components/layout/page-wrapper";
import {
  Play,
  Square,
  ChevronLeft,
  BarChart3,
  ListOrdered,
  ScrollText,
  Settings,
  Activity,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Wallet,
  Webhook,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Signal,
  Terminal,
  Lock,
  Unlock,
  FileJson,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  Code2,
  BookOpen,
  Pencil,
  X,
  LogOut,
} from "lucide-react";
import { ActivityFeed } from "../../components/bots/activity-feed";
import { useActivityStream } from "../../hooks/use-activity";

export const Route = createFileRoute("/bots/$botId")({
  component: BotDetailPage,
});

/* ------------------------------------------------------------------ */
/* Capital Breakdown Card                                              */
/* ------------------------------------------------------------------ */
function CapitalCard({
  isPaper,
  botId,
  paperBalance,
  exchangeBalance,
  exchangeBalanceLoading,
  stateJson,
  configJson,
}: {
  isPaper: boolean;
  botId: string;
  paperBalance: Record<string, any>;
  exchangeBalance: Record<string, any> | undefined;
  exchangeBalanceLoading: boolean;
  stateJson: any;
  configJson: any;
}) {
  const { data: livePriceData, isLoading: priceLoading } = useBotLivePrice(botId);
  const livePrice = livePriceData?.lastPrice || 0;
  const leverage = Number(paperBalance.leverage || configJson?.leverage || 1);

  /* ---- Paper math ---- */
  const availableUSDT = Number(paperBalance.USDT || 0);
  const totalFees = Number(paperBalance.totalFees || 0);
  const realizedPnl = Number(paperBalance.realizedPnl || 0);

  const longPos = Number(paperBalance.longPosition || 0);
  const longEntry = Number(paperBalance.longEntryPrice || 0);
  const shortPos = Number(paperBalance.shortPosition || 0);
  const shortEntry = Number(paperBalance.shortEntryPrice || 0);
  const legacyPos = Number(paperBalance.position || 0);
  const legacyEntry = Number(paperBalance.entryPrice || 0);

  // Legacy single-mode fallback
  const effLongPos = longPos || (legacyPos > 0 ? legacyPos : 0);
  const effLongEntry = longEntry || (legacyPos > 0 ? legacyEntry : 0);
  const effShortPos = shortPos || (legacyPos < 0 ? Math.abs(legacyPos) : 0);
  const effShortEntry = shortEntry || (legacyPos < 0 ? legacyEntry : 0);

  const longNotional = effLongPos * effLongEntry;
  const shortNotional = effShortPos * effShortEntry;
  const totalNotional = longNotional + shortNotional;
  const marginUsed = totalNotional / leverage;

  // Engine state position (may be fresher than paperBalance)
  const s = stateJson || {};
  const isDual = s.mode === "dual";
  const engineLong = isDual ? s.long : s.direction === "long" ? s : null;
  const engineShort = isDual ? s.short : s.direction === "short" ? s : null;
  const engineLongAmt = engineLong ? Number(engineLong.totalAmount || 0) : 0;
  const engineLongVwap = engineLong ? Number(engineLong.vwap || 0) : 0;
  const engineShortAmt = engineShort ? Number(engineShort.totalAmount || 0) : 0;
  const engineShortVwap = engineShort ? Number(engineShort.vwap || 0) : 0;

  const hasPositions = effLongPos > 0 || effShortPos > 0 || legacyPos !== 0;

  /* ---- Floating PnL (using live CCXT price vs Engine VWAP) ---- */
  const longFloating = livePrice > 0 && engineLongVwap > 0 ? (livePrice - engineLongVwap) * engineLongAmt : 0;
  const shortFloating = livePrice > 0 && engineShortVwap > 0 ? (engineShortVwap - livePrice) * engineShortAmt : 0;
  const totalFloating = longFloating + shortFloating;

  /* ---- Live math ---- */
  const usdtBalance = exchangeBalance?.USDT;
  const liveFree = usdtBalance && typeof usdtBalance === "object" ? Number(usdtBalance.free || 0) : 0;
  const liveUsed = usdtBalance && typeof usdtBalance === "object" ? Number(usdtBalance.used || 0) : 0;
  const liveTotal = usdtBalance && typeof usdtBalance === "object" ? Number(usdtBalance.total || 0) : 0;

  return (
    <Card className="mt-4 bg-[var(--bg-card)] border-[var(--border-subtle)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base text-[var(--text-primary)]">
          <Wallet className="w-4 h-4 text-[var(--primary)]" />
          {isPaper ? "Paper Capital Breakdown" : "Live Capital Breakdown"}
        </CardTitle>
        <CardDescription className="text-[var(--text-muted)]">
          {isPaper
            ? "Simulated balance, margin used, and open positions."
            : "Exchange wallet balance for this bot's connection."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPaper ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden">
            {/* Available */}
            <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 border-t-2 border-[var(--primary)]">
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                <Unlock className="w-3.5 h-3.5" /> Available Balance
              </span>
              <span className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                {availableUSDT.toFixed(2)} <span className="text-sm font-normal text-[var(--text-muted)]">USDT</span>
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">Free margin not in positions</span>
            </div>

            {/* Margin On Hold */}
            <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 border-t-2 border-[var(--warning)]">
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" /> Margin On Hold
              </span>
              <span className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                {marginUsed.toFixed(2)} <span className="text-sm font-normal text-[var(--text-muted)]">USDT</span>
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">{leverage}× leverage</span>
            </div>

            {/* Fees */}
            <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 border-t-2 border-[var(--danger)]">
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Fees Paid
              </span>
              <span className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                {totalFees.toFixed(4)} <span className="text-sm font-normal text-[var(--text-muted)]">USDT</span>
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">Cumulative trading fees</span>
            </div>

            {/* Realized */}
            <div className={`bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 border-t-2 ${realizedPnl >= 0 ? "border-[var(--success)]" : "border-[var(--danger)]"}`}>
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Realized PnL
              </span>
              <span className={`font-['Space_Grotesk'] text-xl font-semibold tracking-tight ${realizedPnl >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {realizedPnl >= 0 ? "+" : ""}{realizedPnl.toFixed(4)} <span className="text-sm font-normal text-[var(--text-muted)]">USDT</span>
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">Closed trade profit / loss</span>
            </div>

            {/* Live Market Price */}
            <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 border-t-2 border-[var(--primary)]">
              <span className="text-[10px] uppercase tracking-widest text-[var(--primary)] font-semibold flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" /> Live Market Price
              </span>
              <span className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                {priceLoading ? (
                  <span className="text-sm text-[var(--text-muted)] animate-pulse">Fetching…</span>
                ) : livePrice > 0 ? (
                  <>
                    {livePrice.toFixed(2)} <span className="text-sm font-normal text-[var(--text-muted)]">USDT</span>
                  </>
                ) : (
                  <span className="text-sm text-[var(--text-muted)]">—</span>
                )}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">Real-time CCXT ticker</span>
            </div>

            {/* Floating PnL */}
            <div className={`bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 border-t-2 ${totalFloating >= 0 ? "border-[var(--success)]" : "border-[var(--danger)]"}`}>
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Floating PnL
              </span>
              <span className={`font-['Space_Grotesk'] text-xl font-semibold tracking-tight ${totalFloating >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                {totalFloating >= 0 ? "+" : ""}{totalFloating.toFixed(4)} <span className="text-sm font-normal text-[var(--text-muted)]">USDT</span>
              </span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">Unrealized (Live Price − VWAP) × Size</span>
            </div>

            {/* Positions section - full width if any */}
            {hasPositions && (
              <>
                {effLongPos > 0 && (
                  <div className="rounded-xl border border-[var(--success)]/20 bg-[var(--success-glow)] p-4 space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--success)] font-medium">
                        <TrendingUp className="w-3.5 h-3.5" /> Long Position
                      </div>
                      <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">Open</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Size</span>
                        <div className="font-medium text-[var(--text-primary)]">{effLongPos.toFixed(6)}</div>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Entry</span>
                        <div className="font-medium text-[var(--text-primary)]">{effLongEntry.toFixed(2)} USDT</div>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Notional</span>
                        <div className="font-medium text-[var(--text-primary)]">{longNotional.toFixed(2)} USDT</div>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Engine VWAP</span>
                        <div className="font-medium text-[var(--text-primary)]">{engineLongVwap > 0 ? engineLongVwap.toFixed(2) : "—"} USDT</div>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Live Price</span>
                        <div className="font-medium text-[var(--text-primary)]">{livePrice > 0 ? livePrice.toFixed(2) : "—"} USDT</div>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Floating PnL</span>
                        <div className={`font-medium ${longFloating >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                          {longFloating >= 0 ? "+" : ""}{longFloating.toFixed(4)} USDT
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {effShortPos > 0 && (
                  <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-glow)] p-4 space-y-2 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--danger)] font-medium">
                        <TrendingDown className="w-3.5 h-3.5" /> Short Position
                      </div>
                      <span className="inline-flex items-center rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">Open</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Size</span>
                        <div className="font-medium text-[var(--text-primary)]">{effShortPos.toFixed(6)}</div>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Entry</span>
                        <div className="font-medium text-[var(--text-primary)]">{effShortEntry.toFixed(2)} USDT</div>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Notional</span>
                        <div className="font-medium text-[var(--text-primary)]">{shortNotional.toFixed(2)} USDT</div>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Engine VWAP</span>
                        <div className="font-medium text-[var(--text-primary)]">{engineShortVwap > 0 ? engineShortVwap.toFixed(2) : "—"} USDT</div>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Live Price</span>
                        <div className="font-medium text-[var(--text-primary)]">{livePrice > 0 ? livePrice.toFixed(2) : "—"} USDT</div>
                      </div>
                      <div>
                        <span className="text-[var(--text-muted)] text-xs">Floating PnL</span>
                        <div className={`font-medium ${shortFloating >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                          {shortFloating >= 0 ? "+" : ""}{shortFloating.toFixed(4)} USDT
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden">
            {exchangeBalanceLoading ? (
              <div className="col-span-full text-sm text-[var(--text-muted)]">Loading exchange balance…</div>
            ) : !exchangeBalance || Object.keys(exchangeBalance).length === 0 ? (
              <div className="col-span-full text-sm text-[var(--text-muted)]">No exchange balance data.</div>
            ) : (
              <>
                {usdtBalance && typeof usdtBalance === "object" && (
                  <>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)]/40 p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <Unlock className="w-3.5 h-3.5" /> Free (USDT)
                      </div>
                      <div className="text-xl font-semibold text-[var(--text-primary)]">
                        {liveFree.toFixed(2)} <span className="text-sm font-normal text-[var(--text-muted)]">USDT</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)]/40 p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <Lock className="w-3.5 h-3.5" /> Used / On Hold
                      </div>
                      <div className="text-xl font-semibold text-[var(--text-primary)]">
                        {liveUsed.toFixed(2)} <span className="text-sm font-normal text-[var(--text-muted)]">USDT</span>
                      </div>
                    </div>
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)]/40 p-4 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                        <Wallet className="w-3.5 h-3.5" /> Total (USDT)
                      </div>
                      <div className="text-xl font-semibold text-[var(--text-primary)]">
                        {liveTotal.toFixed(2)} <span className="text-sm font-normal text-[var(--text-muted)]">USDT</span>
                      </div>
                    </div>
                  </>
                )}
                {/* Other coins */}
                {Object.entries(exchangeBalance)
                  .filter(([k]) => k !== "USDT")
                  .map(([currency, info]: [string, any]) => {
                    const free = typeof info === "object" && info !== null ? Number(info.free || 0) : 0;
                    const used = typeof info === "object" && info !== null ? Number(info.used || 0) : 0;
                    return (
                      <div key={currency} className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)]/40 p-4 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">{currency}</div>
                        <div className="text-sm">
                          <span className="text-[var(--text-primary)] font-medium">{free.toFixed(4)}</span>
                          <span className="text-[var(--text-muted)]"> free / </span>
                          <span className="text-[var(--text-primary)] font-medium">{used.toFixed(4)}</span>
                          <span className="text-[var(--text-muted)]"> used</span>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}

            {/* Engine state positions (live) */}
            {(engineLongAmt > 0 || engineShortAmt > 0) && (
              <>
                {engineLongAmt > 0 && (
                  <div className="rounded-xl border border-[var(--success)]/20 bg-[var(--success-glow)] p-4 space-y-2 sm:col-span-2">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--success)] font-medium">
                      <TrendingUp className="w-3.5 h-3.5" /> Engine Long Position
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-[var(--text-muted)] text-xs">Size</span><div className="font-medium text-[var(--text-primary)]">{engineLongAmt.toFixed(6)}</div></div>
                      <div><span className="text-[var(--text-muted)] text-xs">VWAP</span><div className="font-medium text-[var(--text-primary)]">{engineLongVwap.toFixed(2)} USDT</div></div>
                    </div>
                  </div>
                )}
                {engineShortAmt > 0 && (
                  <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-glow)] p-4 space-y-2 sm:col-span-2">
                    <div className="flex items-center gap-1.5 text-xs text-[var(--danger)] font-medium">
                      <TrendingDown className="w-3.5 h-3.5" /> Engine Short Position
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-[var(--text-muted)] text-xs">Size</span><div className="font-medium text-[var(--text-primary)]">{engineShortAmt.toFixed(6)}</div></div>
                      <div><span className="text-[var(--text-muted)] text-xs">VWAP</span><div className="font-medium text-[var(--text-primary)]">{engineShortVwap.toFixed(2)} USDT</div></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BotDetailPage() {
  const { botId } = Route.useParams();
  const { data: bot, isLoading: botLoading } = useBot(botId);
  const { data: orders, isLoading: ordersLoading } = useBotOrders(botId);
  const { data: paperTrades, isLoading: paperTradesLoading } =
    useBotPaperTrades(botId);
  const { data: exchangeBalance, isLoading: exchangeBalanceLoading } =
    useExchangeBalance(bot?.connection?.id ?? "");
  const { data: logs, isLoading: logsLoading } = useBotLogs(botId);
  const { logs: streamLogs, connected, clear } = useActivityStream(botId);
  const startBot = useStartBot();
  const stopBot = useStopBot();
  const toggleMode = useToggleBotMode();
  const updateBot = useUpdateBot();
  const exitBot = useExitBot();

  const toast = useToast();

  const [activeTab, setActiveTab] = useState("overview");
  const [confirmMode, setConfirmMode] = useState<"paper" | "live" | null>(
    null
  );
  const [confirmExit, setConfirmExit] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ---------- Edit Parameters ---------- */
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const handleEditOpen = () => {
    if (isRunning) return;
    const cfg = (bot?.configJson as any) || {};
    setEditForm({
      name: bot?.name || "",
      default_symbol: cfg.default_symbol || "",
      direction: cfg.direction || "long",
      leverage: cfg.leverage ?? 1,
      leverage_type: cfg.leverage_type || "cross",
      base_order_size: cfg.base_order_size ?? "",
      safety_order_size: cfg.safety_order_size ?? "",
      price_deviation_initial: cfg.price_deviation_initial ?? "",
      safety_order_max_count: cfg.safety_order_max_count ?? "",
      safety_order_volume_scale: cfg.safety_order_volume_scale ?? "",
      safety_order_step_scale: cfg.safety_order_step_scale ?? "",
      take_profit: cfg.take_profit ?? "",
      take_profit_mode: cfg.take_profit_mode || "fixed",
      stop_loss: cfg.stop_loss ?? "",
      max_position_size: cfg.max_position_size ?? "",
      max_safety_orders_active: cfg.max_safety_orders_active ?? 3,
      order_type: cfg.order_type || "market",
      post_only: cfg.post_only ?? false,
      indicator_type: cfg.indicator_type || "none",
      indicator_timeframe: cfg.indicator_timeframe || "1h",
      rsi_period: cfg.rsi_period ?? 14,
      rsi_threshold: cfg.rsi_threshold ?? 30,
      ema_short: cfg.ema_short ?? 9,
      ema_long: cfg.ema_long ?? 21,
      cover_indicator_type: cfg.cover_indicator_type || "none",
      waterfall_prevention: cfg.waterfall_prevention ?? false,
      waterfall_prevention_ratio: cfg.waterfall_prevention_ratio ?? 3,
      breakeven_after_safety_orders: cfg.breakeven_after_safety_orders ?? 2,
      chop_loss_enabled: cfg.chop_loss_enabled ?? false,
      chop_loss_pct: cfg.chop_loss_pct ?? 10,
      chop_sell_pct: cfg.chop_sell_pct ?? 30,
      max_chop_count: cfg.max_chop_count ?? 3,
      max_session_loss_usdt: cfg.max_session_loss_usdt ?? "",
      max_drawdown_pct: cfg.max_drawdown_pct ?? "",
      webhook_secret: cfg.webhook_secret || "",
      stop_loss_pct: cfg.stop_loss_pct ?? "",
      take_profit_pct: cfg.take_profit_pct ?? "",
    });
    setEditErrors({});
    setIsEditing(true);
  };

  const handleEditClose = () => {
    setIsEditing(false);
    setEditErrors({});
  };

  const handleEditSave = () => {
    const errors: Record<string, string> = {};
    if (!editForm.name?.trim()) errors.name = "Name is required";
    if (bot?.type === "dca") {
      if (!editForm.base_order_size || Number(editForm.base_order_size) <= 0)
        errors.base_order_size = "Must be positive";
      if (!editForm.safety_order_size || Number(editForm.safety_order_size) <= 0)
        errors.safety_order_size = "Must be positive";
      if (!editForm.price_deviation_initial || Number(editForm.price_deviation_initial) <= 0)
        errors.price_deviation_initial = "Must be positive";
      if (!editForm.take_profit || Number(editForm.take_profit) <= 0)
        errors.take_profit = "Must be positive";
    }
    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    const payload: { name?: string; configJson?: any } = { name: editForm.name.trim() };
    const cfg = (bot?.configJson as any) || {};
    const updatedConfig = { ...cfg };

    const numberFields = [
      "leverage",
      "base_order_size",
      "safety_order_size",
      "price_deviation_initial",
      "safety_order_max_count",
      "safety_order_volume_scale",
      "safety_order_step_scale",
      "take_profit",
      "max_safety_orders_active",
      "rsi_period",
      "rsi_threshold",
      "ema_short",
      "ema_long",
      "stop_loss_pct",
      "take_profit_pct",
      "waterfall_prevention_ratio",
      "breakeven_after_safety_orders",
      "chop_loss_pct",
      "chop_sell_pct",
      "max_chop_count",
    ];
    const optionalNumberFields = [
      "stop_loss",
      "max_position_size",
      "max_session_loss_usdt",
      "max_drawdown_pct",
    ];

    numberFields.forEach((k) => {
      if (editForm[k] !== undefined && editForm[k] !== "")
        updatedConfig[k] = Number(editForm[k]);
    });
    optionalNumberFields.forEach((k) => {
      if (editForm[k] !== undefined && editForm[k] !== "")
        updatedConfig[k] = Number(editForm[k]);
      else updatedConfig[k] = undefined;
    });

    const stringFields = [
      "default_symbol",
      "direction",
      "leverage_type",
      "order_type",
      "indicator_type",
      "indicator_timeframe",
      "webhook_secret",
    ];
    stringFields.forEach((k) => {
      if (editForm[k] !== undefined) updatedConfig[k] = editForm[k] || undefined;
    });

    payload.configJson = updatedConfig;

    updateBot.mutate(
      { id: botId, payload },
      {
        onSuccess: () => {
          toast.success("Bot parameters updated");
          setIsEditing(false);
        },
        onError: (err: any) => {
          toast.error(err.message || "Failed to update bot");
        },
      }
    );
  };

  if (botLoading) {
    return (
      <PageWrapper>
        <div className="flex items-center justify-center h-64">
          <div className="text-[var(--text-muted)]">Loading bot...</div>
        </div>
      </PageWrapper>
    );
  }

  if (!bot) {
    return (
      <PageWrapper>
        <div className="space-y-4">
          <Link
            to="/bots"
            className="inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Bots
          </Link>
          <div className="text-[var(--text-muted)]">Bot not found.</div>
        </div>
      </PageWrapper>
    );
  }

  const isRunning = bot.status === "running";
  const isPaper = bot.mode === "paper";

  const trades = isPaper ? paperTrades : orders;
  const tradesLoading = isPaper ? paperTradesLoading : ordersLoading;
  const totalTrades = trades?.length ?? 0;
  const pnl =
    trades?.reduce((acc: number, o: any) => acc + Number(o.pnl || 0), 0) ?? 0;
  const avgEntry =
    totalTrades > 0
      ? (trades?.reduce((acc: number, o: any) => acc + Number(o.price || 0), 0) ?? 0) /
        totalTrades
      : 0;

  const paperBalance: Record<string, any> = bot.paperBalance || {};

  const handleToggleMode = (mode: "paper" | "live") => {
    if (isRunning) return;
    setConfirmMode(mode);
  };

  const webhookUrl = bot?.type === "signal"
    ? `${import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3010`}/webhooks/signal/${botId}`
    : null;
  const webhookSecret = (bot?.configJson as any)?.webhook_secret || "";

  const handleCopyWebhook = () => {
    if (webhookUrl) {
      navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const confirmToggle = () => {
    if (confirmMode) {
      toggleMode.mutate({ id: botId, mode: confirmMode });
    }
    setConfirmMode(null);
  };

  return (
    <PageWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div className="gsap-section flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/bots"
              className="inline-flex items-center justify-center h-8 w-8 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] font-['Space_Grotesk']">{bot.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge status={bot.status} size="sm" />
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${
                    isPaper
                      ? "bg-[var(--warning-glow)] text-[var(--warning)] border-[var(--warning)]/20"
                      : "bg-[var(--success-glow)] text-[var(--success)] border-[var(--success)]/20"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isPaper ? "bg-[var(--warning)]" : "bg-[var(--success)]"
                    }`}
                  />
                  {isPaper ? "Paper" : "Live"}
                </span>
                <span className="text-xs text-[var(--text-muted)] capitalize">
                  {bot.type}
                </span>
                <span className="text-xs text-[var(--text-muted)]">|</span>
                <span className="text-xs text-[var(--text-muted)]">
                  {bot.connection?.exchangeId || "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Toggle */}
            <div
              className={`flex items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-0.5 ${
                isRunning ? "opacity-50 cursor-not-allowed" : ""
              }`}
              title={
                isRunning ? "Stop the bot before switching mode" : undefined
              }
            >
              <button
                onClick={() => handleToggleMode("paper")}
                disabled={isPaper || toggleMode.isPending || isRunning}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  isPaper
                    ? "bg-[var(--warning)] text-[#09090b]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Paper
              </button>
              <button
                onClick={() => handleToggleMode("live")}
                disabled={!isPaper || toggleMode.isPending || isRunning}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  !isPaper
                    ? "bg-[var(--success)] text-[#09090b]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                Live
              </button>
            </div>

            {/* Start / Stop */}
            {!isRunning ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => startBot.mutate(botId)}
                disabled={startBot.isPending}
              >
                <Play className="w-4 h-4" />
                Start
              </Button>
            ) : (
              <Button
                variant="danger"
                size="sm"
                onClick={() => stopBot.mutate(botId)}
                disabled={stopBot.isPending}
              >
                <Square className="w-4 h-4" />
                Stop
              </Button>
            )}

            {/* DCA Manual Controls */}
            {isRunning && bot?.type === "dca" && (
              <>
                <Tooltip content="Emergency market-sell all and stop">
                  <Button
                    variant="danger"
                    size="sm"
                    className="bg-[var(--danger)] hover:bg-red-800 border-red-800"
                    onClick={() => setConfirmExit(true)}
                    disabled={exitBot.isPending}
                  >
                    <LogOut className="w-4 h-4" />
                    Exit
                  </Button>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        <ConfirmModal
          open={!!confirmMode}
          title={`Switch to ${confirmMode} mode?`}
          message={`This will switch the bot to ${confirmMode} trading mode. Make sure you understand the implications before proceeding.`}
          confirmLabel="Switch"
          destructive={confirmMode === "live"}
          onConfirm={confirmToggle}
          onCancel={() => setConfirmMode(null)}
        />

        <ConfirmModal
          open={confirmExit}
          title="Emergency Exit?"
          message="This will immediately market-sell your entire position and stop the bot. This action cannot be undone."
          confirmLabel="Sell & Stop"
          destructive
          onConfirm={() => {
            exitBot.mutate(botId, {
              onSuccess: () => toast.success("Emergency exit command sent"),
              onError: (err: any) => toast.error(err.message || "Exit failed"),
            });
            setConfirmExit(false);
          }}
          onCancel={() => setConfirmExit(false)}
        />

        {/* Tabs */}
        <div className="gsap-section">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="overview">
                <BarChart3 className="w-4 h-4 mr-1.5" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="orders">
                <ListOrdered className="w-4 h-4 mr-1.5" />
                Orders
              </TabsTrigger>
              {bot?.type === "signal" && (
                <TabsTrigger value="signal">
                  <Signal className="w-4 h-4 mr-1.5" />
                  Signal Setup
                </TabsTrigger>
              )}
              <TabsTrigger value="logs">
                <ScrollText className="w-4 h-4 mr-1.5" />
                Logs
              </TabsTrigger>
              <TabsTrigger value="config">
                <Settings className="w-4 h-4 mr-1.5" />
                Config
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden">
                <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 border-t-2 border-[var(--primary)]">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                    <ListOrdered className="w-3.5 h-3.5" />
                    Total {isPaper ? "Paper Trades" : "Orders"}
                  </span>
                  <span className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)]">{totalTrades}</span>
                </div>
                <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 border-t-2 border-[var(--success)]">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    Total Realized PnL
                  </span>
                  <span className={`font-['Space_Grotesk'] text-xl font-semibold tracking-tight ${pnl >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
                    {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)} <span className="text-sm font-normal text-[var(--text-muted)]">USDT</span>
                  </span>
                </div>
                <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 border-t-2 border-[var(--accent)]">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Avg Entry
                  </span>
                  <span className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                    {avgEntry > 0 ? avgEntry.toFixed(4) : "—"}
                  </span>
                </div>
                <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 border-t-2 border-[var(--warning)]">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    Direction / Leverage
                  </span>
                  <span className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)] capitalize">
                    {(bot?.configJson as any)?.direction || "long"} / {(bot?.configJson as any)?.leverage || 1}×
                  </span>
                </div>
              </div>

              {/* Capital Breakdown */}
              <CapitalCard
                isPaper={isPaper}
                botId={bot.id}
                paperBalance={paperBalance}
                exchangeBalance={exchangeBalance}
                exchangeBalanceLoading={exchangeBalanceLoading}
                stateJson={bot?.stateJson as any}
                configJson={bot?.configJson as any}
              />

              {webhookUrl && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab("signal")}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-glow)] text-sm font-medium text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
                  >
                    <BookOpen className="w-4 h-4" />
                    📖 TradingView Setup Guide
                  </button>
                  <span className="text-xs text-[var(--text-muted)]">
                    Learn how to connect TradingView alerts to this bot.
                  </span>
                </div>
              )}

              {webhookUrl && (
                <Card className="mt-4 border-[var(--primary)]/20 bg-[var(--primary-glow)]">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm text-[var(--primary)]">
                      <Webhook className="w-4 h-4" />
                      TradingView Webhook URL
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-3 py-2 text-sm font-mono text-[var(--text-secondary)] truncate">
                        {webhookUrl}
                      </div>
                      <button
                        onClick={handleCopyWebhook}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
                        title="Copy webhook URL"
                      >
                        {copied ? (
                          <>Copied</>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>

                    {webhookSecret && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--text-muted)] w-20 shrink-0">Secret:</span>
                        <div className="flex-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-2 py-1 text-xs font-mono text-[var(--text-muted)]">
                          {showSecret ? webhookSecret : "•".repeat(Math.min(webhookSecret.length, 24))}
                        </div>
                        <button
                          onClick={() => setShowSecret((s) => !s)}
                          className="p-1.5 rounded hover:bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                          title={showSecret ? "Hide secret" : "Show secret"}
                        >
                          {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    )}

                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Paste this URL into your TradingView alert message box.
                      {webhookSecret && (
                        <>
                          {" "}
                          Include a custom header{" "}
                          <code className="text-[var(--primary)]">x-signature</code>
                          {" "}
                          with the HMAC-SHA256 hex digest of the JSON payload using the secret above.
                        </>
                      )}
                      {!webhookSecret && (
                        <>
                          {" "}
                          No signature secret configured — anyone with this URL can trigger your bot.
                          Add a secret in bot config for security.
                        </>
                      )}
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="mt-4 bg-[var(--bg-card)] border-[var(--border-subtle)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
                    <TrendingUp className="w-5 h-5 text-[var(--primary)]" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64 bg-[var(--bg-hover)]/40 border border-[var(--border-subtle)] rounded-xl flex items-center justify-center text-[var(--text-muted)] text-sm">
                    Performance chart will be rendered here
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="orders">
              <Card className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
                    <ListOrdered className="w-5 h-5 text-[var(--primary)]" />
                    {isPaper ? "Paper Trades" : "Orders"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto -mx-5">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                          <th className="text-left px-4 py-2 font-medium">
                            Symbol
                          </th>
                          <th className="text-left px-4 py-2 font-medium">
                            Side
                          </th>
                          <th className="text-left px-4 py-2 font-medium">
                            Amount
                          </th>
                          {isPaper && (
                            <th className="text-left px-4 py-2 font-medium">
                              Price
                            </th>
                          )}
                          <th className="text-left px-4 py-2 font-medium">
                            {isPaper ? "PnL" : "Status"}
                          </th>
                          <th className="text-left px-4 py-2 font-medium">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {tradesLoading && (
                          <tr>
                            <td
                              colSpan={isPaper ? 6 : 5}
                              className="px-4 py-6 text-center text-[var(--text-muted)]"
                            >
                              Loading...
                            </td>
                          </tr>
                        )}
                        {!tradesLoading &&
                          (trades?.length === 0 || !trades) && (
                            <tr>
                              <td
                                colSpan={isPaper ? 6 : 5}
                                className="px-4 py-6 text-center text-[var(--text-muted)]"
                              >
                                {isPaper
                                  ? "No paper trades yet."
                                  : "No orders yet."}
                              </td>
                            </tr>
                          )}
                        {trades?.map((o: any) => (
                          <tr
                            key={o.id}
                            className="hover:bg-[var(--bg-hover)]/50 transition-colors"
                          >
                            <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                              {o.symbol}
                            </td>
                            <td className="px-4 py-2.5">
                              <span
                                className={`inline-flex items-center text-xs font-semibold ${
                                  o.side === "buy"
                                    ? "text-[var(--success)]"
                                    : "text-[var(--danger)]"
                                }`}
                              >
                                {o.side === "buy" ? (
                                  <TrendingUp className="w-3 h-3 mr-1" />
                                ) : (
                                  <TrendingDown className="w-3 h-3 mr-1" />
                                )}
                                {o.side}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                              {o.amount}
                            </td>
                            {isPaper && (
                              <td className="px-4 py-2.5 text-[var(--text-secondary)]">
                                {Number(o.price || 0).toFixed(4)}
                              </td>
                            )}
                            <td className="px-4 py-2.5">
                              {isPaper ? (
                                <span
                                  className={`text-xs font-medium ${
                                    Number(o.pnl || 0) >= 0
                                      ? "text-[var(--success)]"
                                      : "text-[var(--danger)]"
                                  }`}
                                >
                                  {Number(o.pnl || 0) >= 0 ? "+" : ""}
                                  {Number(o.pnl || 0).toFixed(4)}
                                </span>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    o.status === "filled"
                                      ? "bg-[var(--success-glow)] text-[var(--success)] border border-[var(--success)]/20"
                                      : o.status === "open"
                                      ? "bg-[var(--primary-glow)] text-[var(--primary)] border border-[var(--primary)]/20"
                                      : "bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
                                  }`}
                                >
                                  {o.status}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-[var(--text-muted)] text-xs">
                              {o.createdAt
                                ? new Date(o.createdAt).toLocaleString()
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {bot?.type === "signal" && (
              <TabsContent value="signal">
                <div className="space-y-4">
                  {/* Quick Start */}
                  <Card className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg text-[var(--text-primary)]">
                        <Signal className="w-5 h-5 text-[var(--success)]" />
                        Signal Bot Quick Start
                      </CardTitle>
                      <CardDescription className="text-[var(--text-muted)]">
                        Connect TradingView alerts directly to this bot via webhooks.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      {/* Step 1: Webhook URL */}
                      <div className="rounded-xl border border-[var(--success)]/20 bg-[var(--success-glow)] p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[var(--success)]">
                          <Webhook className="w-4 h-4" />
                          <span className="font-medium text-sm">Step 1 — Your Webhook URL</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] px-3 py-2 text-sm font-mono text-[var(--text-secondary)] truncate">
                            {webhookUrl || "Loading..."}
                          </div>
                          <button
                            onClick={handleCopyWebhook}
                            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors shrink-0"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {copied ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          Paste this exact URL into the{" "}
                          <strong className="text-[var(--text-secondary)]">Webhook URL</strong>{" "}
                          field in your TradingView alert.
                        </p>
                      </div>

                      {/* Step 2: Alert Message */}
                      <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-glow)] p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[var(--primary)]">
                          <FileJson className="w-4 h-4" />
                          <span className="font-medium text-sm">Step 2 — TradingView Alert Message (JSON)</span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                          In TradingView, set the alert message to a JSON object. The bot reads the JSON payload
                          and executes the order. You can send variables from Pine Script using{" "}
                          <code className="text-[var(--primary)] bg-[var(--primary-glow)] px-1 rounded">{"{{"}close{"}}"}</code>
                          {" "}and{" "}
                          <code className="text-[var(--primary)] bg-[var(--primary-glow)] px-1 rounded">{"{{"}volume{"}}"}</code>
                          {" "}placeholders.
                        </p>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-[var(--text-secondary)]">Basic Market Buy</p>
                          <pre className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-3 text-xs font-mono text-[var(--text-muted)] overflow-x-auto">
{`{
  "side": "buy",
  "symbol": "BTC/USDT",
  "volume": 0.001,
  "order_type": "market"
}`}
                          </pre>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(`{\n  "side": "buy",\n  "symbol": "BTC/USDT",\n  "volume": 0.001,\n  "order_type": "market"\n}`);
                              toast.success("Copied to clipboard");
                            }}
                            className="text-xs text-[var(--primary)] hover:text-[var(--primary)] flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" /> Copy Example
                          </button>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-[var(--text-secondary)]">Limit Buy with Dynamic Price</p>
                          <pre className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-3 text-xs font-mono text-[var(--text-muted)] overflow-x-auto">
{`{
  "side": "buy",
  "symbol": "BTC/USDT",
  "volume": 0.001,
  "order_type": "limit",
  "price": {{close}}
}`}
                          </pre>
                          <p className="text-xs text-[var(--text-muted)]">
                            The{" "}
                            <code className="text-[var(--primary)] bg-[var(--primary-glow)] px-1 rounded">{"{{"}close{"}}"}</code>{" "}
                            placeholder is replaced by TradingView with the candle close price.
                          </p>
                        </div>

                        <div className="space-y-2">
                          <p className="text-xs font-medium text-[var(--text-secondary)]">Sell (Close Position)</p>
                          <pre className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-3 text-xs font-mono text-[var(--text-muted)] overflow-x-auto">
{`{
  "side": "sell",
  "symbol": "BTC/USDT",
  "volume": 0.001,
  "order_type": "market"
}`}
                          </pre>
                        </div>
                      </div>

                      {/* TradingView Placeholders Reference */}
                      <div className="rounded-xl border border-[var(--warning)]/20 bg-[var(--warning-glow)] p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[var(--warning)]">
                          <FileJson className="w-4 h-4" />
                          <span className="font-medium text-sm">TradingView Placeholders Reference</span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                          TradingView replaces these placeholders with live candle / indicator values before sending the webhook.
                          Use them inside your alert message JSON to make orders dynamic.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { name: "{{ticker}}", desc: "Symbol (e.g. BTCUSDT)" },
                            { name: "{{exchange}}", desc: "Exchange name" },
                            { name: "{{interval}}", desc: "Chart interval (e.g. 1h)" },
                            { name: "{{time}}", desc: "Bar open time (ISO)" },
                            { name: "{{open}}", desc: "Open price" },
                            { name: "{{high}}", desc: "High price" },
                            { name: "{{low}}", desc: "Low price" },
                            { name: "{{close}}", desc: "Close price" },
                            { name: "{{volume}}", desc: "Volume" },
                            { name: "{{plot_0}}", desc: "Indicator plot #0" },
                            { name: "{{plot_1}}", desc: "Indicator plot #1" },
                            { name: "{{plot_2}}", desc: "Indicator plot #2" },
                          ].map((p) => (
                            <div key={p.name} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-2">
                              <code className="text-[11px] font-mono text-[var(--warning)]">{p.name}</code>
                              <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{p.desc}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          <strong className="text-[var(--text-secondary)]">Tip:</strong>{" "}
                          When using placeholders inside JSON, TradingView inserts raw numbers.
                          Wrap strings in quotes manually: {"{{"}ticker{"}}"} becomes{" "}
                          <code className="text-[var(--warning)] bg-[var(--warning-glow)] px-1 rounded">BTCUSDT</code>,
                          so use <code className="text-[var(--warning)] bg-[var(--warning-glow)] px-1 rounded">"symbol": {"{{"}ticker{"}}"}</code>.
                        </p>
                      </div>

                      {/* Step 3: Pine Script */}
                      <div className="rounded-xl border border-[var(--warning)]/20 bg-[var(--warning-glow)] p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[var(--warning)]">
                          <Code2 className="w-4 h-4" />
                          <span className="font-medium text-sm">Step 3 — Pine Script Strategy (Advanced)</span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                          Use the{" "}
                          <code className="text-[var(--warning)] bg-[var(--warning-glow)] px-1 rounded">alert() </code>{" "}
                          function in Pine Script v5 to fire alerts with custom JSON.
                        </p>
                        <pre className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-3 text-xs font-mono text-[var(--text-muted)] overflow-x-auto">
{`//@version=5
strategy("Signal Bot Webhook", overlay=true)

// Simple RSI strategy
rsi = ta.rsi(close, 14)

if ta.crossover(rsi, 30)
    alert('{"side":"buy","symbol":"BTC/USDT","volume":0.001,"order_type":"market"}', alert.freq_once_per_bar_close)

if ta.crossunder(rsi, 70)
    alert('{"side":"sell","symbol":"BTC/USDT","volume":0.001,"order_type":"market"}', alert.freq_once_per_bar_close)

plot(rsi, "RSI", color=color.blue)`}
                        </pre>
                        <p className="text-xs text-[var(--text-muted)]">
                          <strong className="text-[var(--text-secondary)]">Important:</strong>{" "}
                          Use <code className="text-[var(--warning)] bg-[var(--warning-glow)] px-1 rounded">alert()</code>, not
                          <code className="text-[var(--warning)] bg-[var(--warning-glow)] px-1 rounded">strategy()</code>.
                          The alert function sends webhooks; the strategy function only places paper trades on TradingView.
                        </p>
                      </div>

                      {/* Field Reference */}
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                          <BookOpen className="w-4 h-4" />
                          <span className="font-medium text-sm">JSON Field Reference</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {[
                            { field: "side", required: true, type: "string", desc: '"buy" or "sell"' },
                            { field: "symbol", required: true, type: "string", desc: 'e.g. "BTC/USDT" or "ETH/USDT"' },
                            { field: "volume", required: true, type: "number", desc: "Order size in base currency (e.g. BTC)" },
                            { field: "order_type", required: false, type: "string", desc: '"market" | "limit" — defaults to "market"' },
                            { field: "price", required: false, type: "number", desc: "Required for limit orders" },
                          ].map((f) => (
                            <div key={f.field} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-3">
                              <div className="flex items-center gap-2">
                                <code className="text-sm font-mono text-[var(--primary)]">{f.field}</code>
                                {f.required && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[var(--danger-glow)] text-[var(--danger)] border border-[var(--danger)]/20">
                                    Required
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[var(--text-muted)] mt-1">
                                {f.desc}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Order Types */}
                      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                          <BookOpen className="w-4 h-4" />
                          <span className="font-medium text-sm">Order Types Explained</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex gap-3">
                            <div className="mt-0.5 w-2 h-2 rounded-full bg-[var(--success)] shrink-0" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-[var(--success)]">Market Order</p>
                              <p className="text-xs text-[var(--text-muted)]">Executes immediately at the current best price. Use when speed matters.</p>
                              <code className="text-xs font-mono text-[var(--text-muted)]">"order_type": "market"</code>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <div className="mt-0.5 w-2 h-2 rounded-full bg-[var(--primary)] shrink-0" />
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-[var(--primary)]">Limit Order</p>
                              <p className="text-xs text-[var(--text-muted)]">Executes only when price reaches your specified level. Better control, but may not fill.</p>
                              <code className="text-xs font-mono text-[var(--text-muted)]">"order_type": "limit", "price": 65000</code>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Security */}
                      <div className="rounded-xl border border-[var(--accent)]/20 bg-[var(--accent)]/[0.03] p-4 space-y-3">
                        <div className="flex items-center gap-2 text-[var(--accent)]">
                          <ShieldCheck className="w-4 h-4" />
                          <span className="font-medium text-sm">Security — Webhook Signature</span>
                        </div>
                        {webhookSecret ? (
                          <>
                            <div className="flex items-center gap-2 text-xs text-[var(--success)]">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Secret is configured. Requests without a valid signature will be rejected.
                            </div>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                              TradingView does not support custom headers natively in the alert dialog. For signed webhooks,
                              use a middleware proxy (e.g. a simple Cloudflare Worker or your own server) that adds the
                              <code className="text-[var(--accent)] bg-[var(--accent)]/10 px-1 rounded">x-signature</code>{" "}
                              header with the HMAC-SHA256 of the JSON body.
                            </p>
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2 text-xs text-[var(--warning)]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              No webhook secret configured. Anyone with your URL can trigger trades.
                            </div>
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                              Go to the{" "}
                              <button onClick={() => setActiveTab("config")} className="text-[var(--primary)] hover:underline">Config tab</button>
                              {" "}and add a{" "}
                              <code className="text-[var(--accent)] bg-[var(--accent)]/10 px-1 rounded">webhook_secret</code>{" "}
                              to your bot JSON. Then proxy requests through a server that computes the HMAC-SHA256 signature.
                            </p>
                          </>
                        )}
                      </div>

                      {/* Troubleshooting */}
                      <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-glow)] p-4 space-y-2">
                        <div className="flex items-center gap-2 text-[var(--danger)]">
                          <Terminal className="w-4 h-4" />
                          <span className="font-medium text-sm">Common Issues</span>
                        </div>
                        <ul className="space-y-2 text-xs text-[var(--text-muted)]">
                          <li><strong className="text-[var(--text-secondary)]">Bot must be running</strong> — Start the bot before expecting trades. Webhooks are rejected for stopped bots.</li>
                          <li><strong className="text-[var(--text-secondary)]">Symbol format</strong> — Use exactly the exchange format (e.g. "BTC/USDT" not "BTCUSDT").</li>
                          <li><strong className="text-[var(--text-secondary)]">Paper vs Live</strong> — Test with Paper mode first. Switch to Live only after verifying signals work.</li>
                          <li><strong className="text-[var(--text-secondary)]">JSON syntax</strong> — TradingView replaces {"{{"}placeholders{"}}"} with numbers. Ensure the final payload is valid JSON.</li>
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            )}

            <TabsContent value="logs">
              <Card className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
                    <ScrollText className="w-5 h-5 text-[var(--primary)]" />
                    Activity Feed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ActivityFeed
                    logs={streamLogs.length > 0 ? streamLogs : (logs ?? [])}
                    connected={connected}
                    onClear={clear}
                    loading={logsLoading}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="config">
              <Card className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-[var(--text-primary)]">
                      <Settings className="w-5 h-5 text-[var(--primary)]" />
                      Configuration
                    </CardTitle>
                    <CardDescription className="text-[var(--text-muted)]">
                      Current bot parameters. Stop the bot to make changes.
                    </CardDescription>
                  </div>
                  <Tooltip
                    content={
                      isRunning
                        ? "Stop the bot before editing parameters"
                        : "Edit bot parameters"
                    }
                  >
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleEditOpen}
                      disabled={isRunning || updateBot.isPending}
                    >
                      <Pencil className="w-4 h-4" />
                      Edit Parameters
                    </Button>
                  </Tooltip>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const cfg = (bot?.configJson as any) || {};
                    const rows: { label: string; value: string }[] = [
                      { label: "Name", value: bot?.name || "—" },
                      { label: "Type", value: bot?.type || "—" },
                      { label: "Mode", value: bot?.mode || "—" },
                      { label: "Trading Pair", value: bot?.tradingPair || cfg.default_symbol || "—" },
                    ];
                    if (bot?.type === "dca") {
                      rows.push(
                        { label: "Direction", value: cfg.direction ? `${cfg.direction}` : "long" },
                        { label: "Leverage", value: `${cfg.leverage ?? 1}× ${cfg.leverage_type || "cross"}` },
                        { label: "Base Order Size", value: cfg.base_order_size ? `$${cfg.base_order_size} USDT` : "—" },
                        { label: "Safety Order Size", value: cfg.safety_order_size ? `$${cfg.safety_order_size} USDT` : "—" },
                        { label: "Max Safety Orders", value: String(cfg.safety_order_max_count ?? "—") },
                        { label: "Volume Scale", value: cfg.safety_order_volume_scale ? `${cfg.safety_order_volume_scale}×` : "—" },
                        { label: "Step Scale", value: cfg.safety_order_step_scale ? `${cfg.safety_order_step_scale}×` : "—" },
                        { label: "First Safety Trigger", value: cfg.price_deviation_initial ? `${cfg.price_deviation_initial}%` : "—" },
                        { label: "Take-Profit", value: cfg.take_profit ? `${cfg.take_profit}%` : "—" },
                        { label: "Stop Loss", value: cfg.stop_loss ? `${cfg.stop_loss}%` : "Not set" },
                        { label: "Max Position Size", value: cfg.max_position_size ? `$${cfg.max_position_size} USDT` : "Not set" },
                        { label: "Order Type", value: cfg.order_type || "market" },
                        { label: "Entry Signal", value: cfg.indicator_type && cfg.indicator_type !== "none" ? `${cfg.indicator_type.replace("_", " ")} (${cfg.indicator_timeframe || "1h"})` : "None (immediate)" }
                      );
                    } else {
                      rows.push(
                        { label: "Default Symbol", value: cfg.default_symbol || "—" },
                        { label: "Webhook Secret", value: cfg.webhook_secret ? "Configured" : "Not set" },
                        { label: "Max Position Size", value: cfg.max_position_size ? `$${cfg.max_position_size} USDT` : "Not set" },
                        { label: "Stop Loss", value: cfg.stop_loss_pct ? `${cfg.stop_loss_pct}%` : "Not set" },
                        { label: "Take Profit", value: cfg.take_profit_pct ? `${cfg.take_profit_pct}%` : "Not set" }
                      );
                    }
                    return (
                      <div className="rounded-xl border border-[var(--border-subtle)] divide-y divide-[var(--border-subtle)] overflow-hidden">
                        {rows.map((r, i) => (
                          <div
                            key={i}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-4 py-2.5 bg-[var(--bg-hover)]/40"
                          >
                            <span className="text-xs font-medium text-[var(--text-muted)]">{r.label}</span>
                            <span className="text-sm font-semibold text-[var(--text-primary)]">{r.value}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Parameters Dialog */}
      <Dialog
        open={isEditing}
        onClose={handleEditClose}
        title="Edit Bot Parameters"
        description={`Update ${bot?.type?.toUpperCase()} bot settings. The bot must be stopped to save changes.`}
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="space-y-4">
          <Input
            label="Bot Name"
            value={editForm.name || ""}
            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
            error={editErrors.name}
          />

          {bot?.type === "dca" && (
            <>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-hover)]/40 p-4 space-y-3">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Direction</p>
                <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-1">
                  {(["long", "short", "both"] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setEditForm((prev) => ({ ...prev, direction: d }))}
                      className={[
                        "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-all",
                        editForm.direction === d
                          ? d === "long"
                            ? "bg-[var(--success-glow)] text-[var(--success)] border border-[var(--success)]/20"
                            : d === "short"
                            ? "bg-[var(--danger-glow)] text-[var(--danger)] border border-[var(--danger)]/20"
                            : "bg-[var(--primary-glow)] text-[var(--primary)] border border-[var(--primary)]/20"
                          : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                      ].join(" ")}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {editForm.direction === "both"
                    ? "Dual / Hedge mode opens independent long and short positions simultaneously. Each side has its own safety orders, VWAP, and exits."
                    : editForm.direction === "long"
                    ? "Long-only futures bot. Buys to open, sells to close."
                    : "Short-only futures bot. Sells to open, buys to close."}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Base Order Size (USDT)"
                  type="number"
                  value={editForm.base_order_size || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, base_order_size: e.target.value }))}
                  error={editErrors.base_order_size}
                />
                <Input
                  label="Safety Order Size (USDT)"
                  type="number"
                  value={editForm.safety_order_size || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, safety_order_size: e.target.value }))}
                  error={editErrors.safety_order_size}
                />
                <Input
                  label="First Safety Trigger (%)"
                  type="number"
                  step={0.1}
                  value={editForm.price_deviation_initial || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, price_deviation_initial: e.target.value }))}
                  error={editErrors.price_deviation_initial}
                />
                <Input
                  label="Take-Profit Target (%)"
                  type="number"
                  step={0.1}
                  value={editForm.take_profit || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, take_profit: e.target.value }))}
                  error={editErrors.take_profit}
                />
                <Input
                  label="Stop Loss (%)"
                  type="number"
                  step={0.1}
                  value={editForm.stop_loss || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, stop_loss: e.target.value }))}
                  helperText="Leave empty to disable."
                />
                <Input
                  label="Max Position Size (USDT)"
                  type="number"
                  value={editForm.max_position_size || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, max_position_size: e.target.value }))}
                  helperText="Leave empty for no cap."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Max Safety Orders"
                  type="number"
                  value={editForm.safety_order_max_count || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, safety_order_max_count: e.target.value }))}
                />
                <Input
                  label="Volume Scale"
                  type="number"
                  step={0.1}
                  value={editForm.safety_order_volume_scale || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, safety_order_volume_scale: e.target.value }))}
                  helperText="e.g. 1.5×"
                />
                <Input
                  label="Step Scale"
                  type="number"
                  step={0.1}
                  value={editForm.safety_order_step_scale || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, safety_order_step_scale: e.target.value }))}
                  helperText="e.g. 1.5×"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Leverage"
                  type="number"
                  min={1}
                  max={125}
                  value={editForm.leverage || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, leverage: e.target.value }))}
                />
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[var(--text-secondary)]">Margin Type</label>
                  <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-hover)] p-1">
                    {(["cross", "isolated", "exchange"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setEditForm((prev) => ({ ...prev, leverage_type: t }))}
                        className={[
                          "flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-all",
                          editForm.leverage_type === t
                            ? "bg-[var(--primary-glow)] text-[var(--primary)] border border-[var(--primary)]/20"
                            : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                        ].join(" ")}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary-glow)] p-3 space-y-3">
                <p className="text-xs font-medium text-[var(--primary)] flex items-center gap-1.5">
                  <Signal className="w-3.5 h-3.5" /> Entry Signal
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--text-muted)]">Indicator</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(["none", "rsi", "macd", "ema_cross"] as const).map((opt) => (
                        <button
                          key={opt}
                          onClick={() => setEditForm((prev) => ({ ...prev, indicator_type: opt }))}
                          className={[
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                            editForm.indicator_type === opt
                              ? "bg-[var(--primary-glow)] text-[var(--primary)] border border-[var(--primary)]/20"
                              : "bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]",
                          ].join(" ")}
                        >
                          {opt === "none" ? "None" : opt === "rsi" ? "RSI" : opt === "macd" ? "MACD" : "EMA Cross"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-[var(--text-muted)]">Timeframe</label>
                    <div className="flex flex-wrap gap-1.5">
                      {(["5m", "15m", "1h", "4h", "1d"] as const).map((tf) => (
                        <button
                          key={tf}
                          onClick={() => setEditForm((prev) => ({ ...prev, indicator_timeframe: tf }))}
                          className={[
                            "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                            editForm.indicator_timeframe === tf
                              ? "bg-[var(--primary-glow)] text-[var(--primary)] border border-[var(--primary)]/20"
                              : "bg-[var(--bg-hover)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]",
                          ].join(" ")}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                {editForm.indicator_type === "rsi" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="RSI Period" type="number" value={editForm.rsi_period || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, rsi_period: e.target.value }))} />
                    <Input label="RSI Threshold" type="number" value={editForm.rsi_threshold || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, rsi_threshold: e.target.value }))} />
                  </div>
                )}
                {editForm.indicator_type === "ema_cross" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input label="EMA Short" type="number" value={editForm.ema_short || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, ema_short: e.target.value }))} />
                    <Input label="EMA Long" type="number" value={editForm.ema_long || ""} onChange={(e) => setEditForm((prev) => ({ ...prev, ema_long: e.target.value }))} />
                  </div>
                )}
              </div>
            </>
          )}

          {bot?.type === "signal" && (
            <>
              <Input
                label="Default Symbol"
                value={editForm.default_symbol || ""}
                onChange={(e) => setEditForm((prev) => ({ ...prev, default_symbol: e.target.value }))}
                helperText="Fallback trading pair if the webhook payload doesn't include symbol."
              />
              <Input
                label="Webhook Secret"
                type="password"
                value={editForm.webhook_secret || ""}
                onChange={(e) => setEditForm((prev) => ({ ...prev, webhook_secret: e.target.value }))}
                helperText="Leave empty to keep unchanged. HMAC-SHA256 secret for webhook security."
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Max Position Size (USDT)"
                  type="number"
                  value={editForm.max_position_size || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, max_position_size: e.target.value }))}
                />
                <Input
                  label="Stop Loss (%)"
                  type="number"
                  step={0.1}
                  value={editForm.stop_loss_pct || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, stop_loss_pct: e.target.value }))}
                />
                <Input
                  label="Take Profit (%)"
                  type="number"
                  step={0.1}
                  value={editForm.take_profit_pct || ""}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, take_profit_pct: e.target.value }))}
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="secondary" size="sm" onClick={handleEditClose}>
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleEditSave}
              disabled={updateBot.isPending}
            >
              {updateBot.isPending ? (
                <span className="h-4 w-4 rounded-full border-2 border-[var(--text-invert)]/30 border-t-[var(--text-invert)] animate-spin" />
              ) : (
                <Pencil className="w-4 h-4" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </Dialog>
    </PageWrapper>
  );
}
