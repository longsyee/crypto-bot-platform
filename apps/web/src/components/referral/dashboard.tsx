import React from 'react';
import { TierCard, TierInfo } from './tier-card';
import { DataTable, Column } from '../ui/data-table';
import { tokens } from '../../styles/design-tokens';

interface EarningsRow {
  date: string;
  referredUser: string;
  amount: number;
  tier: string;
}

const tiers: TierInfo[] = [
  { name: 'Bronze', commissionPercent: 5, activeReferrals: 12, requiredForNext: 20, isCurrent: false },
  { name: 'Silver', commissionPercent: 8, activeReferrals: 12, requiredForNext: 50, isCurrent: true },
  { name: 'Gold', commissionPercent: 12, activeReferrals: 0, requiredForNext: 100, isCurrent: false },
  { name: 'Platinum', commissionPercent: 18, activeReferrals: 0, requiredForNext: 200, isCurrent: false },
  { name: 'KOL', commissionPercent: 25, activeReferrals: 0, requiredForNext: 0, isCurrent: false, isLocked: true },
];

const earningsData: EarningsRow[] = [
  { date: '2026-05-28', referredUser: 'user_7a3f', amount: 12.5, tier: 'Silver' },
  { date: '2026-05-27', referredUser: 'user_9b2e', amount: 8.0, tier: 'Silver' },
  { date: '2026-05-25', referredUser: 'user_c1d4', amount: 5.5, tier: 'Silver' },
];

const earningsColumns: Column<EarningsRow>[] = [
  { key: 'date', header: 'Date', sortable: true },
  { key: 'referredUser', header: 'Referred User', sortable: true },
  {
    key: 'amount',
    header: 'Amount (USDT)',
    sortable: true,
    render: (row) => (
      <span className="font-mono font-medium text-[var(--success)]">+{row.amount.toFixed(2)}</span>
    ),
  },
  {
    key: 'tier',
    header: 'Tier',
    sortable: true,
    render: (row) => (
      <span className="font-mono text-xs font-semibold text-[var(--text-secondary)]">{row.tier}</span>
    ),
  },
];

export const ReferralDashboard: React.FC = () => {
  const currentIdx = tiers.findIndex((t) => t.isCurrent);
  const currentTier = tiers[currentIdx];
  const nextTier = tiers[currentIdx + 1];

  return (
    <div className="space-y-6">
      {/* Tier grid — gap-px creates 1px dividers */}
      <div className="grid gap-px bg-[var(--border-subtle)] rounded-xl overflow-hidden border border-[var(--border-subtle)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tiers.map((tier) => (
          <TierCard key={tier.name} tier={tier} />
        ))}
      </div>

      {currentTier && nextTier && !nextTier.isLocked && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl p-4">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              Next Tier
            </span>
            <span className="font-mono text-xl font-semibold tracking-tight text-[var(--accent)]">
              {Math.max(0, nextTier.requiredForNext - currentTier.activeReferrals)}
            </span>
            <span className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              more active referrals to reach
            </span>
            <span
              className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight"
              style={{ color: tokens.colors.gold }}
            >
              {nextTier.name}
            </span>
          </div>
        </div>
      )}

      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <h3 className="font-['Space_Grotesk'] text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Earnings History
          </h3>
        </div>
        <div className="p-4">
          <DataTable
            data={earningsData}
            columns={earningsColumns}
            pageSize={5}
            searchable={false}
          />
        </div>
      </div>
    </div>
  );
};

export default ReferralDashboard;
