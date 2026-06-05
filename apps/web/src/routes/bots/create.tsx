import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Activity, Signal } from "lucide-react";
import { useState } from "react";
import BotWizard from "../../components/bots/bot-wizard";
import { PageWrapper } from "../../components/layout/page-wrapper";
import { useI18n } from "../../hooks/use-i18n";

export const Route = createFileRoute("/bots/create")({
  component: CreateBotPage,
});

function CreateBotPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [selectedType, setSelectedType] = useState<"dca" | "signal" | null>(null);

  const strategies = [
    {
      id: "dca" as const,
      titleKey: "bots.dcaBot" as const,
      descriptionKey: "bots.dcaBotDesc" as const,
      icon: <Activity className="h-8 w-8" />,
      borderColor: "rgba(139,92,246,0.5)",
      bgColor: "rgba(139,92,246,0.08)",
    },
    {
      id: "signal" as const,
      titleKey: "bots.signalBot" as const,
      descriptionKey: "bots.signalBotDesc" as const,
      icon: <Signal className="h-8 w-8" />,
      borderColor: "rgba(6,182,212,0.5)",
      bgColor: "rgba(6,182,212,0.08)",
    },
  ];

  return (
    <PageWrapper>
      <div className="mx-auto max-w-4xl">
        <div className="gsap-section mb-6 flex items-center gap-4">
          <Link
            to="/bots"
            className="inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)]/50 p-2 text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
            {selectedType
              ? t("bots.createNamedBot", {
                  name: t(strategies.find((s) => s.id === selectedType)!.titleKey),
                })
              : t("bots.createBotTitle")}
          </h1>
        </div>

        {/* Strategy Chooser */}
        {!selectedType && (
          <div className="gsap-section">
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              {t("bots.chooseStrategy")}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {strategies.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedType(s.id)}
                  className="group relative rounded-xl border border-[var(--border-subtle)]/50 bg-[var(--bg-card)] p-6 text-left transition-all duration-200 hover:border-[var(--border-subtle)] hover:bg-[var(--bg-surface)]/20"
                  style={{
                    [":hover" as any]: {},
                  }}
                >
                  <div
                    className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl transition-colors"
                    style={{
                      backgroundColor: s.bgColor,
                      color: s.borderColor.replace("0.5", "1"),
                    }}
                  >
                    {s.icon}
                  </div>
                  <h3 className="text-base font-semibold text-[var(--text-primary)]">
                    {t(s.titleKey)}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
                    {t(s.descriptionKey)}
                  </p>
                  <div
                    className="absolute inset-0 rounded-xl border-2 border-transparent transition-all duration-200 group-hover:border-opacity-100"
                    style={{
                      borderColor: s.borderColor,
                    }}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Wizard */}
        {selectedType && (
          <div className="gsap-section rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
            <button
              onClick={() => setSelectedType(null)}
              className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("bots.chooseStrategyBtn")}
            </button>

            <BotWizard
              preselectedType={selectedType}
              onSuccess={() => navigate({ to: "/bots" })}
            />
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
