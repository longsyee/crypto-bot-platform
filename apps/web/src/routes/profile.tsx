import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useAuth } from "../hooks/use-auth";
import { useMe } from "../hooks/use-api";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  Mail,
  Shield,
  KeyRound,
  Calendar,
  Copy,
  Check,
  User as UserIcon,
  Wallet,
  ArrowLeft,
  AlertCircle,
  Terminal,
  ChevronRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const user = useAuth((s) => s.user);
  const { data: profile, isLoading, error } = useMe();
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!cardRef.current) return;
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }
      );
    },
    { scope: cardRef }
  );

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const joinedDate = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          to="/dashboard"
          className="p-2 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">
            Profile
          </h1>
          <p className="text-xs text-[var(--text-muted)]">Your account details</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[var(--text-muted)] border-t-teal-400 rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl bg-[var(--danger)]/10 border border-[var(--danger)]/20 p-4 text-center">
          <AlertCircle className="w-6 h-6 text-[var(--danger)] mx-auto mb-2" />
          <p className="text-sm text-[var(--danger)] font-medium">Failed to load profile</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{error instanceof Error ? error.message : "Unknown error"}</p>
          <p className="text-xs text-[var(--text-muted)] mt-2">Make sure the API server is running on port 3010</p>
        </div>
      ) : (
        <div ref={cardRef} className="space-y-4">
          <div className="relative rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] overflow-hidden">
            <div className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-[var(--accent)] flex items-center justify-center text-base font-bold text-[var(--bg-base)] shrink-0">
                  {profile?.email?.charAt(0).toUpperCase() || "U"}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {profile?.email || user?.email || "User"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-[1px] rounded-md text-[11px] font-medium ${
                        profile?.role === "admin"
                          ? "bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20"
                          : "bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border-subtle)]"
                      }`}
                    >
                      <Shield className="w-3 h-3" />
                      {profile?.role || "user"}
                    </span>
                    {profile?.emailVerified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-[1px] rounded-md text-[11px] font-medium bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20">
                        <Check className="w-3 h-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-[1px] rounded-md text-[11px] font-medium bg-[var(--warning)]/10 text-[var(--warning)] border border-[var(--warning)]/20">
                        Unverified
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden border border-[var(--border-subtle)] mt-4">
                <StatItem
                  icon={<Calendar className="w-3.5 h-3.5" />}
                  label="Member Since"
                  value={joinedDate}
                />
                <StatItem
                  icon={<KeyRound className="w-3.5 h-3.5" />}
                  label="Referral Code"
                  value={profile?.referralCode || "—"}
                  onCopy={
                    profile?.referralCode
                      ? () => handleCopy(profile.referralCode)
                      : undefined
                  }
                  copied={copied}
                />
                <StatItem
                  icon={<Mail className="w-3.5 h-3.5" />}
                  label="Email"
                  value={profile?.email || "—"}
                />
              </div>
            </div>
          </div>

          {profile?.wallet && (
            <div className="relative rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] overflow-hidden">
              <div className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                    Wallet Summary
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden border border-[var(--border-subtle)]">
                  <div className="bg-[var(--bg-card)] p-3 border-t-2 border-[var(--accent)]">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">USDT Balance</p>
                    <p className="font-mono text-xl font-semibold text-[var(--text-primary)] mt-1">
                      {typeof profile.wallet.usdtBalance === "number"
                        ? profile.wallet.usdtBalance.toFixed(4)
                        : "0.0000"}{" "}
                      <span className="text-xs text-[var(--text-muted)] font-normal">
                        USDT
                      </span>
                    </p>
                  </div>
                  <div className="bg-[var(--bg-card)] p-3 border-t-2 border-[var(--accent)]">
                    <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Token Balance</p>
                    <p className="font-mono text-xl font-semibold text-[var(--text-primary)] mt-1">
                      {typeof profile.wallet.tokenBalance === "number"
                        ? profile.wallet.tokenBalance.toFixed(4)
                        : "0.0000"}
                    </p>
                  </div>
                </div>
                {profile.wallet.bscAddress && (
                  <div className="mt-3 flex items-center gap-2 px-2 py-1.5 rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                    <span className="text-xs text-[var(--text-muted)] font-mono truncate">
                      {profile.wallet.bscAddress}
                    </span>
                    <button
                      onClick={() =>
                        handleCopy(profile.wallet!.bscAddress!)
                      }
                      className="ml-auto p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors shrink-0"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <Link
            to="/ai-integration"
            className="relative rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] overflow-hidden block hover:border-[var(--primary)]/30 transition-colors"
          >
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center text-[var(--primary)]">
                  <Terminal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] font-['Space_Grotesk'] tracking-tight">AI Agent Integration</h3>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Connect Claude, Cursor, or Cline to trade via MCP</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[var(--text-muted)]" />
            </div>
          </Link>

          <div className="relative rounded-xl bg-[var(--bg-card)] border border-[var(--border-subtle)] overflow-hidden">
            <div className="p-4">
              <h3 className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-3 flex items-center gap-2">
                <UserIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                Account Security
              </h3>
              <div className="divide-y divide-[var(--border-subtle)]">
                <SecurityRow
                  label="Password"
                  status="Set"
                  statusColor="emerald"
                />
                <SecurityRow
                  label="Two-Factor Authentication"
                  status="Not enabled"
                  statusColor="slate"
                />
                <SecurityRow
                  label="Email Verification"
                  status={profile?.emailVerified ? "Verified" : "Pending"}
                  statusColor={profile?.emailVerified ? "emerald" : "amber"}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
  onCopy,
  copied,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="bg-[var(--bg-card)] p-3 border-t-2 border-[var(--accent)]">
      <div className="flex items-center gap-1.5 text-[var(--text-muted)] mb-1">
        {icon}
        <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-[var(--text-primary)] truncate">{value}</span>
        {onCopy && (
          <button
            onClick={onCopy}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--accent)] transition-colors shrink-0"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function SecurityRow({
  label,
  status,
  statusColor,
}: {
  label: string;
  status: string;
  statusColor: "emerald" | "amber" | "slate";
}) {
  const colorMap = {
    emerald: "text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/20",
    amber: "text-[var(--warning)] bg-[var(--warning)]/10 border-[var(--warning)]/20",
    slate: "text-[var(--text-muted)] bg-[var(--bg-elevated)] border-[var(--border-subtle)]",
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span
        className={`px-2 py-[1px] rounded-md text-[11px] font-medium border ${colorMap[statusColor]}`}
      >
        {status}
      </span>
    </div>
  );
}
