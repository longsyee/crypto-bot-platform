import React, { useState } from 'react';
import { DataTable, Column } from '../ui/data-table';
import { Badge } from '../ui/badge';
import { ConfirmModal } from '../ui/confirm-modal';
import { tokens } from '../../styles/design-tokens';

type AdminTab = 'users' | 'bots' | 'referrals' | 'health' | 'security';

const tabs: { key: AdminTab; label: string }[] = [
  { key: 'users', label: 'Users' },
  { key: 'bots', label: 'Bots' },
  { key: 'referrals', label: 'Referrals' },
  { key: 'health', label: 'System Health' },
  { key: 'security', label: 'Security' },
];

interface UserRow {
  id: string;
  email: string;
  tier: string;
  activeBots: number;
  status: 'active' | 'suspended';
  joined: string;
}

interface BotRow {
  id: string;
  owner: string;
  type: string;
  exchange: string;
  status: 'running' | 'stopped' | 'error';
  profit: number;
}

interface ReferralRow {
  id: string;
  referrer: string;
  referred: string;
  tier: string;
  commission: number;
  date: string;
}

interface HealthRow {
  service: string;
  uptime: string;
  status: 'healthy' | 'degraded' | 'down';
  latency: string;
}

interface SecurityRow {
  event: string;
  user: string;
  ip: string;
  severity: 'low' | 'medium' | 'high';
  time: string;
}

const usersData: UserRow[] = [
  { id: 'u1', email: 'alice@example.com', tier: 'Gold', activeBots: 3, status: 'active', joined: '2026-01-15' },
  { id: 'u2', email: 'bob@example.com', tier: 'Silver', activeBots: 1, status: 'active', joined: '2026-03-02' },
  { id: 'u3', email: 'charlie@example.com', tier: 'Bronze', activeBots: 0, status: 'suspended', joined: '2026-04-20' },
];

const botsData: BotRow[] = [
  { id: 'b1', owner: 'alice@example.com', type: 'DCA', exchange: 'Binance', status: 'running', profit: 124.5 },
  { id: 'b2', owner: 'alice@example.com', type: 'Signal', exchange: 'Bybit', status: 'running', profit: 45.2 },
  { id: 'b3', owner: 'bob@example.com', type: 'DCA', exchange: 'OKX', status: 'error', profit: -12.0 },
];

const referralsData: ReferralRow[] = [
  { id: 'r1', referrer: 'alice@example.com', referred: 'bob@example.com', tier: 'Silver', commission: 8.0, date: '2026-03-02' },
  { id: 'r2', referrer: 'alice@example.com', referred: 'dave@example.com', tier: 'Bronze', commission: 5.0, date: '2026-05-10' },
];

const healthData: HealthRow[] = [
  { service: 'API Gateway', uptime: '99.98%', status: 'healthy', latency: '24ms' },
  { service: 'Bot Engine', uptime: '99.91%', status: 'healthy', latency: '42ms' },
  { service: 'Webhook Receiver', uptime: '99.50%', status: 'degraded', latency: '180ms' },
  { service: 'Notification Queue', uptime: '100%', status: 'healthy', latency: '12ms' },
];

const securityData: SecurityRow[] = [
  { event: 'Failed login', user: 'bob@example.com', ip: '203.0.113.45', severity: 'low', time: '2026-05-28 14:22' },
  { event: 'Suspicious withdrawal', user: 'alice@example.com', ip: '198.51.100.12', severity: 'high', time: '2026-05-28 09:10' },
];

function statusBadge(status: string) {
  const map: Record<string, string> = {
    active: 'bg-[var(--success)]/15 text-[var(--success)]',
    suspended: 'bg-[var(--danger)]/15 text-[var(--danger)]',
    running: 'bg-[var(--success)]/15 text-[var(--success)]',
    stopped: 'bg-[var(--bg-surface)] text-[var(--text-muted)]',
    error: 'bg-[var(--danger)]/15 text-[var(--danger)]',
    healthy: 'bg-[var(--success)]/15 text-[var(--success)]',
    degraded: 'bg-[var(--warning)]/15 text-[var(--warning)]',
    down: 'bg-[var(--danger)]/15 text-[var(--danger)]',
    low: 'bg-[var(--accent)]/15 text-[var(--accent)]',
    medium: 'bg-[var(--warning)]/15 text-[var(--warning)]',
    high: 'bg-[var(--danger)]/15 text-[var(--danger)]',
  };
  const cls = map[status] || 'bg-[var(--bg-surface)] text-[var(--text-muted)]';
  return (
    <span className={['rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', cls].join(' ')}>
      {status}
    </span>
  );
}

