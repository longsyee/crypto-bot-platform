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
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardDescription className="text-gray-500 dark:text-gray-400">{label}</CardDescription>
          <div className={`rounded-lg p-2 ${colorClass}`}>
            <Icon size={18} />
          </div>
        </div>
        <span ref={valueRef} className="block text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          0
        </span>
      </CardHeader>
    </Card>
  );
}

type TabValue = "users" | "bots" | "health";

function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabValue>("health");

  const { data: dash } = useAdminDashboard();
  const { data: usersPage } = useAdminUsers();
  const { data: bots } = useAdminBots();

  const users = usersPage?.data || [];

  const isAdmin = user?.role === "admin";

  if (!isAdmin) {
    return (
      <PageWrapper>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <ShieldAlert className="h-16 w-16 text-red-600 dark:text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h2>
          <p className="max-w-md text-gray-500 dark:text-gray-400">
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
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Admin Dashboard
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage users, monitor bots, and view platform health.
          </p>
        </div>

        <div className="gsap-section">
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="users">Users</TabsTrigger>
              <TabsTrigger value="bots">Bots</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
            </TabsList>

            <TabsContent value="health">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="stat-card">
                  <StatCard
                    label="Total Users"
                    value={dash?.totalUsers ?? 0}
                    icon={Users}
                    colorClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  />
                </div>
                <div className="stat-card">
                  <StatCard
                    label="Total Bots"
                    value={dash?.totalBots ?? 0}
                    icon={Bot}
                    colorClass="bg-purple-500/10 text-purple-600 dark:text-purple-400"
                  />
                </div>
                <div className="stat-card">
                  <StatCard
                    label="Active Bots"
                    value={dash?.activeBots ?? 0}
                    icon={Activity}
                    colorClass="bg-green-500/10 text-green-600 dark:text-green-400"
                  />
                </div>
                <div className="stat-card">
                  <StatCard
                    label="Total Fees"
                    value={dash?.totalFees ?? 0}
                    icon={DollarSign}
                    colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  />
                </div>
              </div>

              <div className="mt-8">
                <Card className="p-6">
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                    <ClipboardList className="h-12 w-12 text-gray-400 dark:text-gray-600" />
                    <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                      Audit Log
                    </h3>
                    <p className="max-w-sm text-sm text-gray-500">
                      No audit entries available. Audit logging will be enabled in a future update.
                    </p>
                  </div>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="users">
              <UsersTab users={users} total={usersPage?.meta?.total ?? users.length} />
            </TabsContent>

            <TabsContent value="bots">
              <BotsTab bots={bots || []} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </PageWrapper>
  );
}

function UsersTab({ users, total }: { users: any[]; total: number }) {
  const [search, setSearch] = useState("");
  const updateRole = useUpdateUserRole();
  const suspendUser = useSuspendUser();

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
        <span className="font-medium text-gray-900 dark:text-gray-100">{u.email}</span>
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
        <span className="text-gray-500 dark:text-gray-400">
          {u.createdAt
            ? new Date(u.createdAt).toLocaleDateString()
            : "—"}
        </span>
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
            className="rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none"
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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-500" />
          <Input
            placeholder="Search users by email or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {total} total users
        </span>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        pageSize={10}
        searchable={false}
        className="rounded-lg border border-gray-200 dark:border-gray-700"
      />

      <div className="flex items-center justify-center py-4">
        <span className="text-xs text-gray-500">
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
        <span className="font-medium text-gray-900 dark:text-gray-100">{b.name}</span>
      ),
    },
    {
      key: "userEmail",
      header: "User Email",
      sortable: true,
      render: (b) => (
        <span className="text-gray-600 dark:text-gray-300">
          {b.user?.email || "—"}
        </span>
      ),
    },
    {
      key: "exchange",
      header: "Exchange",
      sortable: true,
      render: (b) => (
        <span className="text-gray-600 dark:text-gray-300">
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
        <span className="capitalize text-gray-600 dark:text-gray-300">{b.mode || "—"}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-500" />
          <Input
            placeholder="Search bots by name, user, exchange, status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {bots.length} total bots
        </span>
      </div>

      <DataTable
        data={filtered}
        columns={columns}
        pageSize={10}
        searchable={false}
        className="rounded-lg border border-gray-200 dark:border-gray-700"
      />
    </div>
  );
}
