import { createFileRoute } from "@tanstack/react-router";
import { useReferrals, useReferralWithdrawals } from "../hooks/use-api";
import { useAuth } from "../hooks/use-auth";
import {
  Copy,
  Check,
  Users,
  Coins,
  Percent,
  Crown,
  Medal,
  Award,
  Gem,
  Star,
  ArrowRight,
  Gift,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useRef, useState, useCallback } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { PageWrapper } from "../components/layout/page-wrapper";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/referrals")({
  component: ReferralsPage,
});

const TIERS = [
  { id: "bronze", label: "Bronze", rate: 5, icon: Medal, color: "text-[var(--warning)]", bg: "bg-[var(--warning)]", ring: "ring-[var(--warning)]/30", shadow: "shadow-[var(--warning)]/20", bar: "bg-[var(--warning)]" },
  { id: "silver", label: "Silver", rate: 12, icon: Award, color: "text-[var(--text-muted)]", bg: "bg-[var(--bg-surface)]", ring: "ring-[var(--bg-surface)]/30", shadow: "shadow-[var(--bg-surface)]/20", bar: "bg-[var(--bg-surface)]" },
  { id: "gold", label: "Gold", rate: 20, icon: Crown, color: "text-[var(--warning)]", bg: "bg-[var(--warning)]", ring: "ring-[var(--warning)]/30", shadow: "shadow-[var(--warning)]/20", bar: "bg-[var(--warning)]" },
  { id: "platinum", label: "Platinum", rate: 28, icon: Gem, color: "text-[var(--accent)]", bg: "bg-[var(--accent)]", ring: "ring-[var(--accent)]/30", shadow: "shadow-[var(--accent)]/20", bar: "bg-[var(--accent)]" },
  { id: "kol", label: "KOL", rate: 35, icon: Star, color: "text-[var(--primary)]", bg: "bg-[var(--primary)]", ring: "ring-[var(--primary)]/30", shadow: "shadow-[var(--primary)]/20", bar: "bg-[var(--primary)]" },
];

function TierCard({
  tier,
  index,
  currentIndex,
  isActive,
}: {
  tier: (typeof TIERS)[number];
  index: number;
  currentIndex: number;
  isActive: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const isReached = index <= currentIndex;
  const isNext = index === currentIndex + 1;

  useGSAP(
    () => {
      if (!cardRef.current) return;
      gsap.fromTo(
        cardRef.current,
        { y: 24, opacity: 0, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.5,
          ease: "power3.out",
          delay: 0.08 * index,
        }
      );
    },
    { scope: cardRef }
  );

  const Icon = tier.icon;

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative flex flex-col items-center text-center rounded-xl border px-3 py-4 transition-colors duration-300",
        isActive
          ? "bg-[var(--bg-hover)] border-[var(--border-default)] shadow-[0_0_20px_var(--primary-glow)]"
          : isReached
          ? "bg-[var(--bg-card)] border-[var(--border-subtle)] opacity-80"
          : isNext
          ? "bg-[var(--bg-card)] border-[var(--border-subtle)] opacity-60"
          : "bg-[var(--bg-card)] border-[var(--border-subtle)] opacity-40"
      )}
    >
      {/* Glow ring for active */}
      {isActive && (
        <div
          className={cn(
            "absolute inset-0 rounded-xl ring-1",
            tier.ring,
            "pointer-events-none"
          )}
        />
      )}

      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center mb-2",
          isActive ? tier.bg : "bg-[var(--bg-hover)]",
          isActive ? tier.shadow : "",
          isActive ? "shadow-lg" : ""
        )}
      >
        <Icon
          className={cn("w-5 h-5", isActive ? "text-[var(--text-invert)]" : "text-[var(--text-muted)]")}
        />
      </div>

      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          isActive ? "text-[var(--text-primary)]" : "text-[var(--text-muted)]"
        )}
      >
        {tier.label}
      </p>
      <p
        className={cn(
          "text-lg font-bold mt-0.5",
          isActive ? tier.color : "text-[var(--text-muted)]"
        )}
      >
        {tier.rate}%
      </p>

      {/* Connector line */}
      {index < TIERS.length - 1 && (
        <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-[2px]">
          <div
            className={cn(
              "h-full rounded-full",
              isReached ? tier.bar : "bg-[var(--bg-pressed)]"
            )}
          />
          <ArrowRight
            className={cn(
              "absolute -right-1 -top-[7px] w-3.5 h-3.5",
              isReached ? tier.color : "text-[var(--bg-pressed)]"
            )}
          />
        </div>
      )}
    </div>
  );
}

