import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useMemo } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import {
  useAdminDashboard,
  useAdminUsers,
  useAdminBots,
  useUpdateUserRole,
  useSuspendUser,
  useCompanyStats,
  useAdminReferralWithdrawals,
  useApproveReferralWithdrawal,
  useRejectReferralWithdrawal,
  useToggleShowcasePaperTrades,
} from "../hooks/use-api";
import { useAuth } from "../hooks/use-auth";
import { PageWrapper } from "../components/layout/page-wrapper";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "../components/ui/tabs";
import { Card } from "../components/ui/card";
import { DataTable, Column } from "../components/ui/data-table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  ShieldAlert,
  Search,
  Gift,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

function useCountUpStat(ref: React.RefObject<HTMLElement | null>, target: number, duration = 1.5) {
  const hasRun = useRef(false);
  useGSAP(
    () => {
      if (!ref.current || hasRun.current) return;
      const el = ref.current;
      const obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration,
        ease: "power2.out",
        onUpdate: () => {
          if (el) {
            el.textContent = Math.round(obj.val).toLocaleString();
          }
        },
        onComplete: () => {
          hasRun.current = true;
        },
      });
    },
    { scope: ref, dependencies: [target] }
  );
}

type TabValue = "users" | "bots" | "health" | "company" | "referral-withdrawals";

function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabValue>("health");

  const { data: dash } = useAdminDashboard();
  const { data: users, isLoading: usersLoading, isError: usersError, error: usersErrorObj } = useAdminUsers();
  const { data: bots } = useAdminBots();
  const { data: companyStats } = useCompanyStats();
  const { data: withdrawals } = useAdminReferralWithdrawals("pending", 1, 50);

  const userList = users || [];

  const isAdmin = user?.role === "admin";

  const usersRef = useRef<HTMLSpanElement>(null);
  const botsRef = useRef<HTMLSpanElement>(null);
  const pendingRef = useRef<HTMLSpanElement>(null);
  const feesRef = useRef<HTMLSpanElement>(null);

  useCountUpStat(usersRef, dash?.totalUsers ?? 0, 1.2);
  useCountUpStat(botsRef, dash?.activeBots ?? 0, 1.2);
  useCountUpStat(pendingRef, companyStats?.pendingWithdrawalAmount ?? 0, 1.2);
  useCountUpStat(feesRef, dash?.totalFees ?? 0, 1.2);

  if (!isAdmin) {
    return (
      <PageWrapper>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <ShieldAlert className="h-16 w-16 text-[var(--danger)]" />
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Access Denied</h2>
          <p className="max-w-md text-[var(--text-muted)]">
            You do not have permission to view this page. Admin access is required.
          </p>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-6">
        <div className="gsap-section flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
            Admin Dashboard
          </h1>
          <p className="text-sm text-[var(--text-muted)]">
            Manage users, monitor bots, view company finances, and approve referral withdrawals.
          </p>
        </div>

        <div className="gsap-section">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="bots">Bots</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="company">Company</TabsTrigger>
              <TabsTrigger value="referral-withdrawals">Withdrawals</TabsTrigger>
            </TabsList>

            <TabsContent value="health">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden">
                <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 relative overflow-hidden border-t-2 border-[var(--primary)]">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Total Users</span>
                  <span ref={usersRef} className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)]">0</span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">{dash?.totalUsers ?? 0} registered</span>
                </div>
                <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 relative overflow-hidden border-t-2 border-[var(--success)]">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Active Bots</span>
                  <span ref={botsRef} className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)]">0</span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">{dash?.activeBots ?? 0} running</span>
                </div>
                <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 relative overflow-hidden border-t-2 border-[var(--warning)]">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Pending Withdrawals</span>
                  <span ref={pendingRef} className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--warning)]">0</span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">{Number(companyStats?.pendingWithdrawalAmount || 0).toFixed(2)} USDT</span>
                </div>
                <div className="bg-[var(--bg-card)] px-4 py-3 flex flex-col gap-1.5 relative overflow-hidden border-t-2 border-[#a78bfa]">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">Total Fees</span>
                  <span ref={feesRef} className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)]">0</span>
                  <span className="font-mono text-[11px] text-[var(--text-muted)]">{Number(dash?.totalFees || 0).toFixed(2)} USDT</span>
                </div>
              </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 mt-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">Audit Log</h3>
                  <span className="text-[11px] text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-secondary)]">View All</span>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-[var(--border-subtle)] last:border-b-0 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] shrink-0" />
                  <span className="flex-1 text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)] font-medium">Withdrawal approved</strong> — alex.morgan@protonmail.com · 1,250 USDT
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">2026-06-02 09:14</span>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-[var(--border-subtle)] last:border-b-0 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)] shrink-0" />
                  <span className="flex-1 text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)] font-medium">User suspended</strong> — jake.wright@outlook.com · spam violations
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">2026-06-02 08:41</span>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-[var(--border-subtle)] last:border-b-0 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] shrink-0" />
                  <span className="flex-1 text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)] font-medium">Role changed</strong> — sarah.chen@enterprise.io · user → admin
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">2026-06-01 22:03</span>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-[var(--border-subtle)] last:border-b-0 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] shrink-0" />
                  <span className="flex-1 text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)] font-medium">Bot started</strong> — DCA_BTC_01 · Binance · david.kim@trading.xyz
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">2026-06-01 19:27</span>
                </div>
                <div className="flex items-center gap-2.5 py-2 border-b border-[var(--border-subtle)] last:border-b-0 text-[11px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--primary)] shrink-0" />
                  <span className="flex-1 text-[var(--text-secondary)]">
                    <strong className="text-[var(--text-primary)] font-medium">Deposit confirmed</strong> — 5,000 USDT · maria.garcia@exchange.co
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">2026-06-01 14:55</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <UsersTab users={userList} total={userList.length} isLoading={usersLoading} isError={usersError} error={usersErrorObj} />
            </TabsContent>

            <TabsContent value="bots">
              <BotsTab bots={bots || []} />
            </TabsContent>

            <TabsContent value="company">
              <CompanyTab stats={companyStats} />
            </TabsContent>

            <TabsContent value="referral-withdrawals">
              <ReferralWithdrawalsTab requests={withdrawals || []} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageWrapper>
  );
}

