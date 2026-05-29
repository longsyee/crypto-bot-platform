import { createRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useBots } from "../../hooks/use-api";

export const Route = createRoute({
  path: "/bots/$botId",
  component: BotDetailPage,
});

function BotDetailPage() {
  const { botId } = Route.useParams();
  const { data: bots } = useBots();
  const bot = bots?.find((b: any) => b.id === botId);

  const [configJson, setConfigJson] = useState(() =>
    bot?.config ? JSON.stringify(bot.config, null, 2) : "{}"
  );

  if (!bot) {
    return (
      <div className="text-gray-400">Bot not found.</div>
    );
  }

  const orders = bot.orders || [];
  const logs = bot.logs || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{bot.name}</h1>
        <span
          className={`px-2 py-0.5 rounded text-xs ${
            bot.status === "running"
              ? "bg-green-900/40 text-green-400"
              : "bg-gray-700 text-gray-300"
          }`}
        >
          {bot.status}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <h2 className="font-medium mb-3">Config (JSON)</h2>
          <textarea
            value={configJson}
            onChange={(e) => setConfigJson(e.target.value)}
            className="w-full h-48 bg-gray-900 border border-gray-700 rounded p-3 font-mono text-sm text-white focus:outline-none focus:border-blue-500"
          />
          <div className="mt-2 flex gap-2">
            <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm text-white">
              Save
            </button>
            <button
              onClick={() =>
                setConfigJson(
                  bot?.config ? JSON.stringify(bot.config, null, 2) : "{}"
                )
              }
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 p-4 rounded-lg">
          <h2 className="font-medium mb-3">Chart Placeholder</h2>
          <div className="h-48 bg-gray-900 border border-gray-700 rounded flex items-center justify-center text-gray-500 text-sm">
            Chart will be rendered here
          </div>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-700 font-medium">Orders</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left px-4 py-2">Symbol</th>
                <th className="text-left px-4 py-2">Side</th>
                <th className="text-left px-4 py-2">Amount</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-gray-400">No orders yet.</td>
                </tr>
              )}
              {orders.map((o: any) => (
                <tr key={o.id}>
                  <td className="px-4 py-2">{o.symbol}</td>
                  <td className="px-4 py-2 capitalize">{o.side}</td>
                  <td className="px-4 py-2">{o.amount}</td>
                  <td className="px-4 py-2">{o.status}</td>
                  <td className="px-4 py-2 text-gray-400">
                    {new Date(o.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-800 border border-gray-700 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-700 font-medium">Logs</div>
        <div className="h-48 overflow-auto p-2 space-y-1">
          {logs.length === 0 && (
            <div className="text-gray-400 text-sm px-2 py-1">No logs yet.</div>
          )}
          {logs.map((log: any) => (
            <div
              key={log.id}
              className="text-sm px-2 py-1 font-mono rounded bg-gray-900"
            >
              <span className="text-gray-500">{new Date(log.createdAt).toLocaleTimeString()}</span>{" "}
              <span
                className={`font-semibold ${
                  log.level === "error"
                    ? "text-red-400"
                    : log.level === "warn"
                    ? "text-yellow-400"
                    : "text-green-400"
                }`}
              >
                {log.level.toUpperCase()}
              </span>
              {" "}
              <span className="text-gray-300">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
