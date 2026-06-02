import { createFileRoute } from "@tanstack/react-router";
import { useReferrals } from "../hooks/use-api";
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
  { id: "bronze", label: "Bronze", rate: 5, icon: Medal, color: "text-amber-600", bg: "bg-amber-600", ring: "ring-amber-600/30", shadow: "shadow-amber-600/20", bar: "bg-amber-500" },
  { id: "silver", label: "Silver", rate: 12, icon: Award, color: "text-slate-300", bg: "bg-slate-400", ring: "ring-slate-400/30", shadow: "shadow-slate-400/20", bar: "bg-slate-400" },
  { id: "gold", label: "Gold", rate: 20, icon: Crown, color: "text-yellow-400", bg: "bg-yellow-400", ring: "ring-yellow-400/30", shadow: "shadow-yellow-400/20", bar: "bg-yellow-400" },
  { id: "platinum", label: "Platinum", rate: 28, icon: Gem, color: "text-cyan-300", bg: "bg-cyan-400", ring: "ring-cyan-400/30", shadow: "shadow-cyan-400/20", bar: "bg-cyan-400" },
  { id: "kol", label: "KOL", rate: 35, icon: Star, color: "text-violet-400", bg: "bg-violet-500", ring: "ring-violet-500/30", shadow: "shadow-violet-500/20", bar: "bg-violet-500" },
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
          ? "bg-[#1a1d29] border-white/10 shadow-[0_0_20px_rgba(59,130,246,0.12)]"
          : isReached
          ? "bg-[#13161f] border-white/[0.04] opacity-80"
          : isNext
          ? "bg-[#13161f] border-white/[0.04] opacity-60"
          : "bg-[#13161f] border-white/[0.04] opacity-40"
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
          isActive ? tier.bg : "bg-white/5",
          isActive ? tier.shadow : "",
          isActive ? "shadow-lg" : ""
        )}
      >
        <Icon
          className={cn("w-5 h-5", isActive ? "text-white" : "text-slate-500")}
        />
      </div>

      <p
        className={cn(
          "text-xs font-semibold uppercase tracking-wider",
          isActive ? "text-white" : "text-slate-500"
        )}
      >
        {tier.label}
      </p>
      <p
        className={cn(
          "text-lg font-bold mt-0.5",
          isActive ? tier.color : "text-slate-600"
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
              isReached ? tier.bar : "bg-slate-700"
            )}
          />
          <ArrowRight
            className={cn(
              "absolute -right-1 -top-[7px] w-3.5 h-3.5",
              isReached ? tier.color : "text-slate-700"
            )}
          />
        </div>
      )}
    </div>
  );
}

function ReferralsPage() {
  const { data, isLoading } = useReferrals();
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
            Referrals
          </h1>
          <span className="text-xs md:text-sm text-slate-400 bg-[#1a1d29] border border-white/[0.06] px-3 py-1.5 rounded-lg self-start sm:self-auto">
            Current Tier: {" "}
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
          <div className="md:col-span-2 bg-[#1a1d29] border border-white/[0.06] rounded-xl p-5 flex flex-col justify-between">
            <p className="text-slate-400 text-sm font-medium mb-3">Your Referral Code</p>
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <div className="flex-1 min-w-0 bg-[#0f1117] border border-white/[0.06] rounded-lg px-4 py-3 text-lg md:text-xl font-mono font-bold tracking-wide text-white flex items-center justify-center truncate">
                {referralCode}
              </div>
              <button
                ref={copyBtnRef}
                onClick={handleCopy}
                className={cn(
                  "relative px-4 py-3 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors",
                  copied
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-[#0f1117] hover:bg-[#1e2130] text-slate-200 border border-white/[0.06]"
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
          <div className="bg-[#1a1d29] border border-white/[0.06] rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium mb-2">
              <Users className="w-4 h-4" />
              Total Referred Users
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">
              {referrals.length}
            </p>
          </div>

          {/* Commission Rate + Earnings */}
          <div className="bg-[#1a1d29] border border-white/[0.06] rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center gap-2 text-slate-400 text-sm font-medium mb-2">
              <Percent className="w-4 h-4" />
              Commission Rate
            </div>
            <p className="text-3xl font-bold text-white tracking-tight">
              {commissionRate}%
            </p>
            <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
              <Coins className="w-3.5 h-3.5" />
              <span className="font-medium text-slate-300">{earnings}</span> TOKEN earned
            </div>
          </div>
        </div>

        {/* Referred Users Table */}
        <div className="gsap-section bg-[#1a1d29] border border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <h3 className="font-semibold text-sm text-white">Referred Users</h3>
            <span className="text-xs text-slate-500 bg-[#0f1117] px-2 py-1 rounded-md border border-white/[0.04]">
              {referrals.length} total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-white/[0.06] bg-[#13161f]/50">
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
              <tbody className="divide-y divide-white/[0.04]">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                      Loading...
                    </td>
                  </tr>
                ) : referrals.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-full bg-[#0f1117] border border-white/[0.06] flex items-center justify-center mb-3">
                          <Users className="w-5 h-5 text-slate-500" />
                        </div>
                        <p className="text-slate-300 font-medium text-sm mb-1">
                          No referred users yet
                        </p>
                        <p className="text-slate-500 text-xs max-w-xs">
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
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3 text-slate-200 font-medium">
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
                              <RefIcon className="w-3 h-3 text-white" />
                            </div>
                            <span className="capitalize text-slate-300 text-sm">
                              {ref.tier || "bronze"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#0f1117] border border-white/[0.06] text-xs font-semibold text-slate-300">
                            {(ref.commissionRate * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs">
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
