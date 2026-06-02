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
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
  },
  completed: {
    label: "Completed",
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  failed: {
    label: "Failed",
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    dot: "bg-red-400",
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
  const [convertDirection, setConvertDirection] = useState("usdt_to_token");

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
    convert.mutate({
      amount: parseFloat(convertAmount),
      direction: convertDirection,
    });
    setConvertAmount("");
  };

  const txs = txPage?.data || [];

  const balanceCards = [
    {
      label: "Token Balance",
      value: wallet?.tokenBalance ?? 0,
      icon: <Coins className="w-5 h-5 text-teal-400" />,
      bg: "bg-teal-500/10",
      border: "border-teal-500/20",
      suffix: "",
    },
    {
      label: "USDT Balance",
      value: wallet?.usdtBalance ?? 0,
      icon: <Wallet className="w-5 h-5 text-emerald-400" />,
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      suffix: " USDT",
    },
    {
      label: "Total Deposited",
      value: wallet?.totalDeposited ?? 0,
      icon: <TrendingUp className="w-5 h-5 text-blue-400" />,
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      suffix: "",
    },
  ];

  return (
    <div ref={pageRef} className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white font-['Space_Grotesk'] tracking-tight">
            Wallet
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your balances and deposits
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.07] transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {balanceCards.map((card) => (
          <div
            key={card.label}
            className="wallet-card relative rounded-2xl bg-[#13161f]/80 border border-white/[0.06] backdrop-blur-xl p-5"
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl ${card.bg} border ${card.border} flex items-center justify-center shrink-0`}
              >
                {card.icon}
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">{card.label}</p>
                <p className="text-xl font-semibold text-white mt-0.5">
                  {typeof card.value === "number"
                    ? card.value.toFixed(4)
                    : card.value}
                  <span className="text-sm text-slate-500 font-normal ml-1">
                    {card.suffix}
                  </span>
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Deposit Address Card */}
      <div className="wallet-card relative rounded-2xl bg-[#13161f]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-2 mb-5">
            <QrCode className="w-4 h-4 text-teal-400" />
            <h2 className="text-sm font-medium text-slate-300">
              Deposit Address (BSC)
            </h2>
          </div>

          {walletLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-2 border-slate-600 border-t-teal-400 rounded-full animate-spin" />
            </div>
          ) : hasAddress ? (
            <div className="flex flex-col md:flex-row gap-6">
              {/* QR Code */}
              <div className="shrink-0">
                <div className="w-[140px] h-[140px] rounded-xl bg-white p-2.5 flex items-center justify-center shadow-lg">
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
                  <p className="text-xs text-slate-500 mb-1.5">Your BSC Deposit Address</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-[#0f1117] border border-white/[0.08] rounded-xl px-4 py-3 text-sm font-mono text-slate-300 truncate">
                      {depositAddress}
                    </div>
                    <button
                      onClick={handleCopy}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.1] transition-colors text-sm"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
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
                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <ArrowDownLeft className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />
                    <span>Send BEP20 USDT to this address on the BSC network only.</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-500">
                    <ArrowUpRight className="w-3.5 h-3.5 mt-0.5 text-amber-400 shrink-0" />
                    <span>Deposits are credited after 12 block confirmations.</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-5 h-5 text-teal-400" />
              </div>
              <p className="text-sm text-slate-400 mb-1">
                No deposit address yet
              </p>
              <p className="text-xs text-slate-600 mb-5">
                Generate a BSC address to start receiving deposits
              </p>

              {generateAddress.isError && (
                <div className="flex items-center justify-center gap-2 text-red-400 text-sm mb-3">
                  <AlertCircle className="w-4 h-4" />
                  {generateAddress.error instanceof Error
                    ? generateAddress.error.message
                    : "Failed to generate address"}
                </div>
              )}

              <button
                onClick={() => generateAddress.mutate()}
                disabled={generateAddress.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-500 text-[#09090b] font-medium text-sm hover:bg-teal-400 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {generateAddress.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#09090b]/30 border-t-[#09090b] rounded-full animate-spin" />
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

      {/* Convert Card */}
      <div className="wallet-card relative rounded-2xl bg-[#13161f]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden">
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-2 mb-5">
            <ArrowRightLeft className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-medium text-slate-300">Convert</h2>
          </div>
          <form onSubmit={handleConvert} className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full">
              <label className="block text-xs text-slate-500 mb-1.5">Amount</label>
              <input
                type="number"
                step="0.00000001"
                value={convertAmount}
                onChange={(e) => setConvertAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-[#0f1117] border border-white/[0.08] text-white text-sm placeholder:text-slate-600 focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 outline-none transition-all"
              />
            </div>
            <div className="w-full sm:w-auto">
              <label className="block text-xs text-slate-500 mb-1.5">Direction</label>
              <select
                value={convertDirection}
                onChange={(e) => setConvertDirection(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[#0f1117] border border-white/[0.08] text-white text-sm outline-none focus:border-teal-500/50 transition-all"
              >
                <option value="usdt_to_token">USDT → Token</option>
                <option value="token_to_usdt">Token → USDT</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={convert.isPending}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-500 text-white font-medium text-sm hover:bg-blue-400 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {convert.isPending ? "Converting..." : "Convert"}
            </button>
          </form>
        </div>
      </div>

      {/* Transaction History */}
      <div className="wallet-card relative rounded-2xl bg-[#13161f]/80 border border-white/[0.06] backdrop-blur-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-300">Transaction History</h2>
          <span className="text-xs text-slate-600">{txs.length} transactions</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-500 border-b border-white/[0.06]">
                <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">Type</th>
                <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">Amount</th>
                <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">Currency</th>
                <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">Status</th>
                <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {txs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No transactions yet.
                  </td>
                </tr>
              )}
              {txs.map((tx: any) => (
                <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-3 capitalize text-slate-300">{tx.type}</td>
                  <td className="px-6 py-3 text-white font-medium">{tx.amount}</td>
                  <td className="px-6 py-3 text-slate-400">{tx.currency}</td>
                  <td className="px-6 py-3">
                    <TxBadge status={tx.status} />
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-xs">
                    {new Date(tx.createdAt).toLocaleString()}
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
