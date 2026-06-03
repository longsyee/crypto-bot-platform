import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useMemo } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRankings } from "../hooks/use-api";
import { PageWrapper } from "../components/layout/page-wrapper";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import {
  Trophy,
  TrendingUp,
  Target,
  Zap,
  Crown,
  Medal,
  Award,
  Flame,
  Activity,
  ChevronUp,
} from "lucide-react";

export const Route = createFileRoute("/rankings")({
  component: RankingsPage,
});

type Period = "daily" | "weekly" | "monthly" | "overall";

const TIER_CONFIG: Record<string, { label: string; color: string; glow: string; bg: string; icon: React.ElementType }> = {
  S: {
    label: "S-Tier",
    color: "#f59e0b",
    glow: "rgba(245, 158, 11, 0.45)",
    bg: "rgba(245, 158, 11, 0.08)",
    icon: Crown,
  },
  A: {
    label: "A-Tier",
    color: "#a855f7",
    glow: "rgba(168, 85, 247, 0.4)",
    bg: "rgba(168, 85, 247, 0.08)",
    icon: Trophy,
  },
  B: {
    label: "B-Tier",
    color: "#3b82f6",
    glow: "rgba(59, 130, 246, 0.35)",
    bg: "rgba(59, 130, 246, 0.08)",
    icon: Medal,
  },
  C: {
    label: "C-Tier",
    color: "#10b981",
    glow: "rgba(16, 185, 129, 0.35)",
    bg: "rgba(16, 185, 129, 0.08)",
    icon: Award,
  },
  D: {
    label: "D-Tier",
    color: "#64748b",
    glow: "rgba(100, 116, 139, 0.3)",
    bg: "rgba(100, 116, 139, 0.06)",
    icon: Activity,
  },
};

function TierBadge({ tier }: { tier: string }) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.D;
  const Icon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md border px-2 py-[1px] text-[11px] font-bold uppercase tracking-wider"
      style={{
        color: config.color,
        borderColor: config.color,
        background: config.bg,
      }}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-600">
        <Crown className="w-4 h-4 text-white" />
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-500">
        <Medal className="w-4 h-4 text-white" />
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-orange-300 to-orange-600">
        <Award className="w-4 h-4 text-white" />
      </div>
    );
  }
  return (
    <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-sm font-bold text-[var(--text-muted)]">
      {rank}
    </span>
  );
}

