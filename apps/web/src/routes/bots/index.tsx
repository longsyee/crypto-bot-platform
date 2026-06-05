import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useBots, useStartBot, useStopBot, useDeleteBot } from "../../hooks/use-api";
import { PageWrapper } from "../../components/layout/page-wrapper";
import { Play, Square, Plus, Search, Bot, Trash2 } from "lucide-react";
import ConfirmModal from "../../components/ui/confirm-modal";
import { useI18n } from "../../hooks/use-i18n";

export const Route = createFileRoute("/bots/")({
  component: BotsPage,
});

type TabValue = "all" | "running" | "stopped";

function BotsPage() {
  const { t } = useI18n();
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
    { value: "all", label: t("activity.all") },
    { value: "running", label: t("bots.running") },
    { value: "stopped", label: t("bots.stopped") },
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
      <div className="flex flex-col gap-4">
        <div className="gsap-section flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            {t("nav.bots")}
          </h1>
          <Link
            to="/bots/create"
            className="inline-flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold rounded-md bg-[var(--primary)] text-[var(--text-invert)] hover:brightness-110 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            {t("bots.createBotTitle")}
          </Link>
        </div>

        <div className="gsap-section flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1 border-b border-[var(--border-subtle)]">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`relative px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab.value
                    ? "text-[var(--primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.label}
                {activeTab === tab.value && (
                  <span className="absolute bottom-0 left-0 right-0 h-px bg-[var(--primary)]" />
                )}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder={t("bots.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-56 pl-8 pr-3 py-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="gsap-section bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 text-xs text-[var(--text-muted)]">
            {t("bots.loading")}
          </div>
        ) : (
          <div className="gsap-section bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border-subtle)]">
                    <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                      {t("common.name")}
                    </th>
                    <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                      {t("common.type")}
                    </th>
                    <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                      {t("common.mode")}
                    </th>
                    <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                      {t("bots.status")}
                    </th>
                    <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                      {t("common.exchange")}
                    </th>
                    <th className="text-left px-3 py-2 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                      {t("bots.actions")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filteredBots.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center">
                        <div className="flex flex-col items-center justify-center text-[var(--text-muted)]">
                          <Bot className="w-8 h-8 mb-2 opacity-50" />
                          <p className="text-xs font-medium">{t("bots.noBotsFound")}</p>
                          <p className="text-[10px] mt-1 text-[var(--text-muted)]/60">
                            {searchQuery || activeTab !== "all"
                              ? t("bots.tryAdjustingFilters")
                              : t("bots.getStartedCreateBot")}
                          </p>
                          {!searchQuery && activeTab === "all" && (
                            <Link
                              to="/bots/create"
                              className="mt-3 inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold bg-[var(--primary)] hover:brightness-110 text-[var(--text-invert)] transition-all"
                            >
                              <Plus className="w-3 h-3" />
                              {t("bots.createBotTitle")}
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                  {filteredBots.map((bot: any) => (
                    <tr
                      key={bot.id}
                      className="bot-row hover:bg-[var(--bg-hover)]/50 transition-colors"
                    >
                      <td className="text-xs py-2 px-3">
                        <Link
                          to={`/bots/${bot.id}` as any}
                          className="text-[var(--primary)] hover:underline font-medium"
                        >
                          {bot.name}
                        </Link>
                      </td>
                      <td className="text-xs py-2 px-3 capitalize text-[var(--text-secondary)]">
                        {bot.type}
                      </td>
                      <td className="text-xs py-2 px-3 capitalize text-[var(--text-secondary)]">
                        {bot.mode}
                      </td>
                      <td className="text-xs py-2 px-3">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusClass(
                            bot.status
                          )}`}
                        >
                          {bot.status}
                        </span>
                      </td>
                      <td className="text-xs py-2 px-3 text-[var(--text-secondary)]">
                        {bot.connection?.exchangeId || "—"}
                      </td>
                      <td className="text-xs py-2 px-3">
                        <div className="flex items-center gap-1.5">
                          {bot.status !== "running" && (
                            <button
                              onClick={() => startBot.mutate(bot.id)}
                              disabled={startBot.isPending}
                              className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-[var(--success)] hover:brightness-110 text-[var(--text-invert)] transition-all disabled:opacity-50"
                              title={t("bots.start")}
                            >
                              <Play className="w-3 h-3" />
                            </button>
                          )}
                          {bot.status === "running" && (
                            <button
                              onClick={() => stopBot.mutate(bot.id)}
                              disabled={stopBot.isPending}
                              className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-[var(--danger)] hover:brightness-110 text-[var(--text-invert)] transition-all disabled:opacity-50"
                              title={t("bots.stop")}
                            >
                              <Square className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={() => setBotToDelete(bot)}
                            disabled={bot.status === "running" || deleteBot.isPending}
                            className="inline-flex items-center justify-center px-2 py-1 rounded-md bg-[var(--bg-hover)] hover:bg-[var(--danger-glow)] text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors disabled:opacity-50 disabled:hover:bg-[var(--bg-hover)]"
                            title={bot.status === "running" ? t("bots.stopBeforeDelete") : t("bots.delete")}
                          >
                            <Trash2 className="w-3 h-3" />
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
        title={t("bots.confirmDeleteTitle")}
        message={
          botToDelete
            ? t("bots.confirmDeleteDesc", { name: botToDelete.name })
            : ""
        }
        confirmLabel={t("bots.delete")}
        cancelLabel={t("common.cancel")}
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
