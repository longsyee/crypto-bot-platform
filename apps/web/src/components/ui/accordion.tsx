import React, { useRef, useCallback, useState, useEffect } from 'react';
import gsap from 'gsap';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface AccordionItemProps {
  value: string;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  value,
  title,
  children,
  className,
}) => {
  return null;
};

AccordionItem.displayName = 'AccordionItem';

export interface AccordionProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string | undefined) => void;
  children: React.ReactNode;
  className?: string;
  allowMultiple?: boolean;
}

export const Accordion: React.FC<AccordionProps> = ({
  value: controlledValue,
  defaultValue,
  onValueChange,
  children,
  className,
  allowMultiple = false,
}) => {
  const [internalValue, setInternalValue] = useState<string | undefined>(defaultValue);
  const activeValue = controlledValue !== undefined ? controlledValue : internalValue;

  const handleValueChange = useCallback(
    (value: string) => {
      let next: string | undefined;
      if (allowMultiple) {
        // Not implementing multi-select in this version for simplicity
        next = activeValue === value ? undefined : value;
      } else {
        next = activeValue === value ? undefined : value;
      }
      setInternalValue(next);
      onValueChange?.(next);
    },
    [activeValue, allowMultiple, onValueChange]
  );

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child) || child.type !== AccordionItem) return null;
        return (
          <AccordionItemImpl
            key={child.props.value}
            value={child.props.value}
            title={child.props.title}
            className={child.props.className}
            isOpen={activeValue === child.props.value}
            onToggle={() => handleValueChange(child.props.value)}
          >
            {child.props.children}
          </AccordionItemImpl>
        );
      })}
    </div>
  );
};

Accordion.displayName = 'Accordion';

interface AccordionItemImplProps {
  value: string;
  title: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onToggle: () => void;
}

const AccordionItemImpl: React.FC<AccordionItemImplProps> = ({
  title,
  children,
  className,
  isOpen,
  onToggle,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const animateOpen = useCallback(() => {
    if (!contentRef.current || !innerRef.current || !arrowRef.current) return;
    tlRef.current?.kill();

    const tl = gsap.timeline();
    tl.set(contentRef.current, { height: 0, opacity: 0, overflow: 'hidden' });
    tl.to(contentRef.current, {
      height: innerRef.current.offsetHeight,
      opacity: 1,
      duration: 0.35,
      ease: 'power2.out',
    });
    tl.to(arrowRef.current, {
      rotation: 180,
      duration: 0.3,
      ease: 'power2.out',
    }, 0);
    tl.add(() => {
      if (contentRef.current) {
        contentRef.current.style.height = 'auto';
        contentRef.current.style.overflow = 'visible';
      }
    });
    tlRef.current = tl;
  }, []);

  const animateClose = useCallback(() => {
    if (!contentRef.current || !innerRef.current || !arrowRef.current) return;
    tlRef.current?.kill();

    const height = innerRef.current.offsetHeight;
    gsap.set(contentRef.current, { overflow: 'hidden' });

    const tl = gsap.timeline();
    tl.to(contentRef.current, {
      height: 0,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.inOut',
    });
    tl.to(arrowRef.current, {
      rotation: 0,
      duration: 0.3,
      ease: 'power2.out',
    }, 0);
    tlRef.current = tl;
  }, []);

  useEffect(() => {
    if (isOpen) {
      animateOpen();
    } else {
      animateClose();
    }
  }, [isOpen, animateOpen, animateClose]);

  useEffect(() => {
    return () => {
      tlRef.current?.kill();
    };
  }, []);

  return (
    <div
      className={cn(
        'rounded-lg border border-[var(--border-subtle)]/50 bg-[var(--bg-card)]/40 overflow-hidden',
        className
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[var(--bg-surface)]/30"
      >
        <span className="text-sm font-medium text-[var(--text-primary)]">{title}</span>
        <div ref={arrowRef}>
          <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
        </div>
      </button>
      <div ref={contentRef} style={{ height: 0, opacity: 0, overflow: 'hidden' }}>
        <div ref={innerRef} className="px-4 pb-3 text-sm text-[var(--text-muted)]">
          {children}
        </div>
      </div>
    </div>
  );
};

AccordionItemImpl.displayName = 'AccordionItemImpl';
