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
      <span className="font-medium text-green-400">+{row.amount.toFixed(2)}</span>
    ),
  },
  {
    key: 'tier',
    header: 'Tier',
    sortable: true,
    render: (row) => (
      <span className="text-xs font-semibold text-gray-300">{row.tier}</span>
    ),
  },
];

export const ReferralDashboard: React.FC = () => {
  const currentIdx = tiers.findIndex((t) => t.isCurrent);
  const currentTier = tiers[currentIdx];
  const nextTier = tiers[currentIdx + 1];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {tiers.map((tier) => (
          <TierCard key={tier.name} tier={tier} />
        ))}
      </div>

      {currentTier && nextTier && !nextTier.isLocked && (
        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
          <p className="text-sm text-gray-300">
            <span className="font-semibold text-blue-400">
              {Math.max(0, nextTier.requiredForNext - currentTier.activeReferrals)}
            </span>{' '}
            more active referrals to reach{' '}
            <span className="font-semibold" style={{ color: tokens.colors.gold }}>
              {nextTier.name}
            </span>
          </p>
        </div>
      )}

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-100">Earnings History</h3>
        <DataTable
          data={earningsData}
          columns={earningsColumns}
          pageSize={5}
          searchable={false}
        />
      </div>
    </div>
  );
};

export default ReferralDashboard;