function UsersTab({ users, total, isLoading, isError, error }: { users: any[]; total: number; isLoading?: boolean; isError?: boolean; error?: any }) {
  const [search, setSearch] = useState("");
  const updateRole = useUpdateUserRole();
  const suspendUser = useSuspendUser();
  const toggleShowcase = useToggleShowcasePaperTrades();

  const filtered = useMemo(() => {
    if (!search.trim()) return users;
    const q = search.toLowerCase();
    return users.filter(
      (u) =>
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, search]);

  const columns: Column<any>[] = [
    {
      key: "email",
      header: "Email",
      sortable: true,
      render: (u) => (
        <span className="font-medium text-[var(--text-primary)]">{u.email}</span>
      ),
    },
    {
      key: "role",
      header: "Role",
      sortable: true,
      render: (u) => (
        <Badge
          role={u.role}
          size="sm"
        />
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      render: (u) => (
        <span className="text-[var(--text-muted)]">
          {u.createdAt
            ? new Date(u.createdAt).toLocaleDateString()
            : "—"}
        </span>
      ),
    },
    {
      key: "showcasePaperTrades",
      header: "Showcase Paper",
      render: (u) => (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!u.showcasePaperTrades}
            onChange={(e) =>
              toggleShowcase.mutate({ id: u.id, showcasePaperTrades: e.target.checked })
            }
            disabled={toggleShowcase.isPending}
            className="h-4 w-4 rounded border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--accent)] focus:ring-[var(--accent)] focus:ring-offset-0"
          />
          <span className="text-xs text-[var(--text-muted)]">{u.showcasePaperTrades ? "On" : "Off"}</span>
        </label>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      render: (u) => (
        <div className="flex items-center gap-2">
          <select
            value={u.role}
            onChange={(e) =>
              updateRole.mutate({ id: u.id, role: e.target.value })
            }
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
            <option value="kol">kol</option>
          </select>
          <Button
            variant={u.suspended ? "primary" : "danger"}
            size="sm"
            className="text-[11px] px-2 py-1 h-auto"
            onClick={() =>
              suspendUser.mutate({ id: u.id, suspended: !u.suspended })
            }
          >
            {u.suspended ? "Unsuspend" : "Suspend"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)] dark:text-[var(--text-muted)]" />
          <Input
            placeholder="Search users by email or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[var(--bg-base)] border-[var(--border-subtle)] rounded-lg text-xs"
          />
        </div>
        <span className="text-sm text-[var(--text-muted)]">
          {total} total users
        </span>
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <div className="w-8 h-8 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
          <span className="text-sm text-[var(--text-muted)]">Loading users...</span>
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-xl border border-[var(--danger)]/20 bg-[var(--danger-glow)]/10 p-6 text-center">
          <p className="text-sm font-medium text-[var(--danger)]">Failed to load users.</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{error?.message || "Check your network connection or API server status."}</p>
        </div>
      )}

      {!isLoading && !isError && (
        <DataTable
          data={filtered}
          columns={columns}
          pageSize={10}
          searchable={false}
          className="rounded-lg border border-[var(--border-subtle)] text-xs"
        />
      )}

      <div className="flex items-center justify-center py-4">
        <span className="text-xs text-[var(--text-muted)]">
          Pagination controls placeholder — server-side pagination coming soon.
        </span>
      </div>
    </div>
  );
}

function BotsTab({ bots }: { bots: any[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return bots;
    const q = search.toLowerCase();
    return bots.filter(
      (b) =>
        b.name?.toLowerCase().includes(q) ||
        b.user?.email?.toLowerCase().includes(q) ||
        b.connection?.exchangeId?.toLowerCase().includes(q) ||
        b.status?.toLowerCase().includes(q) ||
        b.mode?.toLowerCase().includes(q)
    );
  }, [bots, search]);

  const columns: Column<any>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      render: (b) => (
        <span className="font-medium text-[var(--text-primary)]">{b.name}</span>
      ),
    },
    {
      key: "userEmail",
      header: "User Email",
      sortable: true,
      render: (b) => (
        <span className="text-[var(--text-secondary)]">
          {b.user?.email || "—"}
        </span>
      ),
    },
    {
      key: "exchange",
      header: "Exchange",
      sortable: true,
      render: (b) => (
        <span className="text-[var(--text-secondary)]">
          {b.connection?.exchangeId || "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (b) => (
        <Badge
          status={
            b.status === "running"
              ? "running"
              : b.status === "paused"
              ? "paused"
              : b.status === "error"
              ? "error"
              : "stopped"
          }
          size="sm"
        />
      ),
    },
    {
      key: "mode",
      header: "Mode",
      sortable: true,
      render: (b) => (
        <span className="capitalize text-[var(--text-secondary)]">{b.mode || "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)] dark:text-[var(--text-muted)]" />
          <Input
            placeholder="Search bots by name, user, exchange, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[var(--bg-base)] border-[var(--border-subtle)] rounded-lg text-xs"
          />
        </div>
        <span className="text-sm text-[var(--text-muted)]">
          {bots.length} total bots
        </span>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        pageSize={10}
        searchable={false}
        className="rounded-lg border border-[var(--border-subtle)] text-xs"
      />
    </div>
  );
}

function CompanyTab({ stats }: { stats?: any }) {
  return (
    <div className="space-y-6">
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Company Finances</h3>
        <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)] rounded-lg overflow-hidden mt-3">
          <div className="bg-[var(--bg-base)] p-3 flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Total Deposits Received</span>
            <span className="font-['Space_Grotesk'] text-base font-semibold text-[var(--success)]">
              {Number(stats?.totalDepositsReceived || 0).toFixed(2)} USDT
            </span>
          </div>
          <div className="bg-[var(--bg-base)] p-3 flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Total Referral Payouts</span>
            <span className="font-['Space_Grotesk'] text-base font-semibold text-[var(--danger)]">
              {Number(stats?.totalReferralPayouts || 0).toFixed(2)} USDT
            </span>
          </div>
          <div className="bg-[var(--bg-base)] p-3 flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Net Company Balance</span>
            <span className="font-['Space_Grotesk'] text-base font-semibold text-[var(--text-primary)]">
              {Number(stats?.companyUsdtBalance || 0).toFixed(2)} USDT
            </span>
          </div>
          <div className="bg-[var(--bg-base)] p-3 flex flex-col gap-1">
            <span className="text-[9px] uppercase tracking-wider text-[var(--text-muted)] font-semibold">Pending Withdrawals</span>
            <span className="font-['Space_Grotesk'] text-base font-semibold text-[var(--primary)]">
              {Number(stats?.pendingWithdrawalAmount || 0).toFixed(2)} USDT
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReferralWithdrawalsTab({ requests }: { requests: any[] }) {
  const approve = useApproveReferralWithdrawal();
  const reject = useRejectReferralWithdrawal();

  const avatarGradient = (id: string | number) => {
    const gradients = [
      'linear-gradient(135deg, var(--primary), var(--accent))',
      'linear-gradient(135deg, var(--success), var(--primary))',
      'linear-gradient(135deg, var(--warning), var(--danger))',
      'linear-gradient(135deg, var(--accent), var(--success))',
      'linear-gradient(135deg, var(--primary), var(--warning))',
    ];
    const index = typeof id === 'string' ? id.charCodeAt(0) % gradients.length : id % gradients.length;
    return gradients[index];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          Pending Referral Withdrawals
        </h3>
        <span className="text-sm text-[var(--text-muted)]">
          {requests.length} pending
        </span>
      </div>

      {requests.length === 0 ? (
        <Card className="p-8 bg-[var(--bg-card)] border-[var(--border-subtle)]">
          <div className="flex flex-col items-center justify-center text-center">
            <Gift className="h-12 w-12 text-[var(--text-muted)]" />
            <p className="mt-3 text-[var(--text-muted)]">No pending withdrawal requests.</p>
          </div>
        </Card>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4 space-y-1">
          {requests.map((req: any, idx: number) => (
            <div key={req.id} className="flex items-center gap-3 py-3 border-b border-[var(--border-subtle)] last:border-b-0">
              <div
                className="h-8 w-8 rounded-full shrink-0"
                style={{ background: avatarGradient(req.id || idx) }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                  {req.wallet?.user?.email || "—"}
                </div>
                <div className="text-[10px] text-[var(--text-muted)] font-mono">
                  {Number(req.amount).toFixed(4)} · {new Date(req.requestedAt).toLocaleString()}
                </div>
              </div>
              <div className="text-xs font-mono font-semibold text-[var(--text-primary)] shrink-0">
                {Number(req.amount).toFixed(4)}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => approve.mutate(req.id)}
                  disabled={approve.isPending}
                  className="px-2 py-1 text-[11px] rounded-md bg-[var(--success)] text-black font-semibold disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={() => reject.mutate({ id: req.id })}
                  disabled={reject.isPending}
                  className="px-2 py-1 text-[11px] rounded-md bg-[var(--danger)] text-white font-semibold disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
