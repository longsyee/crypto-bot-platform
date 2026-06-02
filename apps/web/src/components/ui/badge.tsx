import React from 'react';
import { cn } from '../../lib/utils';

export type BotStatus = 'running' | 'stopped' | 'paused' | 'error';
export type TierVariant = 'bronze' | 'silver' | 'gold' | 'platinum' | 'kol';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: BotStatus;
  tier?: TierVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<BotStatus, { label: string; dot: string; bg: string; text: string; border: string; glow: string }> = {
  running: {
    label: 'Running',
    dot: 'bg-green-500 dark:bg-green-400',
    bg: 'bg-green-500/10',
    text: 'text-green-600 dark:text-green-400',
    border: 'border-green-500/30',
    glow: 'shadow-[0_0_8px_rgba(34,197,94,0.25)]',
  },
  stopped: {
    label: 'Stopped',
    dot: 'bg-gray-500 dark:bg-gray-400',
    bg: 'bg-gray-500/10',
    text: 'text-gray-600 dark:text-gray-400',
    border: 'border-gray-500/30',
    glow: '',
  },
  paused: {
    label: 'Paused',
    dot: 'bg-amber-500 dark:bg-amber-400',
    bg: 'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-500/30',
    glow: 'shadow-[0_0_8px_rgba(245,158,11,0.25)]',
  },
  error: {
    label: 'Error',
    dot: 'bg-red-500 dark:bg-red-400',
    bg: 'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    border: 'border-red-500/30',
    glow: 'shadow-[0_0_8px_rgba(239,68,68,0.25)]',
  },
};

const tierConfig: Record<TierVariant, { label: string; bg: string; text: string; border: string }> = {
  bronze: { label: 'Bronze', bg: 'bg-amber-900/30', text: 'text-amber-600 dark:text-amber-500', border: 'border-amber-700/40' },
  silver: { label: 'Silver', bg: 'bg-slate-700/30', text: 'text-slate-600 dark:text-slate-300', border: 'border-slate-500/40' },
  gold: { label: 'Gold', bg: 'bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-600/40' },
  platinum: { label: 'Platinum', bg: 'bg-cyan-900/30', text: 'text-cyan-600 dark:text-cyan-300', border: 'border-cyan-500/40' },
  kol: { label: 'KOL', bg: 'bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-600/40' },
};

export const Badge: React.FC<BadgeProps> = ({ status, tier, size = 'md', className, children, ...props }) => {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm',
  };

  if (tier) {
    const config = tierConfig[tier];
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wide',
          config.bg,
          config.text,
          config.border,
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children || config.label}
      </span>
    );
  }

  const config = statusConfig[status || 'stopped'];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wide',
        config.bg,
        config.text,
        config.border,
        config.glow,
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dot)} />
      {children || config.label}
    </span>
  );
};

Badge.displayName = 'Badge';
