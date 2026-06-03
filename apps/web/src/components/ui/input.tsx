import React, { forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  containerClassName?: string;
  labelClassName?: string;
  suffix?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      containerClassName,
      labelClassName,
      id,
      suffix,
      ...props
    },
    ref
  ) => {
    const inputId = id || React.useId();

    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium text-[var(--text-secondary)]',
              error && 'text-[var(--danger)]',
              labelClassName
            )}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full rounded-lg border bg-[var(--bg-base)] px-3 py-2 text-xs text-[var(--text-primary)]',
              'placeholder:text-[var(--text-muted)]',
              'focus:outline-none focus:ring-2',
              'transition-all duration-200',
              suffix && 'pr-10',
              error
                ? 'border-[var(--danger)]/50 focus:border-[var(--danger)] focus:ring-[var(--danger)]/30'
                : 'border-[var(--border-subtle)] focus:border-[var(--primary)] focus:ring-[var(--primary)]/30',
              'disabled:cursor-not-allowed disabled:opacity-50',
              className
            )}
            {...props}
          />
          {suffix && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] pointer-events-none">
              {suffix}
            </div>
          )}
        </div>
        {error ? (
          <span className="text-xs font-medium text-[var(--danger)]">{error}</span>
        ) : helperText ? (
          <span className="text-xs text-[var(--text-muted)]">{helperText}</span>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
