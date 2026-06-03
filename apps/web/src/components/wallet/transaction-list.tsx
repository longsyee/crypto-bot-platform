import React from 'react';

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
    <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl overflow-hidden divide-y divide-[var(--border-subtle)]">
      {transactions.length > 0 ? (
        transactions.map((tx) => {
          const badge = statusBadgeMap[tx.status];
          const isPositive = tx.type === 'deposit';
          const accentColor =
            tx.status === 'pending'
              ? 'border-[var(--warning)]'
              : tx.status === 'failed'
              ? 'border-[var(--danger)]'
              : 'border-[var(--success)]';

          return (
            <div
              key={tx.id}
              className={[
                'flex items-stretch gap-px bg-[var(--border-subtle)] border-t-2',
                accentColor,
              ].join(' ')}
            >
              <div className="flex-1 bg-[var(--bg-card)] px-3 py-2.5 min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                  Type
                </div>
                <div className="font-['Space_Grotesk'] text-sm font-semibold tracking-tight capitalize text-[var(--text-secondary)]">
                  {tx.type}
                </div>
                <div className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5">
                  {tx.date}
                </div>
                {tx.txHash && (
                  <div className="font-mono text-[10px] text-[var(--text-muted)] mt-0.5">
                    {tx.txHash.slice(0, 10)}...{tx.txHash.slice(-8)}
                  </div>
                )}
              </div>

              <div className="bg-[var(--bg-card)] px-3 py-2.5 text-right">
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                  Amount
                </div>
                <div
                  className={[
                    'font-mono text-base font-semibold tracking-tight',
                    isPositive ? 'text-[var(--success)]' : 'text-[var(--danger)]',
                  ].join(' ')}
                >
                  {isPositive ? '+' : '-'}${tx.amount.toFixed(2)}
                </div>
              </div>

              <div className="bg-[var(--bg-card)] px-3 py-2.5 text-right">
                <div className="text-[10px] uppercase tracking-widest text-[var(--text-muted)] font-semibold">
                  Status
                </div>
                <span
                  className={[
                    'inline-block mt-0.5 px-2 py-1 text-[11px] rounded-md font-semibold',
                    badge.bg,
                    badge.text,
                  ].join(' ')}
                >
                  {badge.label}
                </span>
              </div>
            </div>
          );
        })
      ) : (
        <div className="px-4 py-8 text-center text-[var(--text-muted)] text-sm">
          No transactions yet.
        </div>
      )}
    </div>
  );
};

export default TransactionList;
