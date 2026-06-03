import React, { useRef, useEffect, useCallback } from 'react';
import gsap from 'gsap';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  className,
  showCloseButton = true,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      if (overlayRef.current && contentRef.current) {
        gsap.set(overlayRef.current, { opacity: 0 });
        gsap.set(contentRef.current, { scale: 0.95, opacity: 0 });

        tlRef.current = gsap.timeline();
        tlRef.current.to(overlayRef.current, {
          opacity: 1,
          duration: 0.25,
          ease: 'power2.out',
        });
        tlRef.current.to(
          contentRef.current,
          {
            scale: 1,
            opacity: 1,
            duration: 0.3,
            ease: 'back.out(1.7)',
          },
          '-=0.15'
        );
      }
    } else {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  useEffect(() => {
    return () => {
      tlRef.current?.kill();
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-[var(--bg-base)]/70 backdrop-blur-sm"
        style={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className={cn(
          'relative z-10 w-full max-w-lg rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]/95 p-6 shadow-2xl',
          className
        )}
        style={{ opacity: 0, transform: 'scale(0.95)' }}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {showCloseButton && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-md p-1 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        )}
        {title && (
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        )}
        {description && (
          <p className="mt-1.5 text-sm text-[var(--text-muted)]">{description}</p>
        )}
        <div className={cn((title || description) && 'mt-4')}>{children}</div>
      </div>
    </div>
  );
};

Dialog.displayName = 'Dialog';
