import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageWrapper } from "../components/layout/page-wrapper";
import { useI18n } from "../hooks/use-i18n";
import { useWallet, useTopUpPaper, useSimFundsConfig } from "../hooks/use-api";
import { BookOpen, ArrowRight, AlertCircle, TrendingUp, Wallet, Info } from "lucide-react";

export const Route = createFileRoute("/paper-topup")({
  component: PaperTopupPage,
});

function PaperTopupPage() {
  const { t } = useI18n();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: config, isLoading: configLoading } = useSimFundsConfig();
  const topUp = useTopUpPaper();

  const [amount, setAmount] = useState("");

  const rate = config?.paper_mock_rate_usdt ? parseFloat(config.paper_mock_rate_usdt) : 100;
  const usdtAmount = parseFloat(amount) || 0;
  const simFunds = usdtAmount * rate;
  const availableUsdt = Number(wallet?.usdtBalance || 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (usdtAmount <= 0 || usdtAmount > availableUsdt) return;
    topUp.mutate(
      { usdtAmount },
      {
        onSuccess: () => {
          setAmount("");
        },
      }
    );
  };

  return (
    <PageWrapper>
      <div className="max-w-xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[var(--primary)]" />
            {t("paperTopup.title")}
          </h1>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{t("paperTopup.subtitle")}</p>
        </div>

        {/* SimFunds Balance Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[var(--primary)]" />
              <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                {t("paperTopup.yourSimFunds")}
              </span>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              {t("paperTopup.rateLabel")}: 1 USDT = {rate} SF
            </span>
          </div>
          <p className="font-mono text-2xl font-semibold tracking-tight text-[var(--primary)]">
            {walletLoading ? "—" : Number(wallet?.simFundsBalance || 0).toFixed(2)}
            <span className="text-sm text-[var(--text-muted)] font-normal ml-1">SF</span>
          </p>
        </div>

        {/* Top-up Form */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-[var(--success)]" />
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              {t("paperTopup.buySimFunds")}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-[var(--text-secondary)]">
                {t("paperTopup.usdtAmount")}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={availableUsdt}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-3 py-2.5 rounded-md bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-glow)] outline-none transition-all"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
                  USDT
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)]">
                {t("paperTopup.available")}: {availableUsdt.toFixed(4)} USDT
              </p>
            </div>

            {/* Conversion preview */}
            {usdtAmount > 0 && (
              <div className="rounded-lg bg-[var(--primary)]/5 border border-[var(--primary)]/20 p-3 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{t("paperTopup.youPay")}</span>
                  <span className="font-semibold text-[var(--text-primary)]">{usdtAmount.toFixed(2)} USDT</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{t("paperTopup.youReceive")}</span>
                  <span className="font-semibold text-[var(--primary)]">{simFunds.toFixed(2)} SF</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--text-muted)]">{t("paperTopup.rateLabel")}</span>
                  <span className="font-medium text-[var(--text-secondary)]">1 USDT = {rate} SF</span>
                </div>
              </div>
            )}

            {usdtAmount > availableUsdt && (
              <div className="flex items-center gap-1.5 text-[var(--danger)] text-xs">
                <AlertCircle className="w-3.5 h-3.5" />
                {t("paperTopup.insufficientUsdt")}
              </div>
            )}

            <button
              type="submit"
              disabled={topUp.isPending || usdtAmount <= 0 || usdtAmount > availableUsdt || configLoading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2.5 text-sm font-medium text-[var(--text-invert)] transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              {topUp.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-[var(--text-invert)]/30 border-t-[var(--text-invert)] rounded-full animate-spin" />
                  {t("paperTopup.processing")}
                </>
              ) : (
                <>
                  {t("paperTopup.confirmTopUp")}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {topUp.isError && (
            <div className="flex items-center gap-1.5 text-[var(--danger)] text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              {topUp.error instanceof Error ? topUp.error.message : t("paperTopup.failed")}
            </div>
          )}
        </div>

        {/* Info Panel */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-2">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">
                {t("paperTopup.whatAreSimFunds")}
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                {t("paperTopup.simFundsExplanation")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
