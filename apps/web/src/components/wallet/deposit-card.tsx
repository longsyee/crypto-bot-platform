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
    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg space-y-5">
      <h3 className="text-lg font-semibold text-gray-100">Deposit USDT</h3>

      {/* QR Placeholder */}
      <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-lg border-2 border-dashed border-gray-600 bg-gray-900">
        <div className="text-center">
          <svg
            className="mx-auto mb-2 text-gray-500"
            width="48"
            height="48"
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
          <p className="text-xs text-gray-500">QR Code Placeholder</p>
        </div>
      </div>

      {/* Address */}
      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-gray-400">
          BSC Address
        </label>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={address}
            className="w-full min-w-0 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300 focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className={[
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              copied
                ? 'bg-green-600/20 text-green-400 border border-green-600/40'
                : 'bg-blue-600 text-white hover:bg-blue-500',
            ].join(' ')}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Network Warning */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
        <div className="flex items-start gap-3">
          <svg
            className="mt-0.5 flex-shrink-0 text-amber-400"
            width="18"
            height="18"
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
            <p className="text-sm font-semibold text-amber-400">Network Warning</p>
            <p className="text-sm text-amber-200/80">
              Only send USDT (BEP20) on the BSC network. Deposits on other networks may be lost permanently.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepositCard;
