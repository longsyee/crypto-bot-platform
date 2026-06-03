import React from 'react';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { tokens } from '../../styles/design-tokens';

export type TierName = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'KOL';

export interface TierInfo {
  name: TierName;
  commissionPercent: number;
  activeReferrals: number;
  requiredForNext: number;
  isCurrent?: boolean;
  isLocked?: boolean;
}

const tierBadgeMap: Record<TierName, import('../ui/badge').TierVariant> = {
  Bronze: 'bronze',
  Silver: 'silver',
  Gold: 'gold',
  Platinum: 'platinum',
  KOL: 'kol',
};

const tierColorMap: Record<TierName, string> = {
  Bronze: tokens.colors.bronze,
  Silver: tokens.colors.silver,
  Gold: tokens.colors.gold,
  Platinum: tokens.colors.platinum,
  KOL: tokens.colors.kol,
};

interface TierCardProps {
  tier: TierInfo;
}

export const TierCard: React.FC<TierCardProps> = ({ tier }) => {
  const color = tierColorMap[tier.name];
  const badgeVariant = tierBadgeMap[tier.name];
  const progressMax = tier.requiredForNext || 1;
  const progressValue = Math.min(tier.activeReferrals, progressMax);

  return (
    <div
      className={[
        'relative rounded-xl border p-5 bg-[var(--bg-card)] transition-all',
        tier.isCurrent
          ? 'border-[var(--primary)]/60 shadow-[0_0_20px_rgba(var(--primary-rgb),0.25)]'
          : 'border-[var(--border-subtle)] shadow-lg',
        tier.isLocked ? 'opacity-70' : '',
      ].join(' ')}
    >
      {tier.isLocked && (
        <div className="absolute top-3 right-3 text-[var(--text-muted)]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Badge tier={badgeVariant} size="lg" />
        {tier.isCurrent && (
          <span className="rounded-full bg-[var(--primary)]/15 px-2 py-0.5 text-xs font-medium text-[var(--primary)]">
            Current
          </span>
        )}
      </div>

      <div className="mt-4 space-y-1">
        <p className="text-3xl font-bold text-[var(--text-primary)]">
          {tier.commissionPercent}%
        </p>
        <p className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Commission per referral</p>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className="text-[var(--text-secondary)]">Active referrals:</span>
        <span className="font-semibold" style={{ color }}>{tier.activeReferrals}</span>
      </div>

      {!tier.isLocked && tier.requiredForNext > 0 && (
        <div className="mt-3">
          <Progress
            value={progressValue}
            max={progressMax}
            color={color}
            size="sm"
            showLabel
          />
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            {Math.max(0, tier.requiredForNext - tier.activeReferrals)} more to next tier
          </p>
        </div>
      )}

      {tier.name === 'KOL' && tier.isLocked && (
        <p className="mt-3 text-xs text-[var(--warning)]">
          KOL tier is assigned manually by admin.
        </p>
      )}
    </div>
  );
};

export default TierCard;
