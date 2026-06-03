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
      accent: "text-[var(--primary)]",
      bg: "bg-[var(--primary-glow)]",
      border: "border-[var(--primary)]/20",
      suffix: "",
    },
    {
      label: "USDT Balance",
      value: typeof wallet?.usdtBalance === "number" ? wallet.usdtBalance.toFixed(4) : "0.0000",
      icon: ArrowRightLeft,
      accent: "text-[var(--success)]",
      bg: "bg-[var(--success-glow)]",
      border: "border-[var(--success)]/20",
      suffix: " USDT",
    },
    {
      label: "Active Bots",
      value: `${activeBots} / ${totalBots}`,
      icon: Bot,
      accent: "text-[var(--primary)]",
      bg: "bg-[var(--primary-glow)]",
      border: "border-[var(--primary)]/20",
      suffix: "",
    },
    {
      label: "Total Deposited",
      value: typeof wallet?.totalDeposited === "number" ? wallet.totalDeposited.toFixed(4) : "0.0000",
      icon: TrendingUp,
      accent: "text-[var(--accent)]",
      bg: "bg-[var(--accent)]/10",
      border: "border-[var(--accent)]/20",
      suffix: "",
    },
  ];

  return (
    <PageWrapper>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="gsap-section">
          <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Overview of your trading activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="gsap-section grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="relative rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] backdrop-blur-xl p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-[1px] transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-10 h-10 rounded-xl ${stat.bg} border ${stat.border} flex items-center justify-center shrink-0`}
                >
                  <stat.icon className={`w-5 h-5 ${stat.accent}`} />
                </div>
                <p className="text-xs text-[var(--text-muted)] font-medium">{stat.label}</p>
              </div>
              <p className="text-2xl font-semibold text-[var(--text-primary)]">
                {stat.value}
                <span className="text-sm text-[var(--text-muted)] font-normal ml-1">{stat.suffix}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="gsap-section relative rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] backdrop-blur-xl overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--text-muted)]" />
              <h2 className="text-sm font-medium text-[var(--text-secondary)]">Recent Transactions</h2>
            </div>
            <span className="text-xs text-[var(--text-muted)]">{recentTx.length} shown</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Currency</th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {recentTx.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="w-6 h-6 text-[var(--text-muted)]" />
                        <p className="text-sm text-[var(--text-muted)]">No transactions yet.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {recentTx.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-[var(--bg-hover)]/50 transition-colors">
                    <td className="px-5 py-3">
                      <span className="capitalize text-[var(--text-secondary)] font-medium">{tx.type}</span>
                    </td>
                    <td className="px-5 py-3 text-[var(--text-primary)] font-medium">{tx.amount}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]">{tx.currency}</span>
                    </td>
                    <td className="px-5 py-3">
                      <TxBadge status={tx.status} />
                    </td>
                    <td className="px-5 py-3 text-[var(--text-muted)] text-xs hidden sm:table-cell">
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
        <div className="gsap-section relative rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] backdrop-blur-xl overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[var(--text-muted)]" />
              <h2 className="text-sm font-medium text-[var(--text-secondary)]">Live Activity</h2>
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
        <div className="gsap-section grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            title="Create Trading Bot"
            description="Set up a new DCA or signal bot"
            icon={Bot}
            to="/bots/create"
            accent="text-[var(--primary)]"
            hover="hover:border-[var(--primary)]/30 hover:bg-[var(--primary-glow)]"
          />
          <QuickActionCard
            title="Connect Exchange"
            description="Link a new exchange API"
            icon={ArrowRightLeft}
            to="/exchange-connections"
            accent="text-[var(--success)]"
            hover="hover:border-[var(--success)]/30 hover:bg-[var(--success-glow)]"
          />
          <QuickActionCard
            title="DCA Simulator"
            description="Calculate your DCA strategy"
            icon={TrendingUp}
            to="/calculator"
            accent="text-[var(--accent)]"
            hover="hover:border-[var(--accent)]/30 hover:bg-[var(--accent)]/[0.03]"
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${c.bg} ${c.text} ${c.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
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
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  to: string;
  accent: string;
  hover: string;
}) {
  return (
    <a
      href={to}
      className={`group relative rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] backdrop-blur-xl p-5 transition-all duration-200 shadow-[var(--shadow-sm)] ${hover} hover:-translate-y-[1px]`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <Icon className={`w-5 h-5 ${accent}`} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--text-secondary)] transition-colors">
            {title}
          </h3>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{description}</p>
        </div>
      </div>
    </a>
  );
}