function PodiumCard({
  entry,
  place,
}: {
  entry: any;
  place: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const heightClass = place === 1 ? "h-40" : place === 2 ? "h-32" : "h-28";
  const gradient =
    place === 1
      ? "from-amber-500/20 via-amber-500/5 to-transparent"
      : place === 2
      ? "from-slate-400/20 via-slate-400/5 to-transparent"
      : "from-orange-500/20 via-orange-500/5 to-transparent";

  return (
    <div
      ref={ref}
      className={`relative flex flex-col items-center justify-end rounded-xl border border-[var(--border-subtle)] bg-gradient-to-b ${gradient} ${heightClass} p-3`}
    >
      <div className="absolute -top-5">
        <RankMedal rank={place} />
      </div>
      <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-bold text-[var(--text-primary)]">
        {entry.avatar}
      </div>
      <p className="mt-2 text-sm font-semibold text-[var(--text-primary)] truncate max-w-[120px]">
        {entry.email}
      </p>
      <div className="mt-1">
        <TierBadge tier={entry.tier} />
      </div>
      <div className="mt-2 text-xs text-[var(--text-muted)]">
        Score: <span className="font-mono font-semibold text-[var(--accent)]">{Math.round(entry.score).toLocaleString()}</span>
      </div>
    </div>
  );
}

function RankRow({ entry, index }: { entry: any; index: number }) {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-[var(--bg-hover)]/40"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center gap-3 min-w-[2.5rem]">
        <RankMedal rank={entry.rank} />
      </div>

      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-sm font-bold text-[var(--text-primary)] shrink-0">
        {entry.avatar}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{entry.email}</p>
        <div className="mt-0.5 flex items-center gap-2">
          <TierBadge tier={entry.tier} />
          {entry.showcasePaperTrades && (
            <span className="inline-flex items-center gap-1 rounded-md border border-[var(--accent)]/20 bg-[var(--accent)]/5 px-2 py-[1px] text-[10px] font-medium text-[var(--accent)]">
              <Zap className="w-2.5 h-2.5" />
              Paper
            </span>
          )}
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Score</span>
          <span className="font-mono text-xs font-semibold text-[var(--accent)]">{Math.round(entry.score).toLocaleString()}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">P/L</span>
          <span className={`font-mono text-xs font-semibold ${entry.paperPnl >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
            {entry.paperPnl >= 0 ? "+" : ""}{Number(entry.paperPnl).toFixed(2)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Win Rate</span>
          <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{entry.winRate.toFixed(1)}%</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Trades</span>
          <span className="font-mono text-xs font-semibold text-[var(--text-primary)]">{entry.paperTradeCount + entry.liveOrderCount}</span>
        </div>
      </div>

      <div className="sm:hidden flex flex-col items-end text-xs">
        <span className="font-mono font-semibold text-[var(--accent)]">{Math.round(entry.score).toLocaleString()}</span>
        <span className={`font-mono font-semibold ${entry.paperPnl >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>
          {entry.paperPnl >= 0 ? "+" : ""}{Number(entry.paperPnl).toFixed(0)}
        </span>
      </div>
    </div>
  );
}

function RankingsPage() {
  const [period, setPeriod] = useState<Period>("overall");
  const { data, isLoading } = useRankings(period);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  const entries = data?.data || [];

  const top3 = useMemo(() => entries.slice(0, 3), [entries]);
  const rest = useMemo(() => entries.slice(3), [entries]);

  useGSAP(
    () => {
      if (!headerRef.current) return;
      gsap.fromTo(
        headerRef.current,
        { y: -20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: "power3.out" }
      );
    },
    { scope: headerRef }
  );

  useGSAP(
    () => {
      if (!containerRef.current) return;
      const cards = containerRef.current.querySelectorAll(".podium-card");
      gsap.fromTo(
        cards,
        { y: 40, opacity: 0, scale: 0.95 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: "back.out(1.4)",
        }
      );
    },
    { scope: containerRef, dependencies: [period] }
  );

  useGSAP(
    () => {
      if (!listRef.current) return;
      const rows = listRef.current.querySelectorAll(".rank-row");
      gsap.fromTo(
        rows,
        { x: -20, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.4,
          stagger: 0.04,
          ease: "power2.out",
        }
      );
    },
    { scope: listRef, dependencies: [period] }
  );

  return (
    <PageWrapper>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 md:px-6">
        {/* Header */}
        <div ref={headerRef} className="flex flex-col items-center text-center gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[var(--warning)]" />
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-['Space_Grotesk']">
              Leaderboard
            </h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] max-w-md">
            Top performers ranked by trading score. Paper results are showcased for selected traders.
          </p>
        </div>

        {/* Period Tabs */}
        <div className="flex justify-center">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
              <TabsTrigger value="daily" className="data-[state=active]:bg-[var(--bg-hover)] data-[state=active]:text-[var(--text-primary)] text-[11px]">
                Daily
              </TabsTrigger>
              <TabsTrigger value="weekly" className="data-[state=active]:bg-[var(--bg-hover)] data-[state=active]:text-[var(--text-primary)] text-[11px]">
                Weekly
              </TabsTrigger>
              <TabsTrigger value="monthly" className="data-[state=active]:bg-[var(--bg-hover)] data-[state=active]:text-[var(--text-primary)] text-[11px]">
                Monthly
              </TabsTrigger>
              <TabsTrigger value="overall" className="data-[state=active]:bg-[var(--bg-hover)] data-[state=active]:text-[var(--text-primary)] text-[11px]">
                Overall
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <div className="w-6 h-6 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
            <span className="text-xs text-[var(--text-muted)]">Loading rankings...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Activity className="w-8 h-8 text-[var(--text-muted)]" />
            <p className="text-xs text-[var(--text-muted)]">No rankings available yet.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Podium */}
            <div
              ref={containerRef}
              className="flex items-end justify-center gap-3 md:gap-6"
            >
              {top3[1] && (
                <div className="podium-card w-full max-w-[180px]">
                  <PodiumCard entry={top3[1]} place={2} />
                </div>
              )}
              {top3[0] && (
                <div className="podium-card w-full max-w-[200px]">
                  <PodiumCard entry={top3[0]} place={1} />
                </div>
              )}
              {top3[2] && (
                <div className="podium-card w-full max-w-[180px]">
                  <PodiumCard entry={top3[2]} place={3} />
                </div>
              )}
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden border border-[var(--border-subtle)]">
              <StatPill icon={TrendingUp} label="Top Score" value={Math.round(entries[0]?.score || 0).toLocaleString()} color="var(--accent)" />
              <StatPill icon={Target} label="Avg Win Rate" value={`${(entries.reduce((s: number, e: any) => s + e.winRate, 0) / entries.length || 0).toFixed(1)}%`} color="var(--success)" />
              <StatPill icon={Flame} label="Total Trades" value={entries.reduce((s: number, e: any) => s + e.paperTradeCount + e.liveOrderCount, 0).toLocaleString()} color="var(--warning)" />
              <StatPill icon={ChevronUp} label="S-Tiers" value={entries.filter((e: any) => e.tier === "S").length.toString()} color="var(--danger)" />
            </div>

            {/* List */}
            <div ref={listRef} className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden divide-y divide-[var(--border-subtle)]">
              {rest.map((entry: any, i: number) => (
                <div key={entry.userId} className="rank-row">
                  <RankRow entry={entry} index={i} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-[var(--bg-card)] p-3 border-t-2" style={{ borderColor: color }}>
      <Icon className="w-3.5 h-3.5 mb-1" style={{ color }} />
      <div className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight font-mono" style={{ color }}>{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mt-0.5">{label}</div>
    </div>
  );
}