function ReferralsPage() {
  const { data, isLoading } = useReferrals();
  const { data: withdrawals } = useReferralWithdrawals();
  const user = useAuth((s) => s.user);
  const [copied, setCopied] = useState(false);

  const copyBtnRef = useRef<HTMLButtonElement>(null);

  const referralCode = data?.referralCode || user?.referralCode || "—";
  const currentTierId = (data?.tier || user?.tier || "bronze") as string;
  const currentTierIndex = TIERS.findIndex((t) => t.id === currentTierId);
  const safeCurrentIndex = currentTierIndex === -1 ? 0 : currentTierIndex;

  const referrals = data?.myReferrals || [];
  const earnings = data?.totalEarnings || 0;
  const commissionRate = data?.commissionRate ?? TIERS[safeCurrentIndex].rate;
  const referralTokenBalance = data?.referralTokenBalance || 0;

  const handleCopy = useCallback(() => {
    if (referralCode !== "—") {
      navigator.clipboard.writeText(referralCode);
      setCopied(true);
      if (copyBtnRef.current) {
        gsap.fromTo(
          copyBtnRef.current.querySelector(".copy-feedback"),
          { scale: 0.8, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.25, ease: "back.out(2)" }
        );
      }
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralCode]);


  return (
    <PageWrapper>
      <div className="space-y-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="gsap-section flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--text-primary)] font-['Space_Grotesk']">
            Referrals
          </h1>
          <span className="text-xs md:text-sm text-[var(--text-muted)] bg-[var(--bg-card)] border border-[var(--border-subtle)] px-3 py-1.5 rounded-lg self-start sm:self-auto">
            Current Tier:{" "}
            <span className={cn("font-semibold", TIERS[safeCurrentIndex].color)}>
              {TIERS[safeCurrentIndex].label}
            </span>
          </span>
        </div>

        {/* Tier Progression */}
        <div className="gsap-section grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 md:gap-4">
          {TIERS.map((tier, index) => (
            <TierCard
              key={tier.id}
              tier={tier}
              index={index}
              currentIndex={safeCurrentIndex}
              isActive={index === safeCurrentIndex}
            />
          ))}
        </div>

        {/* Stats + Code Row */}
        <div className="gsap-section grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Referral Code Card */}
          <div className="md:col-span-2 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-5 flex flex-col justify-between shadow-[var(--shadow-sm)]">
            <p className="text-[var(--text-muted)] text-sm font-medium mb-3">Your Referral Code</p>
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <div className="flex-1 min-w-0 bg-[var(--bg-hover)] border border-[var(--border-subtle)] rounded-lg px-4 py-3 text-lg md:text-xl font-mono font-bold tracking-wide text-[var(--text-primary)] flex items-center justify-center truncate">
                {referralCode}
              </div>
              <button
                ref={copyBtnRef}
                onClick={handleCopy}
                className={cn(
                  "relative px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors",
                  copied
                    ? "bg-[var(--success-glow)] text-[var(--success)] border border-[var(--success)]/20"
                    : "bg-[var(--bg-hover)] hover:bg-[var(--bg-pressed)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
                )}
              >
                <span className="copy-feedback flex items-center gap-2">
                  {copied ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </span>
              </button>
            </div>
          </div>

          {/* Total Referred Users */}
          <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-5 flex flex-col justify-between shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2 text-[var(--text-muted)] text-sm font-medium mb-2">
              <Users className="w-4 h-4" />
              Total Referred Users
            </div>
            <p className="text-3xl font-bold text-[var(--text-primary)] tracking-tight">
              {referrals.length}
            </p>
          </div>

          {/* Reward Token Balance */}
          <div className="bg-[var(--bg-card)] border border-[var(--primary)]/20 rounded-xl p-5 flex flex-col justify-between shadow-[var(--shadow-sm)]">
            <div className="flex items-center gap-2 text-[var(--primary)] text-sm font-medium mb-2">
              <Gift className="w-4 h-4" />
              Reward Token
            </div>
            <p className="text-3xl font-bold text-[var(--primary)] tracking-tight">
              {Number(referralTokenBalance).toFixed(4)}
            </p>
            <div className="flex items-center gap-2 mt-3 text-xs text-[var(--text-muted)]">
              <Coins className="w-3.5 h-3.5" />
              <span className="font-medium text-[var(--text-secondary)]">{Number(earnings).toFixed(4)}</span> total earned
            </div>
          </div>
        </div>

        {/* Reward Token Withdrawal History */}
        <div className="gsap-section bg-[var(--bg-card)] border border-[var(--primary)]/20 rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="px-5 py-3.5 border-b border-[var(--primary)]/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <h3 className="font-semibold text-sm text-[var(--primary)]">Reward Token Withdrawals</h3>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-hover)] px-2 py-1 rounded-md border border-[var(--border-subtle)]">
              {(withdrawals?.length || 0)} requests
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--text-muted)] border-b border-[var(--border-subtle)] bg-[var(--bg-hover)]/50">
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Amount</th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Requested</th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">Processed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {!withdrawals || withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-[var(--text-muted)]">
                      No withdrawal requests yet. Go to Wallet to request a withdrawal.
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((req: any) => {
                    const statusConfig: Record<
                      string,
                      { icon: any; color: string; label: string }
                    > = {
                      pending: { icon: Clock, color: "text-[var(--warning)]", label: "Pending" },
                      approved: { icon: CheckCircle, color: "text-[var(--success)]", label: "Approved" },
                      rejected: { icon: XCircle, color: "text-[var(--danger)]", label: "Rejected" },
                    };
                    const cfg = statusConfig[req.status] || statusConfig.pending;
                    const Icon = cfg.icon;
                    return (
                      <tr key={req.id} className="hover:bg-[var(--bg-hover)]/50 transition-colors">
                        <td className="px-5 py-3 text-[var(--primary)] font-medium">{Number(req.amount).toFixed(4)}</td>
                        <td className="px-5 py-3">
                          <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cfg.color)}>
                            <Icon className="w-3.5 h-3.5" /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[var(--text-muted)] text-xs">
                          {new Date(req.requestedAt).toLocaleString()}
                        </td>
                        <td className="px-5 py-3 text-[var(--text-muted)] text-xs">
                          {req.processedAt
                            ? new Date(req.processedAt).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Referred Users Table */}
        <div className="gsap-section bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden shadow-[var(--shadow-sm)]">
          <div className="px-5 py-3.5 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <h3 className="font-semibold text-sm text-[var(--text-primary)]">Referred Users</h3>
            <span className="text-xs text-[var(--text-muted)] bg-[var(--bg-hover)] px-2 py-1 rounded-md border border-[var(--border-subtle)]">
              {referrals.length} total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[var(--text-muted)] border-b border-[var(--border-subtle)] bg-[var(--bg-hover)]/50">
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">
                    Email
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">
                    Tier
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">
                    Commission Rate
                  </th>
                  <th className="text-left px-5 py-3 font-medium text-xs uppercase tracking-wider">
                    Joined Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-[var(--text-muted)]">
                      Loading...
                    </td>
                  </tr>
                ) : referrals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-full bg-[var(--bg-hover)] border border-[var(--border-subtle)] flex items-center justify-center mb-3">
                          <Users className="w-5 h-5 text-[var(--text-muted)]" />
                        </div>
                        <p className="text-[var(--text-secondary)] font-medium text-sm mb-1">
                          No referred users yet
                        </p>
                        <p className="text-[var(--text-muted)] text-xs max-w-xs">
                          Share your referral code to start earning commissions when new users join.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  referrals.map((ref: any) => {
                    const refTierIndex = TIERS.findIndex(
                      (t) => t.id === (ref.tier || "bronze")
                    );
                    const refTier = TIERS[refTierIndex === -1 ? 0 : refTierIndex];
                    const RefIcon = refTier.icon;
                    return (
                      <tr
                        key={ref.id}
                        className="hover:bg-[var(--bg-hover)]/50 transition-colors"
                      >
                        <td className="px-5 py-3 text-[var(--text-secondary)] font-medium">
                          {ref.referredUser?.email || "—"}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div
                              className={cn(
                                "w-6 h-6 rounded-full flex items-center justify-center",
                                refTier.bg
                              )}
                            >
                              <RefIcon className="w-3 h-3 text-[var(--text-invert)]" />
                            </div>
                            <span className="capitalize text-[var(--text-secondary)] text-sm">
                              {ref.tier || "bronze"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--bg-hover)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--text-secondary)]">
                            {(ref.commissionRate * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[var(--text-muted)] text-xs">
                          {ref.createdAt
                            ? new Date(ref.createdAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
