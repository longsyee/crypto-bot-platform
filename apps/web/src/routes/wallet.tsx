import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { PageWrapper } from "../components/layout/page-wrapper";
import { useI18n } from "../hooks/use-i18n";
import {
  useWallet,
  useTransactions,
  useConvert,
  useGenerateAddress,
  useWithdrawReferral,
} from "../hooks/use-api";
import {
  Copy,
  Check,
  ArrowRightLeft,
  Wallet,
  Coins,
  TrendingUp,
  QrCode,
  Sparkles,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Info,
  Gift,
  ArrowLeftRight,
  BookOpen,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
});

type TxStatus = "pending" | "completed" | "failed";

function normalizeStatus(raw: string): TxStatus {
  if (raw === "pending") return "pending";
  if (raw === "completed" || raw === "confirmed") return "completed";
  if (raw === "failed") return "failed";
  return "pending";
}

function TxBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const s = normalizeStatus(status);
  const config = {
    pending: {
      bg: "bg-[var(--warning-glow)]",
      text: "text-[var(--warning)]",
      border: "border-[var(--warning)]/20",
      dot: "bg-[var(--warning)]",
      label: t("dashboard.pending"),
    },
    completed: {
      bg: "bg-[var(--success-glow)]",
      text: "text-[var(--success)]",
      border: "border-[var(--success)]/20",
      dot: "bg-[var(--success)]",
      label: t("dashboard.completed"),
    },
    failed: {
      bg: "bg-[var(--danger-glow)]",
      text: "text-[var(--danger)]",
      border: "border-[var(--danger)]/20",
      dot: "bg-[var(--danger)]",
      label: t("dashboard.failed"),
    },
  }[s];
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider rounded-sm border ${config.bg} ${config.text} ${config.border}`}
    >
      <span className={`h-1 w-1 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function WalletPage() {
  const { t } = useI18n();
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: txPage } = useTransactions();
  const convert = useConvert();
  const generateAddress = useGenerateAddress();

  const [copied, setCopied] = useState(false);
  const [convertAmount, setConvertAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  const depositAddress = wallet?.bscAddress || null;
  const hasAddress = !!depositAddress && depositAddress.length > 0;

  const pageRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!pageRef.current) return;
      const cards = pageRef.current.querySelectorAll(".wallet-card");
      gsap.fromTo(
        cards,
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.5, stagger: 0.08, ease: "power3.out" }
      );
    },
    { scope: pageRef }
  );

  const handleCopy = () => {
    if (hasAddress) {
      navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleConvert = (e: React.FormEvent) => {
    e.preventDefault();
    convert.mutate({ amount: parseFloat(convertAmount) });
    setConvertAmount("");
  };

  const withdrawReferral = useWithdrawReferral();

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    withdrawReferral.mutate(
      { amount: parseFloat(withdrawAmount) },
      {
        onSuccess: () => {
          setWithdrawAmount("");
          setShowWithdrawForm(false);
        },
      }
    );
  };

  const txs = txPage || [];

  const balanceCards = [
    {
      label: t("wallet.tokenBalanceGas"),
      value: wallet?.tokenBalance ?? 0,
      icon: Coins,
      strip: "border-[var(--primary)]",
      accent: "text-[var(--primary)]",
      suffix: "",
    },
    {
      label: t("wallet.usdtBalance"),
      value: wallet?.usdtBalance ?? 0,
      icon: Wallet,
      strip: "border-[var(--success)]",
      accent: "text-[var(--success)]",
      suffix: " USDT",
    },
    {
      label: t("wallet.simFundsBalance"),
      value: wallet?.simFundsBalance ?? 0,
      icon: BookOpen,
      strip: "border-[var(--primary)]",
      accent: "text-[var(--primary)]",
      suffix: " SF",
    },
    {
      label: t("wallet.rewardToken"),
      value: wallet?.referralTokenBalance ?? 0,
      icon: Gift,
      strip: "border-[var(--accent)]",
      accent: "text-[var(--accent)]",
      suffix: "",
    },
    {
      label: t("wallet.totalDeposited"),
      value: wallet?.totalDeposited ?? 0,
      icon: TrendingUp,
      strip: "border-[var(--primary)]",
      accent: "text-[var(--primary)]",
      suffix: "",
    },
  ];

  return (
    <PageWrapper>
      <div ref={pageRef} className="space-y-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">
              {t("nav.wallet")}
            </h1>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t("wallet.subtitle")}
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-1.5 rounded-md bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pressed)] transition-colors"
            title={t("common.refresh")}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Balance Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          {balanceCards.map((card) => (
            <div
              key={card.label}
              className={`wallet-card bg-[var(--bg-card)] p-3 ${card.strip} border-t-2`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <card.icon className={`w-3.5 h-3.5 ${card.accent}`} />
                <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                  {card.label}
                </p>
              </div>
              <p className="font-mono text-xl font-semibold tracking-tight text-[var(--text-primary)]">
                {typeof card.value === "number"
                  ? card.value.toFixed(4)
                  : card.value}
                <span className="text-xs text-[var(--text-muted)] font-normal ml-1">
                  {card.suffix}
                </span>
              </p>
            </div>
          ))}
        </div>

        {/* Deposit Address Panel */}
        <div className="wallet-card bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <QrCode className="w-3.5 h-3.5 text-[var(--primary)]" />
            <h2 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              {t("wallet.depositAddressBsc")}
            </h2>
          </div>

          {walletLoading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-6 h-6 border-2 border-[var(--border-default)] border-t-[var(--primary)] rounded-full animate-spin" />
            </div>
          ) : hasAddress ? (
            <div className="flex flex-col md:flex-row gap-4">
              {/* QR Code */}
              <div className="shrink-0">
                <div className="w-[120px] h-[120px] rounded-lg bg-[var(--text-invert)] p-2 flex items-center justify-center border border-[var(--border-subtle)]">
                  <QRCodeSVG
                    value={depositAddress}
                    size={104}
                    level="M"
                    includeMargin={false}
                    bgColor="#ffffff"
                    fgColor="#000000"
                  />
                </div>
              </div>

              {/* Address + Info */}
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">
                    {t("wallet.yourBscAddress")}
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-md px-3 py-2 text-xs font-mono text-[var(--text-secondary)] truncate">
                      {depositAddress}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pressed)] transition-colors text-[11px] font-medium"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[var(--success)]" />
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
                </div>

                <div className="space-y-1">
                  <div className="flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
                    <ArrowDownLeft className="w-3 h-3 mt-0.5 text-[var(--success)] shrink-0" />
                    <span>{t("wallet.sendBep20")}</span>
                  </div>
                  <div className="flex items-start gap-1.5 text-[11px] text-[var(--text-muted)]">
                    <ArrowUpRight className="w-3 h-3 mt-0.5 text-[var(--warning)] shrink-0" />
                    <span>{t("wallet.depositConfirmations")}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-8 h-8 rounded-md bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-2">
                <Sparkles className="w-4 h-4 text-[var(--primary)]" />
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">
                {t("wallet.noDepositAddress")}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] mb-4">
                {t("wallet.generateAddressDesc")}
              </p>

              {generateAddress.isError && (
                <div className="flex items-center justify-center gap-1.5 text-[var(--danger)] text-xs mb-3">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {generateAddress.error instanceof Error
                    ? generateAddress.error.message
                    : t("wallet.failedGenerateAddress")}
                </div>
              )}

              <button
                onClick={() => generateAddress.mutate()}
                disabled={generateAddress.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--primary)] text-[var(--text-invert)] font-medium text-[11px] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {generateAddress.isPending ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[var(--text-invert)]/30 border-t-[var(--text-invert)] rounded-full animate-spin" />
                    {t("wallet.generating")}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    {t("wallet.generateDepositAddress")}
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Gas Explanation Panel */}
        <div className="wallet-card bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">
                {t("wallet.whatIsPlatformToken")}
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                {t("wallet.gasExplanation")}
              </p>
            </div>
          </div>
        </div>

        {/* Convert Panel */}
        <div className="wallet-card bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowRightLeft className="w-3.5 h-3.5 text-[var(--primary)]" />
            <h2 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              {t("wallet.convertTitle")}
            </h2>
          </div>
          <form onSubmit={handleConvert} className="flex flex-col sm:flex-row gap-2 items-end">
            <div className="flex-1 w-full">
              <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">
                {t("common.amount")}
              </label>
              <input
                type="number"
                step="0.00000001"
                min="0.00000001"
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-3 py-2 rounded-md bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-glow)] outline-none transition-all"
              />
            </div>
            <div className="w-full sm:w-auto px-3 py-2 rounded-md bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-xs flex items-center gap-1.5">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>{t("wallet.usdtToToken")}</span>
            </div>
            <button
              type="submit"
              disabled={convert.isPending || !convertAmount || parseFloat(convertAmount) <= 0}
              className="w-full sm:w-auto px-3 py-2 rounded-md bg-[var(--primary)] text-[var(--text-invert)] font-medium text-[11px] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {convert.isPending ? t("wallet.converting") : t("wallet.convert")}
            </button>
          </form>
        </div>

        {/* Reward Token Withdrawal Panel */}
        <div className="wallet-card bg-[var(--bg-card)] border border-[var(--accent)]/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="w-3.5 h-3.5 text-[var(--accent)]" />
            <h2 className="text-[10px] uppercase tracking-widest text-[var(--accent)] font-semibold">
              {t("wallet.rewardTokenWithdrawal")}
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                {t("wallet.availableRewardToken")}
              </p>
              <p className="font-mono text-xl font-semibold tracking-tight text-[var(--accent)] mt-0.5">
                {Number(wallet?.referralTokenBalance || 0).toFixed(4)}
              </p>
              <p className="text-[10px] text-[var(--text-muted)] mt-1">
                {t("wallet.earnedFromReferrals")}
              </p>
            </div>
            <button
              onClick={() => setShowWithdrawForm(!showWithdrawForm)}
              disabled={withdrawReferral.isPending}
              className="px-2 py-1 rounded-md bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent)] font-medium text-[11px] hover:bg-[var(--accent)]/30 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {showWithdrawForm ? t("common.cancel") : t("wallet.requestWithdrawal")}
            </button>
          </div>

          {showWithdrawForm && (
            <form onSubmit={handleWithdraw} className="mt-3 pt-3 border-t border-[var(--accent)]/20 flex flex-col sm:flex-row gap-2 items-end">
              <div className="flex-1 w-full">
                <label className="block text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-1">
                  {t("wallet.amountToWithdraw")}
                </label>
                <input
                  type="number"
                  step="0.00000001"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  max={Number(wallet?.referralTokenBalance || 0)}
                  className="w-full px-3 py-2 rounded-md bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-xs placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 outline-none transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={withdrawReferral.isPending}
                className="w-full sm:w-auto px-3 py-2 rounded-md bg-[var(--accent)] text-[var(--text-invert)] font-medium text-[11px] hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {withdrawReferral.isPending ? t("common.submitting") : t("wallet.submitRequest")}
              </button>
            </form>
          )}

          {withdrawReferral.isError && (
            <div className="mt-2 flex items-center gap-1.5 text-[var(--danger)] text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              {withdrawReferral.error instanceof Error
                ? withdrawReferral.error.message
                : t("wallet.withdrawalFailed")}
            </div>
          )}
        </div>

        {/* Transaction History */}
        <div className="wallet-card bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <h2 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              {t("wallet.transactionHistory")}
            </h2>
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              {t("wallet.transactionCount", { count: txs.length })}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-subtle)]">
                  <th className="text-left py-2 px-3 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    {t("common.type")}
                  </th>
                  <th className="text-left py-2 px-3 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    {t("common.amount")}
                  </th>
                  <th className="text-left py-2 px-3 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    {t("common.currency")}
                  </th>
                  <th className="text-left py-2 px-3 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    {t("common.status")}
                  </th>
                  <th className="text-left py-2 px-3 text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">
                    {t("common.date")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {txs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-muted)] text-xs">
                      {t("dashboard.noTransactions")}
                    </td>
                  </tr>
                )}
                {txs.map((tx: any) => (
                  <tr key={tx.id} className="text-[var(--text-secondary)]">
                    <td className="text-xs py-2 px-3 capitalize">{tx.type}</td>
                    <td className="text-xs py-2 px-3 text-[var(--text-primary)] font-medium font-mono">
                      {tx.amount}
                    </td>
                    <td className="text-xs py-2 px-3 text-[var(--text-muted)]">
                      {tx.currency}
                    </td>
                    <td className="text-xs py-2 px-3">
                      <TxBadge status={tx.status} />
                    </td>
                    <td className="text-xs py-2 px-3 text-[var(--text-muted)] font-mono">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
