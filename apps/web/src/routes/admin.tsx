import { createRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  useAdminDashboard,
  useAdminUsers,
  useAdminBots,
} from "../hooks/use-api";

export const Route = createRoute({
  path: "/admin",
  component: AdminPage,
});

type Tab = "users" | "bots" | "health";

function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  const { data: dash } = useAdminDashboard();
  const { data: usersPage } = useAdminUsers();
  const { data: bots } = useAdminBots();

  const users = usersPage?.data || [];

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Admin</h1>

      <div className="flex gap-2">
        {(["users", "bots", "health"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded text-sm font-medium ${
              tab === t
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-300 hover:bg-gray-700"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-700 font-medium">
            Users ({usersPage?.meta?.total || 0})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left px-4 py-2">Email</th>
                  <th className="text-left px-4 py-2">Role</th>
                  <th className="text-left px-4 py-2">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {users.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-gray-400">No users.</td>
                  </tr>
                )}
                {users.map((u: any) => (
                  <tr key={u.id}>
                    <td className="px-4 py-2">{u.email}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-700">{u.role}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "bots" && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-700 font-medium">
            All Bots ({bots?.length || 0})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">User</th>
                  <th className="text-left px-4 py-2">Exchange</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {bots?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-gray-400">No bots.</td>
                  </tr>
                )}
                {bots?.map((bot: any) => (
                  <tr key={bot.id}>
                    <td className="px-4 py-2">{bot.name}</td>
                    <td className="px-4 py-2">{bot.user?.email || "—"}</td>
                    <td className="px-4 py-2">{bot.connection?.exchangeId || "—"}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          bot.status === "running"
                            ? "bg-green-900/40 text-green-400"
                            : "bg-gray-700 text-gray-300"
                        }`}
                      >
                        {bot.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 capitalize">{bot.mode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "health" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Total Users</p>
            <p className="text-2xl font-bold">{dash?.totalUsers ?? 0}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Total Bots</p>
            <p className="text-2xl font-bold">{dash?.totalBots ?? 0}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Active Bots</p>
            <p className="text-2xl font-bold">{dash?.activeBots ?? 0}</p>
          </div>
          <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
            <p className="text-gray-400 text-sm">Total Fees</p>
            <p className="text-2xl font-bold">{dash?.totalFees ?? 0}</p>
          </div>
        </div>
      )}
    </div>
  );
}
