import { createRoute } from "@tanstack/react-router";
import { useMe, useBots, useWallet, useTransactions } from "../hooks/use-api";

export const Route = createRoute({
  path: "/dashboard",
  component: DashboardPage,
});

function DashboardPage() {
  const { data: me } = useMe();
  const { data: bots } = useBots();
  const { data: wallet } = useWallet();
  const { data: txPage } = useTransactions();

  const activeBots = bots?.filter((b: any) => b.status === "running").length || 0;
  const recentTx = txPage?.data?.slice(0, 5) || [];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Token Balance</p>
          <p className="text-2xl font-bold">{wallet?.tokenBalance ?? 0}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Active Bots</p>
          <p className="text-2xl font-bold">{activeBots}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">USDT Balance</p>
          <p className="text-2xl font-bold">{wallet?.usdtBalance ?? 0}</p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-700 font-medium">Recent Transactions</div>
        <div className="divide-y divide-gray-700">
          {recentTx.length === 0 && (
            <div className="px-4 py-3 text-gray-400 text-sm">No transactions yet.</div>
          )}
          {recentTx.map((tx: any) => (
            <div key={tx.id} className="px-4 py-3 flex justify-between items-center">
              <div className="text-sm">
                <span className="capitalize font-medium">{tx.type}</span>
                <span className="text-gray-400 ml-2">{tx.currency}</span>
              </div>
              <div className="text-sm font-medium">{tx.amount}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
