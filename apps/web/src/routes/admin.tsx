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
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../components/ui/card";
import { DataTable, Column } from "../components/ui/data-table";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  ShieldAlert,
  Users,
  Bot,
  Activity,
  DollarSign,
  Search,
  ClipboardList,
  Building2,
  Gift,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  Wallet,
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

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  colorClass: string;
}) {
  const valueRef = useRef<HTMLSpanElement>(null);
  useCountUpStat(valueRef, value ?? 0, 1.2);

  return (
    <Card className="overflow-hidden bg-[var(--bg-card)] border-[var(--border-subtle)]">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-[var(--text-muted)]">{label}</CardDescription>
          <div className={`rounded-lg p-2 ${colorClass}`}>
            <Icon size={18} />
          </div>
        </div>
        <span ref={valueRef} className="block text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          0
        </span>
      </CardHeader>
    </Card>
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="stat-card">
                  <StatCard
                    label="Total Users"
                    value={dash?.totalUsers ?? 0}
                    icon={Users}
                    colorClass="bg-[var(--accent)]/10 text-[var(--accent)]"
                  />
                </div>
                <div className="stat-card">
                  <StatCard
                    label="Total Bots"
                    value={dash?.totalBots ?? 0}
                    icon={Bot}
                    colorClass="bg-[var(--accent)]/10 text-[var(--accent)]"
                  />
                </div>
                <div className="stat-card">
                  <StatCard
                    label="Active Bots"
                    value={dash?.activeBots ?? 0}
                    icon={Activity}
                    colorClass="bg-[var(--success)]/10 text-[var(--success)]"
                  />
                </div>
                <div className="stat-card">
                  <StatCard
                    label="Total Fees"
                    value={dash?.totalFees ?? 0}
                    icon={DollarSign}
                    colorClass="bg-[var(--warning)]/10 text-[var(--warning)]"
                  />
                </div>
              </div>

              <div className="mt-8">
                <Card className="p-6 bg-[var(--bg-card)] border-[var(--border-subtle)]">
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <ClipboardList className="h-12 w-12 text-[var(--text-muted)]" />
                    <h3 className="text-lg font-semibold text-[var(--text-secondary)]">
                      Audit Log
                    </h3>
                    <p className="max-w-sm text-sm text-[var(--text-muted)]">
                      No audit entries available. Audit logging will be enabled in a future update.
                    </p>
                  </div>
                </Card>
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
          tier={
            u.role === "admin"
              ? "platinum"
              : u.role === "kol"
              ? "kol"
              : "silver"
          }
          size="sm"
        >
          {u.role}
        </Badge>
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
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-2 py-1 text-xs text-[var(--text-secondary)] focus:border-[var(--primary)] focus:outline-none"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
            <option value="kol">kol</option>
          </select>
          <Button
            variant={u.suspended ? "primary" : "danger"}
            size="sm"
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
            className="pl-9"
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
          className="rounded-lg border border-[var(--border-subtle)]"
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
            className="pl-9"
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
        className="rounded-lg border border-[var(--border-subtle)]"
      />
    </div>
  );
}

function CompanyTab({ stats }: { stats?: any }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="overflow-hidden bg-[var(--bg-card)] border-[var(--border-subtle)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[var(--text-muted)]">Total Deposits Received</CardDescription>
              <div className="rounded-lg p-2 bg-[var(--success)]/10 text-[var(--success)]">
                <ArrowDownLeft size={18} />
              </div>
            </div>
            <span className="block text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              {Number(stats?.totalDepositsReceived || 0).toFixed(2)} USDT
            </span>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden bg-[var(--bg-card)] border-[var(--border-subtle)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[var(--text-muted)]">Total Referral Payouts</CardDescription>
              <div className="rounded-lg p-2 bg-[var(--danger)]/10 text-[var(--danger)]">
                <ArrowUpRight size={18} />
              </div>
            </div>
            <span className="block text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              {Number(stats?.totalReferralPayouts || 0).toFixed(2)} USDT
            </span>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden bg-[var(--bg-card)] border-[var(--border-subtle)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[var(--text-muted)]">Net Company Balance</CardDescription>
              <div className="rounded-lg p-2 bg-[var(--accent)]/10 text-[var(--accent)]">
                <Wallet size={18} />
              </div>
            </div>
            <span className="block text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              {Number(stats?.companyUsdtBalance || 0).toFixed(2)} USDT
            </span>
          </CardHeader>
        </Card>

        <Card className="overflow-hidden bg-[var(--bg-card)] border-[var(--border-subtle)]">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-[var(--text-muted)]">Pending Withdrawals</CardDescription>
              <div className="rounded-lg p-2 bg-[var(--warning)]/10 text-[var(--warning)]">
                <Clock size={18} />
              </div>
            </div>
            <span className="block text-3xl font-bold tracking-tight text-[var(--text-primary)]">
              {Number(stats?.pendingWithdrawalAmount || 0).toFixed(2)} USDT
            </span>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}

function ReferralWithdrawalsTab({ requests }: { requests: any[] }) {
  const approve = useApproveReferralWithdrawal();
  const reject = useRejectReferralWithdrawal();

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
        <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-elevated)]">
              <tr className="text-[var(--text-muted)] border-b border-[var(--border-subtle)]">
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Amount (Reward Token)</th>
                <th className="text-left px-4 py-3 font-medium">Requested</th>
                <th className="text-left px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {requests.map((req: any) => (
                <tr key={req.id} className="hover:bg-[var(--bg-elevated)]/50 transition-colors">
                  <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                    {req.wallet?.user?.email || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--accent)] font-semibold">
                    {Number(req.amount).toFixed(4)}
                  </td>
                  <td className="px-4 py-3 text-[var(--text-muted)] text-xs">
                    {new Date(req.requestedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => approve.mutate(req.id)}
                        disabled={approve.isPending}
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => reject.mutate({ id: req.id })}
                        disabled={reject.isPending}
                      >
                        <XCircle className="w-4 h-4 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
