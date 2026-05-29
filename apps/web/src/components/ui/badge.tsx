import React from 'react';
import { tokens } from '../../styles/design-tokens';

export type TierVariant = 'bronze' | 'silver' | 'gold' | 'platinum' | 'kol';
export type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
  tier: TierVariant;
  size?: BadgeSize;
  children?: React.ReactNode;
}

const tierStyles: Record<TierVariant, { bg: string; text: string; border: string; glow?: string }> = {
  bronze: {
    bg: 'bg-amber-900/40',
    text: 'text-amber-400',
    border: 'border-amber-700',
    glow: 'shadow-[0_0_8px_rgba(205,127,50,0.4)]',
  },
  silver: {
    bg: 'bg-gray-700/50',
    text: 'text-gray-300',
    border: 'border-gray-500',
    glow: 'shadow-[0_0_8px_rgba(192,192,192,0.4)]',
  },
  gold: {
    bg: 'bg-yellow-900/40',
    text: 'text-yellow-400',
    border: 'border-yellow-600',
    glow: 'shadow-[0_0_10px_rgba(255,215,0,0.5)]',
  },
  platinum: {
    bg: 'bg-slate-700/50',
    text: 'text-slate-200',
    border: 'border-slate-400',
    glow: 'shadow-[0_0_10px_rgba(229,228,226,0.5)]',
  },
  kol: {
    bg: 'bg-orange-900/50',
    text: 'text-orange-400',
    border: 'border-orange-600',
    glow: 'shadow-[0_0_12px_rgba(255,69,0,0.6)]',
  },
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
  lg: 'px-4 py-1.5 text-base',
};

export const Badge: React.FC<BadgeProps> = ({ tier, size = 'md', children }) => {
  const style = tierStyles[tier];
  const label = tier.toUpperCase();

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border font-semibold tracking-wide uppercase',
        style.bg,
        style.text,
        style.border,
        style.glow || '',
        sizeStyles[size],
      ].join(' ')}
    >
      <span
        className="inline-block rounded-full"
        style={{
          width: size === 'sm' ? 6 : size === 'md' ? 8 : 10,
          height: size === 'sm' ? 6 : size === 'md' ? 8 : 10,
          backgroundColor: tokens.colors[tier],
        }}
      />
      {children || label}
    </span>
  );
};

export default Badge;
