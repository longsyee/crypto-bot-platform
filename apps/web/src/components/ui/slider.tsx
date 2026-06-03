import React, { useRef, useCallback, useState, useEffect } from 'react';
import gsap from 'gsap';
import { cn } from '../../lib/utils';

export interface SliderProps {
  min?: number;
  max?: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  showValue?: boolean;
  valueFormatter?: (value: number) => string;
  disabled?: boolean;
  className?: string;
  trackClassName?: string;
  fillClassName?: string;
  thumbClassName?: string;
}

export const Slider: React.FC<SliderProps> = ({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  label,
  showValue = true,
  valueFormatter = (v) => `${v}`,
  disabled = false,
  className,
  trackClassName,
  fillClassName,
  thumbClassName,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  const percentage = ((value - min) / (max - min)) * 100;

  const updateValueFromClientX = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const raw = ((clientX - rect.left) / rect.width) * (max - min) + min;
      const stepped = Math.round(raw / step) * step;
      const clamped = Math.min(Math.max(stepped, min), max);
      onChange(clamped);
    },
    [min, max, step, onChange]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      setDragging(true);
      updateValueFromClientX(e.clientX);
    },
    [disabled, updateValueFromClientX]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (disabled) return;
      setDragging(true);
      updateValueFromClientX(e.touches[0].clientX);
    },
    [disabled, updateValueFromClientX]
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging) updateValueFromClientX(e.clientX);
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (dragging) updateValueFromClientX(e.touches[0].clientX);
    };
    const handleUp = () => setDragging(false);

    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging, updateValueFromClientX]);

  useEffect(() => {
    if (fillRef.current) {
      gsap.to(fillRef.current, {
        width: `${percentage}%`,
        duration: dragging ? 0.05 : 0.3,
        ease: 'power2.out',
      });
    }
  }, [percentage, dragging]);

  useEffect(() => {
    if (thumbRef.current) {
      gsap.to(thumbRef.current, {
        scale: dragging || hovered ? 1.2 : 1,
        duration: 0.2,
        ease: 'power2.out',
      });
    }
  }, [dragging, hovered]);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        {label && (
          <label className="text-sm font-medium text-[var(--text-secondary)]">{label}</label>
        )}
        {showValue && (
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {valueFormatter(value)}
          </span>
        )}
      </div>
      <div
        ref={trackRef}
        className={cn(
          'relative h-2 w-full cursor-pointer rounded-full bg-[var(--bg-surface)]',
          disabled && 'cursor-not-allowed opacity-50',
          trackClassName
        )}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          ref={fillRef}
          className={cn(
            'absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)]',
            fillClassName
          )}
          style={{ width: `${percentage}%` }}
        />
        <div
          ref={thumbRef}
          className={cn(
            'absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-[var(--accent)] bg-[var(--bg-base)] shadow-lg',
            'transition-colors',
            thumbClassName
          )}
          style={{ left: `calc(${percentage}% - 8px)` }}
        />
      </div>
    </div>
  );
};

Slider.displayName = 'Slider';
