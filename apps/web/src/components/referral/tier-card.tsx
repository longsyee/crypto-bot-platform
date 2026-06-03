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
        'relative bg-[var(--bg-card)]',
        tier.isLocked ? 'opacity-60' : '',
      ].join(' ')}
      style={{ borderTop: `2px solid ${color}` }}
    >
      {tier.isLocked && (
        <div className="absolute top-2 right-2 text-[var(--text-muted)]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      )}

      <div className="p-3 space-y-0 divide-y divide-[var(--border-subtle)]">
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Badge tier={badgeVariant} size="sm" className="px-2 py-0.5 text-[10px] rounded-md" />
            {tier.isCurrent && (
              <span className="px-2 py-0.5 text-[10px] rounded-md bg-[var(--primary)]/15 text-[var(--primary)] font-semibold uppercase tracking-wider">
                Current
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-px bg-[var(--border-subtle)]">
          <div className="bg-[var(--bg-card)] p-2">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              Commission
            </p>
            <p className="font-mono text-xl font-semibold tracking-tight text-[var(--text-primary)] mt-0.5">
              {tier.commissionPercent}%
            </p>
          </div>
          <div className="bg-[var(--bg-card)] p-2">
            <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              Active Refs
            </p>
            <p className="font-mono text-xl font-semibold tracking-tight mt-0.5" style={{ color }}>
              {tier.activeReferrals}
            </p>
          </div>
        </div>

        {!tier.isLocked && tier.requiredForNext > 0 && (
          <div className="pt-2">
            <Progress
              value={progressValue}
              max={progressMax}
              color={color}
              size="sm"
              showLabel
            />
            <p className="mt-1 text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
              {Math.max(0, tier.requiredForNext - tier.activeReferrals)} more to next tier
            </p>
          </div>
        )}

        {tier.name === 'KOL' && tier.isLocked && (
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-widest text-[var(--warning)] font-semibold">
              KOL tier assigned manually by admin
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TierCard;
