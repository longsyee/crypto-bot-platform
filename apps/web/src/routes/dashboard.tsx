import { createFileRoute } from "@tanstack/react-router";
import { useMe, useBots, useWallet, useTransactions } from "../hooks/use-api";
import { PageWrapper } from "../components/layout/page-wrapper";
import { ActivityFeed } from "../components/bots/activity-feed";
import { useActivityStream } from "../hooks/use-activity";
import {
  Bot,
  Wallet,
  ArrowRightLeft,
  TrendingUp,
  Activity,
  AlertCircle,
  Radio,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: me } = useMe();
  const { data: bots } = useBots();
  const { data: wallet } = useWallet();
  const { data: txPage } = useTransactions();

  const activeBots = bots?.filter((b: any) => b.status === "running").length || 0;
  const totalBots = bots?.length || 0;
  const recentTx = txPage?.slice(0, 5) || [];
  const { logs: allActivity, connected: activityConnected, clear: clearActivity } = useActivityStream();

  const stats = [
    {
      label: "Token Balance",
      value: typeof wallet?.tokenBalance === "number" ? wallet.tokenBalance.toFixed(4) : "0.0000",
      icon: Wallet,
      accent: "border-t-[var(--primary)]",
      text: "text-[var(--primary)]",
      suffix: "",
    },
    {
      label: "USDT Balance",
      value: typeof wallet?.usdtBalance === "number" ? wallet.usdtBalance.toFixed(4) : "0.0000",
      icon: ArrowRightLeft,
      accent: "border-t-[var(--success)]",
      text: "text-[var(--success)]",
      suffix: " USDT",
    },
    {
      label: "Active Bots",
      value: `${activeBots} / ${totalBots}`,
      icon: Bot,
      accent: "border-t-[var(--primary)]",
      text: "text-[var(--primary)]",
      suffix: "",
    },
    {
      label: "Total Deposited",
      value: typeof wallet?.totalDeposited === "number" ? wallet.totalDeposited.toFixed(4) : "0.0000",
      icon: TrendingUp,
      accent: "border-t-[var(--accent)]",
      text: "text-[var(--accent)]",
      suffix: "",
    },
  ];

  return (
    <PageWrapper>
      <div className="space-y-4 max-w-6xl">
        {/* Header */}
        <div className="gsap-section">
          <h1 className="text-xl font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">
            Dashboard
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mt-1">
            Overview of your trading activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="gsap-section grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-[var(--border-subtle)]">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className={`relative bg-[var(--bg-card)] border-t-2 ${stat.accent} p-3`}
            >
              <div className="flex items-center gap-2 mb-2">
                <stat.icon className={`w-4 h-4 ${stat.text}`} />
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                  {stat.label}
                </p>
              </div>
              <p className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)] font-mono">
                {stat.value}
                <span className="text-xs text-[var(--text-muted)] font-normal ml-1 font-mono">
                  {stat.suffix}
                </span>
              </p>
            </div>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="gsap-section bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--text-muted)]" />
              <h2 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                Recent Transactions
              </h2>
            </div>
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              {recentTx.length} shown
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    Type
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    Amount
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    Currency
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    Status
                  </th>
                  <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold hidden sm:table-cell">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {recentTx.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-[var(--text-muted)]" />
                        <p className="text-xs text-[var(--text-muted)]">No transactions yet.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {recentTx.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-[var(--bg-hover)]/50 transition-colors">
                    <td className="px-3 py-2 text-xs">
                      <span className="capitalize text-[var(--text-secondary)] font-medium">{tx.type}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--text-primary)] font-medium font-mono">
                      {tx.amount}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)] font-mono">
                        {tx.currency}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      <TxBadge status={tx.status} />
                    </td>
                    <td className="px-3 py-2 text-[var(--text-muted)] text-xs hidden sm:table-cell font-mono">
                      {new Date(tx.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="gsap-section bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[var(--text-muted)]" />
              <h2 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                Live Activity
              </h2>
            </div>
          </div>
          <div className="p-4">
            <ActivityFeed
              logs={allActivity}
              connected={activityConnected}
              onClear={clearActivity}
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="gsap-section grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[var(--border-subtle)]">
          <QuickActionCard
            title="Create Trading Bot"
            description="Set up a new DCA or signal bot"
            icon={Bot}
            to="/bots/create"
            accent="text-[var(--primary)]"
            hover="hover:bg-[var(--primary-glow)]"
            border="border-t-[var(--primary)]"
          />
          <QuickActionCard
            title="Connect Exchange"
            description="Link a new exchange API"
            icon={ArrowRightLeft}
            to="/exchange-connections"
            accent="text-[var(--success)]"
            hover="hover:bg-[var(--success-glow)]"
            border="border-t-[var(--success)]"
          />
          <QuickActionCard
            title="DCA Simulator"
            description="Calculate your DCA strategy"
            icon={TrendingUp}
            to="/calculator"
            accent="text-[var(--accent)]"
            hover="hover:bg-[var(--accent)]/[0.03]"
            border="border-t-[var(--accent)]"
          />
        </div>
      </div>
    </PageWrapper>
  );
}

function TxBadge({ status }: { status: string }) {
  const s =
    status === "pending"
      ? "pending"
      : status === "completed" || status === "confirmed"
      ? "completed"
      : status === "failed"
      ? "failed"
      : "pending";

  const map = {
    pending: {
      bg: "bg-[var(--warning-glow)]",
      text: "text-[var(--warning)]",
      border: "border-[var(--warning)]/20",
      dot: "bg-[var(--warning)]",
      label: "Pending",
    },
    completed: {
      bg: "bg-[var(--success-glow)]",
      text: "text-[var(--success)]",
      border: "border-[var(--success)]/20",
      dot: "bg-[var(--success)]",
      label: "Completed",
    },
    failed: {
      bg: "bg-[var(--danger-glow)]",
      text: "text-[var(--danger)]",
      border: "border-[var(--danger)]/20",
      dot: "bg-[var(--danger)]",
      label: "Failed",
    },
  };

  const c = map[s];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${c.bg} ${c.text} ${c.border}`}
    >
      <span className={`h-1 w-1 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  to,
  accent,
  hover,
  border,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  to: string;
  accent: string;
  hover: string;
  border: string;
}) {
  return (
    <a
      href={to}
      className={`group relative bg-[var(--bg-card)] border-t-2 ${border} p-3 transition-colors ${hover}`}
    >
      <div className="flex items-start gap-2">
        <div className="w-8 h-8 rounded-md bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
          <Icon className={`w-4 h-4 ${accent}`} />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-medium text-[var(--text-primary)] group-hover:text-[var(--text-secondary)] transition-colors font-['Space_Grotesk']">
            {title}
          </h3>
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mt-0.5">
            {description}
          </p>
        </div>
      </div>
    </a>
  );
}
