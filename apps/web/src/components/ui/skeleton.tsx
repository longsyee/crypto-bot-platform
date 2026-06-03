import React from 'react';
import { cn } from '../../lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'default' | 'circle' | 'text' | 'rect';
  width?: string | number;
  height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'default',
  width,
  height,
  style,
  ...props
}) => {
  const variantClass = {
    default: 'rounded-md',
    circle: 'rounded-full',
    text: 'rounded-md',
    rect: 'rounded-none',
  }[variant];

  return (
    <div
      className={cn(
        'animate-pulse bg-[var(--bg-surface)]/60',
        variantClass,
        className
      )}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      {...props}
    />
  );
};

Skeleton.displayName = 'Skeleton';

export interface SkeletonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  lines?: number;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  className,
  lines = 3,
  ...props
}) => (
  <div
    className={cn(
      'rounded-xl border border-[var(--border-subtle)]/50 bg-[var(--bg-card)]/40 p-5',
      className
    )}
    {...props}
  >
    <div className="flex items-center gap-3">
      <Skeleton variant="circle" width={40} height={40} />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton variant="text" width="60%" height={16} />
        <Skeleton variant="text" width="40%" height={12} />
      </div>
    </div>
    <div className="mt-4 flex flex-col gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" width={i === lines - 1 ? '80%' : '100%'} height={12} />
      ))}
    </div>
  </div>
);

SkeletonCard.displayName = 'SkeletonCard';

export interface SkeletonTableProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  rows?: number;
  columns?: number;
}

export const SkeletonTable: React.FC<SkeletonTableProps> = ({
  className,
  rows = 5,
  columns = 4,
  ...props
}) => (
  <div
    className={cn('w-full overflow-hidden rounded-xl border border-[var(--border-subtle)]/50', className)}
    {...props}
  >
    <div className="flex gap-3 border-b border-[var(--border-subtle)]/50 bg-[var(--bg-card)]/60 px-4 py-3">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={`h-${i}`} variant="text" className="flex-1" height={14} />
      ))}
    </div>
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={`r-${r}`}
          className="flex gap-3 px-4 py-3 odd:bg-[var(--bg-card)]/20 even:bg-[var(--bg-card)]/40"
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={`c-${r}-${c}`} variant="text" className="flex-1" height={14} />
          ))}
        </div>
      ))}
    </div>
  </div>
);

SkeletonTable.displayName = 'SkeletonTable';
