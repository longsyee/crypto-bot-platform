import React, { useRef, useCallback } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import gsap from 'gsap';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-base)] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:
          'bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] text-[var(--text-invert)] hover:from-[var(--accent)] hover:to-[var(--primary)] focus:ring-[var(--primary)]',
        secondary:
          'bg-[var(--bg-elevated)] text-[var(--text-primary)] hover:bg-[var(--bg-surface)] focus:ring-[var(--text-muted)] border border-[var(--border-subtle)]',
        ghost:
          'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] focus:ring-[var(--text-muted)]',
        danger:
          'bg-gradient-to-r from-[var(--danger)] to-red-600 text-[var(--text-invert)] hover:from-red-600 hover:to-[var(--danger)] focus:ring-[var(--danger)]',
      },
      size: {
        sm: 'px-2 py-1 text-[11px] rounded-md',
        md: 'px-3 py-1.5 text-xs rounded-lg',
        lg: 'px-6 py-3 text-base',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  className?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, children, onClick, ...props }, forwardedRef) => {
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const rippleRef = useRef<HTMLSpanElement | null>(null);

    const setRefs = useCallback(
      (node: HTMLButtonElement | null) => {
        buttonRef.current = node;
        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }
      },
      [forwardedRef]
    );

    const handleMouseEnter = useCallback(() => {
      if (buttonRef.current) {
        gsap.to(buttonRef.current, {
          scale: 1.02,
          duration: 0.25,
          ease: 'power2.out',
        });
      }
    }, []);

    const handleMouseLeave = useCallback(() => {
      if (buttonRef.current) {
        gsap.to(buttonRef.current, {
          scale: 1,
          duration: 0.25,
          ease: 'power2.out',
        });
      }
    }, []);

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        const btn = buttonRef.current;
        if (!btn) return;

        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement('span');
        ripple.className = 'absolute rounded-full bg-[var(--text-invert)]/30 pointer-events-none';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        ripple.style.width = '0px';
        ripple.style.height = '0px';
        ripple.style.transform = 'translate(-50%, -50%)';

        btn.appendChild(ripple);
        rippleRef.current = ripple;

        gsap.to(ripple, {
          width: rect.width * 2.5,
          height: rect.width * 2.5,
          opacity: 0,
          duration: 0.6,
          ease: 'power2.out',
          onComplete: () => {
            ripple.remove();
          },
        });

        onClick?.(e);
      },
      [onClick]
    );

    return (
      <button
        ref={setRefs}
        className={cn(buttonVariants({ variant, size }), className)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
