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
    dot: 'bg-[var(--success)]',
    bg: 'bg-[var(--success)]/10',
    text: 'text-[var(--success)]',
    border: 'border-[var(--success)]/30',
    glow: 'shadow-[0_0_8px_rgba(16,185,129,0.25)]',
  },
  stopped: {
    label: 'Stopped',
    dot: 'bg-[var(--text-muted)]',
    bg: 'bg-[var(--text-muted)]/10',
    text: 'text-[var(--text-muted)]',
    border: 'border-[var(--text-muted)]/30',
    glow: '',
  },
  paused: {
    label: 'Paused',
    dot: 'bg-[var(--warning)]',
    bg: 'bg-[var(--warning)]/10',
    text: 'text-[var(--warning)]',
    border: 'border-[var(--warning)]/30',
    glow: 'shadow-[0_0_8px_rgba(245,158,11,0.25)]',
  },
  error: {
    label: 'Error',
    dot: 'bg-[var(--danger)]',
    bg: 'bg-[var(--danger)]/10',
    text: 'text-[var(--danger)]',
    border: 'border-[var(--danger)]/30',
    glow: 'shadow-[0_0_8px_rgba(239,68,68,0.25)]',
  },
};

const tierConfig: Record<TierVariant, { label: string; bg: string; text: string; border: string }> = {
  bronze: { label: 'Bronze', bg: 'bg-[var(--warning)]/10', text: 'text-[var(--warning)]', border: 'border-[var(--warning)]/30' },
  silver: { label: 'Silver', bg: 'bg-[var(--bg-elevated)]', text: 'text-[var(--text-secondary)]', border: 'border-[var(--border-subtle)]' },
  gold: { label: 'Gold', bg: 'bg-[var(--warning)]/10', text: 'text-[var(--warning)]', border: 'border-[var(--warning)]/30' },
  platinum: { label: 'Platinum', bg: 'bg-[var(--accent)]/10', text: 'text-[var(--accent)]', border: 'border-[var(--accent)]/30' },
  kol: { label: 'KOL', bg: 'bg-[var(--warning)]/10', text: 'text-[var(--warning)]', border: 'border-[var(--warning)]/30' },
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
