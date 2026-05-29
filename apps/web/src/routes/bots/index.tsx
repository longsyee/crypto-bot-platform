import { createRoute, Link } from "@tanstack/react-router";
import { useBots, useStartBot, useStopBot } from "../../hooks/use-api";
import { Play, Square, Plus } from "lucide-react";

export const Route = createRoute({
  path: "/bots",
  component: BotsPage,
});

function BotsPage() {
  const { data: bots, isLoading } = useBots();
  const startBot = useStartBot();
  const stopBot = useStopBot();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Bots</h1>
        <button className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Bot
        </button>
      </div>

      {isLoading && <p className="text-gray-400">Loading...</p>}

      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-left px-4 py-2">Mode</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Exchange</th>
                <th className="text-left px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {bots?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-gray-400">No bots yet.</td>
                </tr>
              )}
              {bots?.map((bot: any) => (
                <tr key={bot.id}>
                  <td className="px-4 py-2">
                    <Link
                      to={`/bots/${bot.id}`}
                      className="text-blue-400 hover:underline"
                    >
                      {bot.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 capitalize">{bot.type}</td>
                  <td className="px-4 py-2 capitalize">{bot.mode}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        bot.status === "running"
                          ? "bg-green-900/40 text-green-400"
                          : bot.status === "stopped"
                          ? "bg-gray-700 text-gray-300"
                          : "bg-yellow-900/40 text-yellow-400"
                      }`}
                    >
                      {bot.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{bot.connection?.exchangeId || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      {bot.status !== "running" && (
                        <button
                          onClick={() => startBot.mutate(bot.id)}
                          className="p-1.5 rounded bg-green-700 hover:bg-green-600 text-white"
                          title="Start"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      {bot.status === "running" && (
                        <button
                          onClick={() => stopBot.mutate(bot.id)}
                          className="p-1.5 rounded bg-red-700 hover:bg-red-600 text-white"
                          title="Stop"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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
