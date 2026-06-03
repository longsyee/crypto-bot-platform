import React, { useRef, useEffect, useState, useCallback } from 'react';
import gsap from 'gsap';
import { cn } from '../../lib/utils';

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  value,
  onValueChange,
  children,
  className,
}) => {
  return (
    <div className={cn('flex flex-col', className)}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;
        if (child.type === TabsList) {
          return React.cloneElement(child as React.ReactElement<TabsListProps>, {
            activeValue: value,
            onValueChange,
          });
        }
        if (child.type === TabsContent && child.props.value === value) {
          return child;
        }
        if (child.type === TabsContent) {
          return null;
        }
        return child;
      })}
    </div>
  );
};

Tabs.displayName = 'Tabs';

interface TabsListProps {
  children: React.ReactNode;
  activeValue?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

export const TabsList: React.FC<TabsListProps> = ({
  children,
  activeValue,
  onValueChange,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  const moveIndicator = useCallback(() => {
    if (!containerRef.current || !indicatorRef.current || !activeValue) return;

    const activeTab = containerRef.current.querySelector(
      `[data-tab-value="${activeValue}"]`
    ) as HTMLElement | null;

    if (activeTab) {
      gsap.to(indicatorRef.current, {
        x: activeTab.offsetLeft,
        width: activeTab.offsetWidth,
        duration: 0.35,
        ease: 'power2.out',
      });
    }
  }, [activeValue]);

  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      return;
    }
    moveIndicator();
  }, [mounted, activeValue, moveIndicator]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex items-center gap-1 border-b border-[var(--border-subtle)]/50 overflow-x-auto',
        className
      )}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child) || child.type !== TabsTrigger) return null;
        return React.cloneElement(child as React.ReactElement<TabsTriggerProps>, {
          isActive: child.props.value === activeValue,
          onSelect: () => onValueChange?.(child.props.value),
        });
      })}
      <div
        ref={indicatorRef}
        className="absolute bottom-0 h-0.5 bg-[var(--primary)] rounded-full"
        style={{ width: 0, left: 0 }}
      />
    </div>
  );
};

TabsList.displayName = 'TabsList';

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  isActive?: boolean;
  onSelect?: () => void;
  className?: string;
}

export const TabsTrigger: React.FC<TabsTriggerProps> = ({
  value,
  children,
  isActive,
  onSelect,
  className,
}) => {
  return (
    <button
      data-tab-value={value}
      onClick={onSelect}
      className={cn(
        'relative z-10 px-4 py-2.5 text-sm font-medium transition-colors',
        isActive ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
        className
      )}
    >
      {children}
    </button>
  );
};

TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

export const TabsContent: React.FC<TabsContentProps> = ({
  value,
  children,
  className,
}) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' }
      );
    }
  }, [value]);

  return (
    <div ref={ref} className={cn('mt-4', className)}>
      {children}
    </div>
  );
};

TabsContent.displayName = 'TabsContent';
