import React, { useRef, useState, useCallback, useEffect } from 'react';
import gsap from 'gsap';
import { ChevronDown, Search, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
}

export const Select: React.FC<SelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  error,
  searchable = false,
  disabled = false,
  className,
  triggerClassName,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const handleToggle = useCallback(() => {
    if (disabled) return;
    setOpen((prev) => !prev);
  }, [disabled]);

  const handleSelect = useCallback(
    (v: string) => {
      onChange(v);
      setOpen(false);
      setSearch('');
    },
    [onChange]
  );

  useEffect(() => {
    if (open && dropdownRef.current) {
      gsap.set(dropdownRef.current, { opacity: 0, y: -6, scaleY: 0.95 });
      tlRef.current = gsap.timeline();
      tlRef.current.to(dropdownRef.current, {
        opacity: 1,
        y: 0,
        scaleY: 1,
        duration: 0.2,
        ease: 'power2.out',
      });
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      tlRef.current?.kill();
    };
  }, []);

  return (
    <div ref={containerRef} className={cn('relative flex flex-col gap-1.5', className)}>
      {label && (
        <label className={cn('text-sm font-medium', error ? 'text-[var(--danger)]' : 'text-[var(--text-secondary)]')}>
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border bg-[var(--bg-elevated)] px-3 py-2.5 text-sm transition-all',
          'focus:outline-none focus:ring-2',
          error
            ? 'border-[var(--danger)]/50 text-[var(--danger)] focus:ring-[var(--danger)]/30'
            : 'border-[var(--border-subtle)] text-[var(--text-primary)] focus:border-[var(--primary)] focus:ring-[var(--primary)]/30',
          disabled && 'cursor-not-allowed opacity-50',
          triggerClassName
        )}
      >
        <span className={cn(!selected && 'text-[var(--text-muted)]')}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-[var(--text-muted)] transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>
      {error && <span className="text-xs font-medium text-[var(--danger)]">{error}</span>}

      {open && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-1 w-full origin-top overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] shadow-xl"
          style={{ top: '100%' }}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-3 py-2">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
                autoFocus
              />
            </div>
          )}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-[var(--text-muted)]">No results</li>
            )}
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  disabled={option.disabled}
                  onClick={() => handleSelect(option.value)}
                  className={cn(
                    'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors',
                    option.disabled
                      ? 'cursor-not-allowed opacity-40'
                      : 'hover:bg-[var(--bg-surface)] text-[var(--text-secondary)]',
                    value === option.value && 'bg-[var(--primary)]/10 text-[var(--primary)]'
                  )}
                >
                  {option.label}
                  {value === option.value && (
                    <Check className="h-4 w-4 text-[var(--primary)]" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

Select.displayName = 'Select';
