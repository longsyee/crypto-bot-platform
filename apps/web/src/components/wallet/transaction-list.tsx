import React from 'react';
import { Badge } from '../ui/badge';
import { tokens } from '../../styles/design-tokens';

export type TxStatus = 'pending' | 'confirmed' | 'failed';

export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: number;
  status: TxStatus;
  date: string;
  txHash?: string;
}

const statusBadgeMap: Record<TxStatus, { bg: string; text: string; label: string }> = {
  pending: {
    bg: 'bg-[var(--warning)]/10',
    text: 'text-[var(--warning)]',
    label: 'Pending',
  },
  confirmed: {
    bg: 'bg-[var(--success)]/10',
    text: 'text-[var(--success)]',
    label: 'Confirmed',
  },
  failed: {
    bg: 'bg-[var(--danger)]/10',
    text: 'text-[var(--danger)]',
    label: 'Failed',
  },
};

interface TransactionListProps {
  transactions: Transaction[];
}

export const TransactionList: React.FC<TransactionListProps> = ({ transactions }) => {
  return (
    <div className="space-y-3">
      {transactions.map((tx) => {
        const badge = statusBadgeMap[tx.status];
        const isPositive = tx.type === 'deposit';

        return (
          <div
            key={tx.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4 transition-colors hover:bg-[var(--bg-surface)]"
          >
            <div className="flex items-center gap-4 min-w-0">
              <div
                className={[
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  isPositive ? 'bg-[var(--success)]/10 text-[var(--success)]' : 'bg-[var(--danger)]/10 text-[var(--danger)]',
                ].join(' ')}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  {isPositive ? (
                    <>
                      <line x1="12" y1="19" x2="12" y2="5" />
                      <polyline points="5 12 12 5 19 12" />
                    </>
                  ) : (
                    <>
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <polyline points="19 12 12 19 5 12" />
                    </>
                  )}
                </svg>
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--text-secondary)] capitalize">
                  {tx.type}
                </p>
                <p className="text-xs text-[var(--text-muted)]">{tx.date}</p>
                {tx.txHash && (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)] font-mono">
                    {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right">
              <p
                className={[
                  'text-base font-bold',
                  isPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]',
                ].join(' ')}
              >
                {isPositive ? '+' : '-'}${tx.amount.toFixed(2)}
              </p>
              <span
                className={[
                  'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                  badge.bg,
                  badge.text,
                ].join(' ')}
              >
                {badge.label}
              </span>
            </div>
          </div>
        );
      })}

      {transactions.length === 0 && (
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] p-8 text-center text-[var(--text-muted)]">
          No transactions yet.
        </div>
      )}
    </div>
  );
};

export default TransactionList;