const userCols: Column<UserRow>[] = [
  { key: 'email', header: 'Email', sortable: true },
  { key: 'tier', header: 'Tier', sortable: true },
  { key: 'activeBots', header: 'Active Bots', sortable: true },
  { key: 'status', header: 'Status', sortable: true, render: (r) => statusBadge(r.status) },
  { key: 'joined', header: 'Joined', sortable: true },
];

const botCols: Column<BotRow>[] = [
  { key: 'owner', header: 'Owner', sortable: true },
  { key: 'type', header: 'Type', sortable: true },
  { key: 'exchange', header: 'Exchange', sortable: true },
  { key: 'status', header: 'Status', sortable: true, render: (r) => statusBadge(r.status) },
  {
    key: 'profit',
    header: 'Profit (USDT)',
    sortable: true,
    render: (r) => (
      <span className={r.profit >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}>
        {r.profit >= 0 ? '+' : ''}{r.profit.toFixed(2)}
      </span>
    ),
  },
];

const refCols: Column<ReferralRow>[] = [
  { key: 'referrer', header: 'Referrer', sortable: true },
  { key: 'referred', header: 'Referred', sortable: true },
  { key: 'tier', header: 'Tier', sortable: true },
  {
    key: 'commission',
    header: 'Commission %',
    sortable: true,
    render: (r) => <span className="text-[var(--accent)]">{r.commission}%</span>,
  },
  { key: 'date', header: 'Date', sortable: true },
];

const healthCols: Column<HealthRow>[] = [
  { key: 'service', header: 'Service', sortable: true },
  { key: 'uptime', header: 'Uptime', sortable: true },
  { key: 'status', header: 'Status', sortable: true, render: (r) => statusBadge(r.status) },
  { key: 'latency', header: 'Latency', sortable: true },
];

const securityCols: Column<SecurityRow>[] = [
  { key: 'event', header: 'Event', sortable: true },
  { key: 'user', header: 'User', sortable: true },
  { key: 'ip', header: 'IP', sortable: true },
  { key: 'severity', header: 'Severity', sortable: true, render: (r) => statusBadge(r.severity) },
  { key: 'time', header: 'Time', sortable: true },
];

export const AdminLayout: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('users');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState('');

  const openConfirm = (action: string) => {
    setConfirmAction(action);
    setConfirmOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Admin Panel</h2>
        <button
          onClick={() => openConfirm('System restart')}
          className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-[var(--text-invert)] hover:bg-red-700"
        >
          Restart Services
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-[var(--bg-card)] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              'rounded-md px-4 py-2 text-sm font-medium transition-colors',
              tab === t.key
                ? 'bg-[var(--primary)] text-[var(--text-invert)] shadow'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-5 shadow-lg">
        {tab === 'users' && (
          <DataTable data={usersData} columns={userCols} pageSize={8} searchable={true} />
        )}
        {tab === 'bots' && (
          <DataTable data={botsData} columns={botCols} pageSize={8} searchable={true} />
        )}
        {tab === 'referrals' && (
          <DataTable data={referralsData} columns={refCols} pageSize={8} searchable={true} />
        )}
        {tab === 'health' && (
          <DataTable data={healthData} columns={healthCols} pageSize={6} searchable={false} />
        )}
        {tab === 'security' && (
          <DataTable data={securityData} columns={securityCols} pageSize={8} searchable={true} />
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirm Action"
        message={`Are you sure you want to ${confirmAction.toLowerCase()}? This may affect active users and bots.`}
        destructive={true}
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmOpen(false);
          setConfirmAction('');
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

export default AdminLayout;
