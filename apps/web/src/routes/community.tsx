import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useSharedBots, useCopyBot } from "../hooks/use-api";
import { useToast } from "../hooks/use-toast";
import { useI18n } from "../hooks/use-i18n";
import {
  ArrowLeft,
  Copy,
  Users,
  Bot,
  TrendingUp,
  Paperclip,
  Zap,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/community")({
  component: CommunityPage,
});

function CommunityPage() {
  const { t } = useI18n();
  const toast = useToast();
  const [filterMode, setFilterMode] = useState<"all" | "paper" | "live">("all");
  const { data: sharedBots, isLoading } = useSharedBots(filterMode === "all" ? undefined : filterMode);
  const copyBot = useCopyBot();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (botId: string, connectionId: string, mode: "paper" | "live") => {
    copyBot.mutate(
      { botId, connectionId, mode },
      {
        onSuccess: () => {
          toast.success(t("community.copiedSuccess"));
          setCopiedId(botId);
          setTimeout(() => setCopiedId((prev) => (prev === botId ? null : prev)), 2000);
        },
        onError: () => toast.error(t("common.error")),
      }
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/bots"
          className="p-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">
            {t("community.title")}
          </h1>
          <p className="text-xs text-[var(--text-muted)]">{t("community.subtitle")}</p>
        </div>
      </div>

      {/* Mode Filter */}
      <div className="flex items-center gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden mb-5 w-fit">
        {[
          { id: "all" as const, key: "common.all" as const },
          { id: "paper" as const, key: "common.paper" as const },
          { id: "live" as const, key: "common.live" as const },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterMode(tab.id)}
            className={`px-3 py-1.5 text-[11px] font-medium transition-colors ${
              filterMode === tab.id
                ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                : "bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t(tab.key)}
          </button>
        ))}
      </div>

      {/* Bot List */}
      {isLoading ? (
        <p className="text-xs text-[var(--text-muted)]">{t("common.loading")}...</p>
      ) : !sharedBots?.length ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-6 text-center">
          <Users className="w-6 h-6 text-[var(--text-muted)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text-muted)]">{t("community.noBots")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {sharedBots.map((bot: any) => (
            <div
              key={bot.id}
              className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="w-4 h-4 text-[var(--primary)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)] truncate">{bot.name}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      bot.sharedMode === "live"
                        ? "bg-[var(--danger)]/10 text-[var(--danger)]"
                        : "bg-[var(--primary)]/10 text-[var(--primary)]"
                    }`}
                  >
                    {bot.sharedMode === "live" ? t("common.live") : t("common.paper")}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)]">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {bot.type?.toUpperCase()}
                  </span>
                  <span className="flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    {bot.tradingPair || "N/A"}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {bot.copyCount || 0} {t("community.copies")}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleCopy(bot.id, "", bot.sharedMode || "paper")}
                disabled={copyBot.isPending}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] text-[11px] font-medium hover:bg-[var(--primary)]/20 transition-colors disabled:opacity-50"
              >
                {copiedId === bot.id ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {t("common.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    {t("common.copy")}
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
