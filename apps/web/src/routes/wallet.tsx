import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";
import { PageWrapper } from "../components/layout/page-wrapper";
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
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export const Route = createFileRoute("/wallet")({
  component: WalletPage,
});

type TxStatus = "pending" | "completed" | "failed";

const txStatusConfig: Record<
  TxStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  pending: {
    label: "Pending",
    bg: "bg-[var(--warning-glow)]",
    text: "text-[var(--warning)]",
    border: "border-[var(--warning)]/20",
    dot: "bg-[var(--warning)]",
  },
  completed: {
    label: "Completed",
    bg: "bg-[var(--success-glow)]",
    text: "text-[var(--success)]",
    border: "border-[var(--success)]/20",
    dot: "bg-[var(--success)]",
  },
  failed: {
    label: "Failed",
    bg: "bg-[var(--danger-glow)]",
    text: "text-[var(--danger)]",
    border: "border-[var(--danger)]/20",
    dot: "bg-[var(--danger)]",
  },
};

function normalizeStatus(raw: string): TxStatus {
  if (raw === "pending") return "pending";
  if (raw === "completed" || raw === "confirmed") return "completed";
  if (raw === "failed") return "failed";
  return "pending";
}

function TxBadge({ status }: { status: string }) {
  const s = normalizeStatus(status);
  const config = txStatusConfig[s];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide ${config.bg} ${config.text} ${config.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function WalletPage() {
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
      label: "Token Balance (Gas)",
      value: wallet?.tokenBalance ?? 0,
      icon: Coins,
      accent: "text-[var(--primary)]",
      bg: "bg-[var(--primary-glow)]",
      border: "border-[var(--primary)]/20",
      suffix: "",
    },
    {
      label: "USDT Balance",
      value: wallet?.usdtBalance ?? 0,
      icon: Wallet,
      accent: "text-[var(--success)]",
      bg: "bg-[var(--success-glow)]",
      border: "border-[var(--success)]/20",
      suffix: " USDT",
    },
    {
      label: "Reward Token",
      value: wallet?.referralTokenBalance ?? 0,
      icon: Gift,
      accent: "text-[var(--accent)]",
      bg: "bg-[var(--accent)]/10",
      border: "border-[var(--accent)]/20",
      suffix: "",
    },
    {
      label: "Total Deposited",
      value: wallet?.totalDeposited ?? 0,
      icon: TrendingUp,
      accent: "text-[var(--primary)]",
      bg: "bg-[var(--primary-glow)]",
      border: "border-[var(--primary)]/20",
      suffix: "",
    },
  ];

  return (
    <PageWrapper>
      <div ref={pageRef} className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">
              Wallet
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-0.5">
              Manage your balances and deposits
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="p-2 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pressed)] transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {balanceCards.map((card) => (
            <div
              key={card.label}
              className="wallet-card relative rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] backdrop-blur-xl p-5 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] hover:-translate-y-[1px] transition-all duration-300"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-xl ${card.bg} border ${card.border} flex items-center justify-center shrink-0`}
                >
                  <card.icon className={`w-5 h-5 ${card.accent}`} />
                </div>
                <div>
                  <p className="text-xs text-[var(--text-muted)] font-medium">{card.label}</p>
                  <p className="text-xl font-semibold text-[var(--text-primary)] mt-0.5">
                    {typeof card.value === "number"
                      ? card.value.toFixed(4)
                      : card.value}
                    <span className="text-sm text-[var(--text-muted)] font-normal ml-1">
                      {card.suffix}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Deposit Address Card */}
        <div className="wallet-card relative rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] backdrop-blur-xl overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-5">
              <QrCode className="w-4 h-4 text-[var(--primary)]" />
              <h2 className="text-sm font-medium text-[var(--text-secondary)]">
                Deposit Address (BSC)
              </h2>
            </div>

            {walletLoading ? (
              <div className="flex items-center justify-center py-10">
                <div className="w-8 h-8 border-2 border-[var(--border-default)] border-t-[var(--primary)] rounded-full animate-spin" />
              </div>
            ) : hasAddress ? (
              <div className="flex flex-col md:flex-row gap-6">
                {/* QR Code */}
                <div className="shrink-0">
                  <div className="w-[140px] h-[140px] rounded-xl bg-[var(--text-invert)] p-2.5 flex items-center justify-center shadow-[var(--shadow-md)]">
                    <QRCodeSVG
                      value={depositAddress}
                      size={120}
                      level="M"
                      includeMargin={false}
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                </div>

                {/* Address + Info */}
                <div className="flex-1 min-w-0 space-y-4">
                  <div>
                    <p className="text-xs text-[var(--text-muted)] mb-1.5">Your BSC Deposit Address</p>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-xl px-4 py-3 text-sm font-mono text-[var(--text-secondary)] truncate">
                        {depositAddress}
                      </div>
                      <button
                        onClick={handleCopy}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-pressed)] transition-colors text-sm"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-[var(--success)]" />
                            Copied
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
                      <ArrowDownLeft className="w-3.5 h-3.5 mt-0.5 text-[var(--success)] shrink-0" />
                      <span>Send BEP20 USDT to this address on the BSC network only.</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-[var(--text-muted)]">
                      <ArrowUpRight className="w-3.5 h-3.5 mt-0.5 text-[var(--warning)] shrink-0" />
                      <span>Deposits are credited after 12 block confirmations.</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-5 h-5 text-[var(--primary)]" />
                </div>
                <p className="text-sm text-[var(--text-secondary)] mb-1">
                  No deposit address yet
                </p>
                <p className="text-xs text-[var(--text-muted)] mb-5">
                  Generate a BSC address to start receiving deposits
                </p>

                {generateAddress.isError && (
                  <div className="flex items-center justify-center gap-2 text-[var(--danger)] text-sm mb-3">
                    <AlertCircle className="w-4 h-4" />
                    {generateAddress.error instanceof Error
                      ? generateAddress.error.message
                      : "Failed to generate address"}
                  </div>
                )}

                <button
                  onClick={() => generateAddress.mutate()}
                  disabled={generateAddress.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--text-invert)] font-medium text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_20px_var(--primary-glow)]"
                >
                  {generateAddress.isPending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[var(--text-invert)]/30 border-t-[var(--text-invert)] rounded-full animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Deposit Address
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Gas Explanation Card */}
        <div className="wallet-card relative rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] backdrop-blur-xl overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="p-6 md:p-8">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center shrink-0">
                <Info className="w-5 h-5 text-[var(--accent)]" />
              </div>
              <div>
                <h2 className="text-sm font-medium text-[var(--text-secondary)] mb-1">What is Platform Token?</h2>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Platform Token is <strong className="text-[var(--text-primary)]">trading gas</strong> for live bots.
                  When your live bot closes a profitable trade, <strong className="text-[var(--text-primary)]">20% of the profit</strong> is charged as a fee and automatically deducted from your Token balance.
                  You must convert USDT to Token before running live bots. <strong className="text-[var(--text-primary)]">One-way only</strong> — Token cannot be converted back to USDT.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Convert Card */}
        <div className="wallet-card relative rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] backdrop-blur-xl overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-5">
              <ArrowRightLeft className="w-4 h-4 text-[var(--primary)]" />
              <h2 className="text-sm font-medium text-[var(--text-secondary)]">Convert USDT → Token</h2>
            </div>
            <form onSubmit={handleConvert} className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs text-[var(--text-muted)] mb-1.5">Amount</label>
                <input
                  type="number"
                  step="0.00000001"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary-glow)] outline-none transition-all"
                />
              </div>
              <div className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] text-sm flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                <span>USDT → Token</span>
              </div>
              <button
                type="submit"
                disabled={convert.isPending}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--primary)] text-[var(--text-invert)] font-medium text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_20px_var(--primary-glow)]"
              >
                {convert.isPending ? "Converting..." : "Convert"}
              </button>
            </form>
          </div>
        </div>

        {/* Reward Token Withdrawal Card */}
        <div className="wallet-card relative rounded-2xl bg-[var(--bg-card)] border border-[var(--accent)]/20 backdrop-blur-xl overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="p-6 md:p-8">
            <div className="flex items-center gap-2 mb-5">
              <Gift className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-medium text-[var(--accent)]">Reward Token Withdrawal</h2>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Available Reward Token</p>
                <p className="text-xl font-semibold text-[var(--accent)] mt-0.5">
                  {Number(wallet?.referralTokenBalance || 0).toFixed(4)}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">
                  Earned from referrals. Withdrawable to USDT with admin approval.
                </p>
              </div>
              <button
                onClick={() => setShowWithdrawForm(!showWithdrawForm)}
                disabled={withdrawReferral.isPending}
                className="px-5 py-2.5 rounded-xl bg-[var(--accent)]/20 border border-[var(--accent)]/30 text-[var(--accent)] font-medium text-sm hover:bg-[var(--accent)]/30 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {showWithdrawForm ? "Cancel" : "Request Withdrawal"}
              </button>
            </div>

            {showWithdrawForm && (
              <form onSubmit={handleWithdraw} className="mt-4 pt-4 border-t border-[var(--accent)]/20 flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs text-[var(--text-muted)] mb-1.5">Amount to Withdraw</label>
                  <input
                    type="number"
                    step="0.00000001"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    max={Number(wallet?.referralTokenBalance || 0)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] text-sm placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/20 outline-none transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={withdrawReferral.isPending}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[var(--accent)] text-[var(--text-invert)] font-medium text-sm hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {withdrawReferral.isPending ? "Submitting..." : "Submit Request"}
                </button>
              </form>
            )}

            {withdrawReferral.isError && (
              <div className="mt-3 flex items-center gap-2 text-[var(--danger)] text-sm">
                <AlertCircle className="w-4 h-4" />
                {withdrawReferral.error instanceof Error
                  ? withdrawReferral.error.message
                  : "Withdrawal request failed"}
              </div>
            )}
          </div>
        </div>

        {/* Transaction History */}
        <div className="wallet-card relative rounded-2xl bg-[var(--bg-card)] border border-[var(--border-subtle)] backdrop-blur-xl overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
            <h2 className="text-sm font-medium text-[var(--text-secondary)]">Transaction History</h2>
            <span className="text-xs text-[var(--text-muted)]">{txs.length} transactions</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                  <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">Currency</th>
                  <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {txs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-muted)] text-sm">
                      No transactions yet.
                    </td>
                  </tr>
                )}
                {txs.map((tx: any) => (
                  <tr key={tx.id} className="hover:bg-[var(--bg-hover)]/50 transition-colors">
                    <td className="px-6 py-3 capitalize text-[var(--text-secondary)]">{tx.type}</td>
                    <td className="px-6 py-3 text-[var(--text-primary)] font-medium">{tx.amount}</td>
                    <td className="px-6 py-3 text-[var(--text-muted)]">{tx.currency}</td>
                    <td className="px-6 py-3">
                      <TxBadge status={tx.status} />
                    </td>
                    <td className="px-6 py-3 text-[var(--text-muted)] text-xs">
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
