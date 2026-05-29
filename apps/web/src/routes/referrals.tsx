import { createRoute } from "@tanstack/react-router";
import { useReferrals } from "../hooks/use-api";
import { useAuth } from "../hooks/use-auth";
import { Copy, Check } from "lucide-react";
import { useState } from "react";

export const Route = createRoute({
  path: "/referrals",
  component: ReferralsPage,
});

function ReferralsPage() {
  const { data } = useReferrals();
  const user = useAuth((s) => s.user);
  const [copied, setCopied] = useState(false);

  const referralCode = data?.referralCode || user?.referralCode || "—";

  function handleCopy() {
    if (referralCode !== "—") {
      navigator.clipboard.writeText(referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const referrals = data?.myReferrals || [];
  const earnings = data?.totalEarnings || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Referrals</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Referral Code</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm font-mono">
              {referralCode}
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
          <p className="text-gray-400 text-sm">Referred Users</p>
          <p className="text-2xl font-bold">{referrals.length}</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <p className="text-gray-400 text-sm">Total Earnings</p>
          <p className="text-2xl font-bold">{earnings} TOKEN</p>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-700 font-medium">Referred Users</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left px-4 py-2">Email</th>
                <th className="text-left px-4 py-2">Tier</th>
                <th className="text-left px-4 py-2">Commission Rate</th>
                <th className="text-left px-4 py-2">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {referrals.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-gray-400">No referred users yet.</td>
                </tr>
              )}
              {referrals.map((ref: any) => (
                <tr key={ref.id}>
                  <td className="px-4 py-2">{ref.referredUser?.email || "—"}</td>
                  <td className="px-4 py-2 capitalize">{ref.tier}</td>
                  <td className="px-4 py-2">{(ref.commissionRate * 100).toFixed(0)}%</td>
                  <td className="px-4 py-2 text-gray-400">
                    {new Date(ref.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
