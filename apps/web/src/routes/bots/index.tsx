import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useBots, useStartBot, useStopBot, useDeleteBot } from "../../hooks/use-api";
import { PageWrapper } from "../../components/layout/page-wrapper";
import { Play, Square, Plus, Search, Bot, Trash2, Pencil } from "lucide-react";
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
      result = result.filter((b: any) => {
        const haystack = [
          b.name,
          b.tradingPair,
          b.type,
          b.mode,
          b.status,
          b.connection?.exchangeId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
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

  const modeClass = (mode: string) => {
    switch (mode) {
      case "live":
        return "bg-[var(--primary)]/10 text-[var(--primary)] border border-[var(--primary)]/20";
      case "paper":
        return "bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20";
      default:
        return "bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)]";
    }
  };

  const formatShortDate = (iso: string) => {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <PageWrapper>
      <div className="flex flex-col gap-4">
        {/* Header */}
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

        {/* Tabs + Search */}
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
              className="w-full sm:w-64 pl-8 pr-3 py-2 rounded-md bg-[var(--bg-card)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)] focus:border-transparent"
            />
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="gsap-section bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 text-xs text-[var(--text-muted)]">
            {t("bots.loading")}
          </div>
        ) : (
          <div className="gsap-section">
            {filteredBots.length === 0 && (
              <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-8 text-center">
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
              </div>
            )}

            {/* Card Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredBots.map((bot: any) => (
                <div
                  key={bot.id}
                  className="group relative bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-5 flex flex-col gap-3.5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-[var(--primary)]/30 hover:ring-1 hover:ring-[var(--primary)]/10 overflow-hidden"
                >
                  {/* Subtle top-left glow on hover */}
                  <div className="pointer-events-none absolute -top-10 -left-10 w-32 h-32 rounded-full bg-[var(--primary)]/10 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Top row: Name + Pair */}
                  <div className="relative flex items-center justify-between gap-3">
                    <Link
                      to={`/bots/${bot.id}` as any}
                      className="text-sm font-bold text-[var(--text-primary)] hover:text-[var(--primary)] transition-colors truncate"
                      title={bot.name}
                    >
                      {bot.name}
                    </Link>
                    {bot.tradingPair && (
                      <span className="shrink-0 text-[11px] font-semibold text-[var(--primary)] bg-[var(--primary)]/10 border border-[var(--primary)]/20 px-2 py-0.5 rounded-full">
                        {bot.tradingPair}
                      </span>
                    )}
                  </div>

                  {/* Meta grid */}
                  <div className="relative grid grid-cols-2 gap-2.5">
                    <div className="bg-[var(--bg-hover)]/60 border border-[var(--border-subtle)] rounded-lg px-3 py-2 flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                        {t("common.type")}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-secondary)] capitalize">
                        {bot.type}
                      </span>
                    </div>
                    <div className="bg-[var(--bg-hover)]/60 border border-[var(--border-subtle)] rounded-lg px-3 py-2 flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                        {t("common.mode")}
                      </span>
                      <span className="text-[10px] font-semibold capitalize">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full ${modeClass(
                            bot.mode
                          )}`}
                        >
                          {bot.mode}
                        </span>
                      </span>
                    </div>
                    <div className="bg-[var(--bg-hover)]/60 border border-[var(--border-subtle)] rounded-lg px-3 py-2 flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                        {t("bots.status")}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            bot.status === "running"
                              ? "bg-[var(--success)] shadow-[0_0_6px_var(--success)]"
                              : "bg-[var(--text-muted)]"
                          }`}
                        />
                        <span className="capitalize">{bot.status}</span>
                      </span>
                    </div>
                    <div className="bg-[var(--bg-hover)]/60 border border-[var(--border-subtle)] rounded-lg px-3 py-2 flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                        {t("common.exchange")}
                      </span>
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">
                        {bot.connection?.exchangeId || "—"}
                      </span>
                    </div>
                  </div>

                  {/* Footer: updated time */}
                  <div className="relative text-[10px] text-[var(--text-muted)]/70">
                    {t("common.updated")}: {formatShortDate(bot.updatedAt)}
                  </div>

                  {/* Actions */}
                  <div className="relative flex items-center gap-2 mt-auto pt-1">
                    {bot.status !== "running" ? (
                      <button
                        onClick={() => startBot.mutate(bot.id)}
                        disabled={startBot.isPending}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20 hover:bg-[var(--success)]/20 transition-colors disabled:opacity-50"
                        title={t("bots.start")}
                      >
                        <Play className="w-3 h-3 fill-current" />
                        {t("bots.start")}
                      </button>
                    ) : (
                      <button
                        onClick={() => stopBot.mutate(bot.id)}
                        disabled={stopBot.isPending}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20 hover:bg-[var(--danger)]/20 transition-colors disabled:opacity-50"
                        title={t("bots.stop")}
                      >
                        <Square className="w-3 h-3 fill-current" />
                        {t("bots.stop")}
                      </button>
                    )}
                    <Link
                      to={`/bots/${bot.id}` as any}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:bg-[var(--primary)]/10 hover:text-[var(--primary)] hover:border-[var(--primary)]/20 transition-colors"
                      title={t("common.edit")}
                    >
                      <Pencil className="w-3 h-3" />
                    </Link>
                    <button
                      onClick={() => setBotToDelete(bot)}
                      disabled={bot.status === "running" || deleteBot.isPending}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--bg-hover)] text-[var(--text-muted)] border border-[var(--border-subtle)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] hover:border-[var(--danger)]/20 transition-colors disabled:opacity-50 disabled:hover:bg-[var(--bg-hover)] disabled:hover:text-[var(--text-muted)] disabled:hover:border-[var(--border-subtle)]"
                      title={
                        bot.status === "running"
                          ? t("bots.stopBeforeDelete")
                          : t("bots.delete")
                      }
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
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
