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
        return "bg-[var(--success-glow)] text-[var(--success)] border border-[var(--success)]/20";
      case "stopped":
        return "bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]";
      case "error":
        return "bg-[var(--warning-glow)] text-[var(--warning)] border border-[var(--warning)]/20";
      default:
        return "bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]";
    }
  };

  return (
    <PageWrapper>
      <div className="space-y-5">
        <div className="gsap-section flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-3xl font-bold text-[var(--text-primary)] font-['Space_Grotesk']">Bots</h1>
          <Link
            to="/bots/create"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-[var(--primary)] text-[var(--text-invert)] hover:brightness-110 shadow-[0_0_20px_var(--primary-glow)] transition-all hover:-translate-y-[1px]"
          >
            <Plus className="w-4 h-4" />
            Create Bot
          </Link>
        </div>

        <div className="gsap-section flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 border-b border-[var(--border-subtle)]">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab.value
                    ? "text-[var(--primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
                {activeTab === tab.value && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--primary)] rounded-full shadow-[0_0_6px_var(--primary-glow)]" />
                )}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder="Search bots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 pl-9 pr-3 py-2 rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition-all"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="gsap-section bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl p-8 text-center text-[var(--text-muted)]">
            Loading bots...
          </div>
        ) : (
          <div className="gsap-section bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-[var(--shadow-sm)]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                    <th className="text-left px-4 py-3 font-medium">Name</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Mode</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Exchange</th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredBots.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center">
                        <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
                          <Bot className="w-10 h-10 mb-3 opacity-50" />
                          <p className="text-sm font-medium">No bots found</p>
                          <p className="text-xs mt-1 text-[var(--text-muted)]/60">
                            {searchQuery || activeTab !== "all"
                              ? "Try adjusting your search or filters."
                              : "Get started by creating your first bot."}
                          </p>
                          {!searchQuery && activeTab === "all" && (
                            <Link
                              to="/bots/create"
                              className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] hover:brightness-110 text-[var(--text-invert)] transition-all"
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
                    <tr key={bot.id} className="bot-row hover:bg-[var(--bg-hover)]/50 transition-colors">
                      <td className="px-4 py-3">
                        <Link
                          to={`/bots/${bot.id}` as any}
                          className="text-[var(--primary)] hover:underline font-medium"
                        >
                          {bot.name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{bot.type}</td>
                      <td className="px-4 py-3 capitalize text-[var(--text-secondary)]">{bot.mode}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusClass(
                            bot.status
                          )}`}
                        >
                          {bot.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">
                        {bot.connection?.exchangeId || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {bot.status !== "running" && (
                            <button
                              onClick={() => startBot.mutate(bot.id)}
                              disabled={startBot.isPending}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--success)] hover:brightness-110 text-[var(--text-invert)] transition-all disabled:opacity-50"
                              title="Start"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                          {bot.status === "running" && (
                            <button
                              onClick={() => stopBot.mutate(bot.id)}
                              disabled={stopBot.isPending}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--danger)] hover:brightness-110 text-[var(--text-invert)] transition-all disabled:opacity-50"
                              title="Stop"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setBotToDelete(bot)}
                            disabled={bot.status === "running" || deleteBot.isPending}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--bg-hover)] hover:bg-[var(--danger-glow)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors disabled:opacity-50 disabled:hover:bg-[var(--bg-hover)]"
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
