import { createRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useWallet, useTransactions, useConvert } from "../hooks/use-api";
import { Copy, Check } from "lucide-react";

export const Route = createRoute({
  path: "/wallet",
  component: WalletPage,
});

function WalletPage() {
  const { data: wallet } = useWallet();
  const { data: txPage } = useTransactions();
  const convert = useConvert();

  const [copied, setCopied] = useState(false);
  const [convertAmount, setConvertAmount] = useState("");
  const [convertDirection, setConvertDirection] = useState("usdt_to_token");

  const depositAddress = wallet?.bscAddress || "—";

  function handleCopy() {
    if (depositAddress !== "—") {
      navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    convert.mutate({
      amount: parseFloat(convertAmount),
      direction: convertDirection,
    });
    setConvertAmount("");
  }

  const txs = txPage?.data || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Wallet</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Token Balance</p>
          <p className="text-2xl font-bold">{wallet?.tokenBalance ?? 0}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">USDT Balance</p>
          <p className="text-2xl font-bold">{wallet?.usdtBalance ?? 0}</p>
        </div>
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Total Deposited</p>
          <p className="text-2xl font-bold">{wallet?.totalDeposited ?? 0}</p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
        <h2 className="font-medium mb-3">Deposit Address (BSC)</h2>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono truncate">
            {depositAddress}
          </div>
          <button
            onClick={handleCopy}
            className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
        <h2 className="font-medium mb-3">Convert</h2>
        <form onSubmit={handleConvert} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Amount</label>
            <input
              type="number"
              step="0.00000001"
              value={convertAmount}
              onChange={(e) => setConvertAmount(e.target.value)}
              className="w-full p-2 rounded bg-gray-900 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Direction</label>
            <select
              value={convertDirection}
              onChange={(e) => setConvertDirection(e.target.value)}
              className="p-2 rounded bg-gray-900 border border-gray-700 text-white"
            >
              <option value="usdt_to_token">USDT → Token</option>
              <option value="token_to_usdt">Token → USDT</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-medium"
          >
            Convert
          </button>
        </form>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-700 font-medium">Transaction History</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Amount</th>
                <th className="text-left px-4 py-2">Currency</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {txs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-gray-400">No transactions yet.</td>
                </tr>
              )}
              {txs.map((tx: any) => (
                <tr key={tx.id}>
                  <td className="px-4 py-2 capitalize">{tx.type}</td>
                  <td className="px-4 py-2">{tx.amount}</td>
                  <td className="px-4 py-2">{tx.currency}</td>
                  <td className="px-4 py-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{tx.status}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-400">{new Date(tx.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
