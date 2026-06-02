import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useBots, useStartBot, useStopBot, useDeleteBot } from "../../hooks/use-api";
import { PageWrapper } from "../../components/layout/page-wrapper";
import { Play, Square, Plus, Search, Bot, Trash2 } from "lucide-react";
import ConfirmModal from "../../components/ui/confirm-modal";

export const Route = createFileRoute("/bots/")({
  component: BotsPage,
});

type TabValue = "all" | "running" | "stopped";

function BotsPage() {
  const { data: bots, isLoading } = useBots();
  const startBot = useStartBot();
  const stopBot = useStopBot();
  const deleteBot = useDeleteBot();

  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [botToDelete, setBotToDelete] = useState<any | null>(null);

  const filteredBots = useMemo(() => {
    let result = bots || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((b: any) => b.name?.toLowerCase().includes(q));
    }
    if (activeTab !== "all") {
      result = result.filter((b: any) => b.status === activeTab);
    }
    return result;
  }, [bots, searchQuery, activeTab]);

  const tabs: { value: TabValue; label: string }[] = [
    { value: "all", label: "All" },
    { value: "running", label: "Running" },
    { value: "stopped", label: "Stopped" },
  ];

  const statusClass = (status: string) => {
    switch (status) {
      case "running":
        return "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800";
      case "stopped":
        return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600";
      case "error":
        return "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600";
    }
  };

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="gsap-section flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold">Bots</h1>
          <Link
            to="/bots/create"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:from-blue-500 hover:to-blue-400 shadow-lg shadow-blue-500/20 dark:shadow-blue-900/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Bot
          </Link>
        </div>

        <div className="gsap-section flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 border-b border-gray-200/50 dark:border-gray-700/50">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                }`}
              >
                {tab.label}
                {activeTab === tab.value && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 dark:text-gray-400" />
            <input
              type="text"
              placeholder="Search bots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="gsap-section bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400">
            Loading bots...
          </div>
        ) : (
          <div className="gsap-section bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Mode</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Exchange</th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredBots.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                          <Bot className="w-10 h-10 mb-3 opacity-50" />
                          <p className="text-sm font-medium">No bots found</p>
                          <p className="text-xs mt-1 text-gray-400 dark:text-gray-500">
                            {searchQuery || activeTab !== "all"
                              ? "Try adjusting your search or filters."
                              : "Get started by creating your first bot."}
                          </p>
                          {!searchQuery && activeTab === "all" && (
                            <Link
                              to="/bots/create"
                              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                              Create Bot
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {filteredBots.map((bot: any) => (
                    <tr key={bot.id} className="bot-row hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          to={`/bots/${bot.id}` as any}
                          className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          {bot.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-700 dark:text-gray-300">{bot.type}</td>
                      <td className="px-4 py-3 capitalize text-gray-700 dark:text-gray-300">{bot.mode}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusClass(
                            bot.status
                          )}`}
                        >
                          {bot.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                        {bot.connection?.exchangeId || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {bot.status !== "running" && (
                            <button
                              onClick={() => startBot.mutate(bot.id)}
                              disabled={startBot.isPending}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-green-600 dark:bg-green-700 hover:bg-green-500 dark:hover:bg-green-600 text-white transition-colors disabled:opacity-50"
                              title="Start"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {bot.status === "running" && (
                            <button
                              onClick={() => stopBot.mutate(bot.id)}
                              disabled={stopBot.isPending}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-red-600 dark:bg-red-700 hover:bg-red-500 dark:hover:bg-red-600 text-white transition-colors disabled:opacity-50"
                              title="Stop"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setBotToDelete(bot)}
                            disabled={bot.status === "running" || deleteBot.isPending}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-gray-200 dark:bg-gray-700 hover:bg-red-500 dark:hover:bg-red-600 text-gray-700 dark:text-white transition-colors disabled:opacity-50 disabled:hover:bg-gray-200 dark:disabled:hover:bg-gray-700"
                            title={bot.status === "running" ? "Stop bot before deleting" : "Delete"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!botToDelete}
        title="Delete Bot"
        message={
          botToDelete
            ? `Are you sure you want to delete "${botToDelete.name}"? This action cannot be undone and all associated orders, logs, and trades will be permanently removed.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {
          if (botToDelete) {
            deleteBot.mutate(botToDelete.id, {
              onSuccess: () => setBotToDelete(null),
            });
          }
        }}
        onCancel={() => setBotToDelete(null)}
      />
    </PageWrapper>
  );
}
