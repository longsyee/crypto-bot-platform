import React, { useEffect, useRef, useState } from 'react';
import { tokens } from '../../styles/design-tokens';

interface ProgressProps {
  value: number;
  max?: number;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

const sizeHeight: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export const Progress: React.FC<ProgressProps> = ({
  value,
  max = 100,
  color = tokens.colors.primary,
  size = 'md',
  showLabel = false,
  animated = true,
  className = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  const clamped = Math.min(Math.max(value, 0), max);
  const pct = max === 0 ? 0 : (clamped / max) * 100;

  useEffect(() => {
    if (!animated) {
      setDisplayValue(pct);
      return;
    }
    const timeout = setTimeout(() => setDisplayValue(pct), 50);
    return () => clearTimeout(timeout);
  }, [pct, animated]);

  return (
    <div className={['w-full', className].join(' ')}>
      <div
        className={[
          'w-full rounded-full bg-[var(--bg-surface)] overflow-hidden',
          sizeHeight[size],
        ].join(' ')}
      >
        <div
          ref={barRef}
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${displayValue}%`,
            backgroundColor: color,
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
      {showLabel && (
        <div className="mt-1 flex justify-between text-xs text-[var(--text-muted)]">
          <span>{Math.round(clamped)}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
};

export default Progress;
