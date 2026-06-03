import React, { useState } from 'react';
import { tokens } from '../../styles/design-tokens';

interface DepositCardProps {
  address: string;
}

export const DepositCard: React.FC<DepositCardProps> = ({ address }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden">
      <div className="border-t-2 border-[var(--primary)] p-4">
        <h3 className="font-['Space_Grotesk'] text-xl font-semibold tracking-tight text-[var(--text-primary)]">
          Deposit USDT
        </h3>
      </div>

      <div className="divide-y divide-[var(--border-subtle)]">
        {/* QR Placeholder */}
        <div className="p-4">
          <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold mb-3">
            QR Code
          </p>
          <div className="flex items-center justify-center h-40 w-40 border border-[var(--border-subtle)] bg-[var(--bg-elevated)] rounded-md">
            <div className="text-center">
              <svg
                className="mx-auto mb-1 text-[var(--text-muted)]"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              <p className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                QR Code Placeholder
              </p>
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="p-4 space-y-2">
          <label className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
            BSC Address
          </label>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={address}
              className="w-full min-w-0 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-1 text-[11px] text-[var(--text-secondary)] focus:outline-none font-mono"
            />
            <button
              onClick={handleCopy}
              className={[
                'px-2 py-1 text-[11px] rounded-md font-medium transition-colors',
                copied
                  ? 'bg-[var(--success)]/20 text-[var(--success)] border border-[var(--success)]/40'
                  : 'bg-[var(--primary)] text-[var(--text-invert)] hover:bg-[var(--accent)]',
              ].join(' ')}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Network Warning */}
        <div className="p-4 border-t-2 border-[var(--warning)]">
          <div className="flex items-start gap-2">
            <svg
              className="mt-0.5 flex-shrink-0 text-[var(--warning)]"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-[var(--warning)] font-semibold">
                Network Warning
              </p>
              <p className="text-[11px] text-[var(--warning)]/80 leading-relaxed">
                Only send USDT (BEP20) on the BSC network. Deposits on other networks may be lost permanently.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepositCard;
