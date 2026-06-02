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
  const recentTx = txPage?.data?.slice(0, 5) || [];
  const { logs: allActivity, connected: activityConnected, clear: clearActivity } = useActivityStream();

  const stats = [
    {
      label: "Token Balance",
      value: typeof wallet?.tokenBalance === "number" ? wallet.tokenBalance.toFixed(4) : "0.0000",
      icon: <Wallet className="w-5 h-5 text-teal-600 dark:text-teal-400" />,
      bg: "bg-teal-500/10",
      border: "border-teal-500/20",
      suffix: "",
    },
    {
      label: "USDT Balance",
      value: typeof wallet?.usdtBalance === "number" ? wallet.usdtBalance.toFixed(4) : "0.0000",
      icon: <ArrowRightLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />,
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      suffix: " USDT",
    },
    {
      label: "Active Bots",
      value: `${activeBots} / ${totalBots}`,
      icon: <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />,
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      suffix: "",
    },
    {
      label: "Total Deposited",
      value: typeof wallet?.totalDeposited === "number" ? wallet.totalDeposited.toFixed(4) : "0.0000",
      icon: <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />,
      bg: "bg-purple-500/10",
      border: "border-purple-500/20",
      suffix: "",
    },
  ];

  return (
    <PageWrapper>
      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="gsap-section">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 dark:text-white font-['Space_Grotesk'] tracking-tight">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Overview of your trading activity
          </p>
        </div>

        {/* Stats Grid */}
        <div className="gsap-section grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="relative rounded-2xl bg-white dark:bg-[#13161f]/80 border border-gray-200/50 dark:border-white/[0.06] backdrop-blur-xl p-5 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`w-10 h-10 rounded-xl ${stat.bg} border ${stat.border} flex items-center justify-center shrink-0`}
                >
                  {stat.icon}
                </div>
                <p className="text-xs text-slate-500 font-medium">{stat.label}</p>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {stat.value}
                <span className="text-sm text-slate-500 font-normal ml-1">{stat.suffix}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="gsap-section relative rounded-2xl bg-white dark:bg-[#13161f]/80 border border-gray-200/50 dark:border-white/[0.06] backdrop-blur-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200/50 dark:border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">Recent Transactions</h2>
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-600">{recentTx.length} shown</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="text-slate-500 border-b border-gray-200/50 dark:border-white/[0.06]">
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Currency</th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200/50 dark:divide-white/[0.04]">
                {recentTx.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="w-6 h-6 text-slate-400 dark:text-slate-600" />
                        <p className="text-sm text-slate-500">No transactions yet.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {recentTx.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <span className="capitalize text-slate-700 dark:text-slate-300 font-medium">{tx.type}</span>
                    </td>
                    <td className="px-5 py-3 text-gray-900 dark:text-white font-medium">{tx.amount}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 border border-gray-200/50 dark:border-white/[0.06]">{tx.currency}</span>
                    </td>
                    <td className="px-5 py-3">
                      <TxBadge status={tx.status} />
                    </td>
                    <td className="px-5 py-3 text-slate-500 text-xs hidden sm:table-cell">
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
        <div className="gsap-section relative rounded-2xl bg-white dark:bg-[#13161f]/80 border border-gray-200/50 dark:border-white/[0.06] backdrop-blur-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-200/50 dark:border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-medium text-slate-700 dark:text-slate-300">Live Activity</h2>
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
            icon={<Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />}
            to="/bots/create"
            color="blue"
          />
          <QuickActionCard
            title="Connect Exchange"
            description="Link a new exchange API"
            icon={<ArrowRightLeft className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />}
            to="/exchange-connections"
            color="emerald"
          />
          <QuickActionCard
            title="DCA Simulator"
            description="Calculate your DCA strategy"
            icon={<TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />}
            to="/calculator"
            color="purple"
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
      bg: "bg-amber-500/10",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-500/20",
      dot: "bg-amber-500 dark:bg-amber-400",
      label: "Pending",
    },
    completed: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-500/20",
      dot: "bg-emerald-500 dark:bg-emerald-400",
      label: "Completed",
    },
    failed: {
      bg: "bg-red-500/10",
      text: "text-red-700 dark:text-red-400",
      border: "border-red-500/20",
      dot: "bg-red-500 dark:bg-red-400",
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
  icon,
  to,
  color,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  to: string;
  color: "blue" | "emerald" | "purple";
}) {
  const colorMap = {
    blue: "hover:border-blue-500/30 hover:bg-blue-500/[0.03]",
    emerald: "hover:border-emerald-500/30 hover:bg-emerald-500/[0.03]",
    purple: "hover:border-purple-500/30 hover:bg-purple-500/[0.03]",
  };

  return (
    <a
      href={to}
      className={`group relative rounded-2xl bg-white dark:bg-[#13161f]/80 border border-gray-200/50 dark:border-white/[0.06] backdrop-blur-xl p-5 transition-all duration-200 shadow-sm ${colorMap[color]}`}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.08] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-gray-700 dark:group-hover:text-slate-200 transition-colors">
            {title}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>
    </a>
  );
}
