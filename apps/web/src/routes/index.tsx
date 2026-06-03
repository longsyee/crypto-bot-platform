import { createFileRoute } from "@tanstack/react-router";
import { useMe, useBots, useWallet, useTransactions } from "../hooks/use-api";
import { PageWrapper } from "../components/layout/page-wrapper";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});

function DashboardPage() {
  const { data: bots } = useBots();
  const { data: wallet } = useWallet();
  const { data: txPage } = useTransactions();

  const activeBots = bots?.filter((b: any) => b.status === "running").length || 0;
  const recentTx = txPage?.slice(0, 5) || [];

  return (
    <PageWrapper>
      <div className="gsap-section">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 rounded-lg">
            <p className="text-[var(--text-muted)] text-sm">Token Balance</p>
            <p className="text-2xl font-bold">{wallet?.tokenBalance ?? 0}</p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 rounded-lg">
            <p className="text-[var(--text-muted)] text-sm">Active Bots</p>
            <p className="text-2xl font-bold">{activeBots}</p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] p-4 rounded-lg">
            <p className="text-[var(--text-muted)] text-sm">USDT Balance</p>
            <p className="text-2xl font-bold">{wallet?.usdtBalance ?? 0}</p>
          </div>
        </div>
      </div>

      <div className="gsap-section bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-lg">
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] font-medium">Recent Transactions</div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {recentTx.length === 0 && (
            <div className="px-4 py-3 text-[var(--text-muted)] text-sm">No transactions yet.</div>
          )}
          {recentTx.map((tx: any) => (
            <div key={tx.id} className="px-4 py-3 flex flex-wrap justify-between items-center gap-2">
              <div className="text-sm">
                <span className="capitalize font-medium">{tx.type}</span>
                <span className="text-[var(--text-muted)] ml-2">{tx.currency}</span>
              </div>
              <div className="text-sm font-medium">{tx.amount}</div>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
