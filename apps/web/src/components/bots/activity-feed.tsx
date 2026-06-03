import React, { useState, useRef, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Bell,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ListOrdered,
  Radio,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import type { ActivityLog } from "../../hooks/use-activity";

/* ------------------------------------------------------------------ */
// Category styling  (compact terminal glyphs)
/* ------------------------------------------------------------------ */

const CATEGORY_META: Record<
  ActivityLog["category"],
  { icon: React.ReactNode; label: string; color: string }
> = {
  order: {
    icon: <ListOrdered className="w-3 h-3" />,
    label: "ORD",
    color: "text-[var(--accent)]",
  },
  signal: {
    icon: <Radio className="w-3 h-3" />,
    label: "SIG",
    color: "text-[var(--primary)]",
  },
  state: {
    icon: <Activity className="w-3 h-3" />,
    label: "STA",
    color: "text-[var(--success)]",
  },
  system: {
    icon: <Settings className="w-3 h-3" />,
    label: "SYS",
    color: "text-[var(--text-muted)]",
  },
  trade: {
    icon: <DollarSign className="w-3 h-3" />,
    label: "TRD",
    color: "text-[var(--success)]",
  },
  fee: {
    icon: <ArrowDownCircle className="w-3 h-3" />,
    label: "FEE",
    color: "text-[var(--warning)]",
  },
  alert: {
    icon: <AlertTriangle className="w-3 h-3" />,
    label: "ALR",
    color: "text-[var(--danger)]",
  },
};

const LEVEL_ACCENT: Record<ActivityLog["level"], string> = {
  info: "border-t-[var(--success)]",
  warn: "border-t-amber-400",
  error: "border-t-red-400",
};

/* ------------------------------------------------------------------ */
// Single row  — dense grid, no card, border-t-2 accent strip
/* ------------------------------------------------------------------ */

function ActivityRow({ log }: { log: ActivityLog }) {
  const [expanded, setExpanded] = useState(false);
  const meta = CATEGORY_META[log.category] ?? CATEGORY_META.system;
  const hasMeta = log.metadata && Object.keys(log.metadata).length > 0;
  const time = log.createdAt
    ? new Date(log.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";
  const date = log.createdAt
    ? new Date(log.createdAt).toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })
    : "";

  return (
    <div className="border-t-2 bg-[var(--bg-card)] divide-y divide-[var(--border-subtle)]">
      <button
        onClick={() => hasMeta && setExpanded((v) => !v)}
        className={[
          "flex w-full items-start gap-2 px-3 py-2 text-left",
          hasMeta ? "cursor-pointer hover:bg-[var(--bg-surface)]" : "cursor-default",
        ].join(" ")}
      >
        {/* Time column */}
        <div className="flex flex-col items-end shrink-0 w-[52px]">
          <span className="font-mono text-[11px] text-[var(--text-muted)] leading-none">{time}</span>
          <span className="font-mono text-[9px] text-[var(--text-muted)] leading-none mt-0.5">{date}</span>
        </div>

        {/* Category tag */}
        <div className="shrink-0">
          <span
            className={[
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold border border-[var(--border-subtle)] bg-[var(--bg-base)]",
              meta.color,
            ].join(" ")}
          >
            {meta.icon}
            {meta.label}
          </span>
        </div>

        {/* Message */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-[var(--text-secondary)] leading-tight font-['Space_Grotesk']">
            {log.message}
          </p>
          {log.botName && (
            <span className="text-[10px] text-[var(--text-muted)] mt-0.5 block font-mono">
              {log.botName} · {log.source}
            </span>
          )}
        </div>

        {/* Expand chevron */}
        {hasMeta && (
          <div className="shrink-0 text-[var(--text-muted)]">
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </div>
        )}
      </button>

      {/* Expanded metadata — terminal panel */}
      {expanded && hasMeta && (
        <div className="px-3 py-2 pl-[88px]">
          <pre className="text-[10px] text-[var(--text-muted)] font-mono whitespace-pre-wrap break-all bg-[var(--bg-base)] border border-[var(--border-subtle)] rounded-md p-2">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
// Filter chips
/* ------------------------------------------------------------------ */

const CATEGORIES: { key: ActivityLog["category"] | "all"; label: string }[] = [
  { key: "all", label: "ALL" },
  { key: "order", label: "ORD" },
  { key: "signal", label: "SIG" },
  { key: "trade", label: "TRD" },
  { key: "state", label: "STA" },
  { key: "alert", label: "ALR" },
];

/* ------------------------------------------------------------------ */
// Main component
/* ------------------------------------------------------------------ */

interface ActivityFeedProps {
  logs: ActivityLog[];
  connected?: boolean;
  onClear?: () => void;
  loading?: boolean;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  logs,
  connected,
  onClear,
  loading,
}) => {
  const [activeFilter, setActiveFilter] = useState<ActivityLog["category"] | "all">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered =
    activeFilter === "all"
      ? logs
      : logs.filter((l) => l.category === activeFilter);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filtered.length, autoScroll]);

  return (
    <div className="space-y-2">
      {/* Header — compact cockpit bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-px overflow-x-auto pb-1 scrollbar-hide bg-[var(--border-subtle)]">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActiveFilter(c.key)}
              className={[
                "shrink-0 px-2 py-1 text-[11px] font-semibold border-0 transition-colors",
                activeFilter === c.key
                  ? "bg-[var(--accent)] text-white"
                  : "bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface)]",
              ].join(" ")}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {connected !== undefined && (
            <span
              className={[
                "inline-flex items-center gap-1 text-[10px] font-semibold font-mono",
                connected ? "text-[var(--success)]" : "text-[var(--danger)]",
              ].join(" ")}
            >
              {connected ? (
                <>
                  <Wifi className="w-3 h-3" /> LIVE
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3" /> OFF
                </>
              )}
            </span>
          )}
          <label className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] cursor-pointer select-none font-semibold">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--primary)] focus:ring-0"
            />
            AUTO-SCROLL
          </label>
          {onClear && (
            <button
              onClick={onClear}
              className="text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors font-semibold uppercase tracking-wider"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Feed — dense grid */}
      <div
        ref={scrollRef}
        className="h-96 overflow-y-auto bg-[var(--border-subtle)] gap-px grid grid-cols-1 rounded-xl border border-[var(--border-subtle)] p-px"
      >
        {loading && filtered.length === 0 && (
          <div className="flex items-center justify-center h-full bg-[var(--bg-card)]">
            <span className="text-xs text-[var(--text-muted)] font-['Space_Grotesk'] font-semibold">
              Loading activity...
            </span>
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-1.5 bg-[var(--bg-card)]">
            <Bell className="w-5 h-5 text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)] font-['Space_Grotesk'] font-semibold">
              No activity yet.
            </span>
            <span className="text-[10px] text-[var(--text-muted)] font-mono">
              Start or interact with a bot to see live activity.
            </span>
          </div>
        )}

        {filtered.map((log) => (
          <ActivityRow key={log.id} log={log} />
        ))}
      </div>
    </div>
  );
};
