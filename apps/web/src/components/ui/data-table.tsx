import React, { useMemo, useState } from 'react';

export type SortDir = 'asc' | 'desc' | null;

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pageSize?: number;
  searchable?: boolean;
  searchKeys?: string[];
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  pageSize = 10,
  searchable = true,
  searchKeys,
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!searchable || !search.trim()) return data;
    const q = search.toLowerCase();
    const keys = searchKeys || columns.map((c) => c.key);
    return data.filter((row) =>
      keys.some((k) => String(row[k] ?? '').toLowerCase().includes(q))
    );
  }, [data, search, searchable, searchKeys, columns]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] as string | number;
      const bv = b[sortKey] as string | number;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageData = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (key: string, sortable?: boolean) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => {
    if (!active || !dir) return <span className="ml-1 text-[var(--text-muted)]">⇅</span>;
    return <span className="ml-1 text-[var(--primary)]">{dir === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div className={['space-y-3', className].join(' ')}>
      {searchable && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search..."
            className="w-full max-w-sm rounded-md border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none"
          />
          <span className="text-xs text-[var(--text-muted)]">{filtered.length} results</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
        <table className="min-w-full text-sm text-left">
          <thead className="bg-[var(--bg-card)] text-xs uppercase text-[var(--text-muted)]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col.key, col.sortable)}
                  className={[
                    'px-4 py-3 select-none',
                    col.sortable ? 'cursor-pointer hover:text-[var(--text-secondary)]' : '',
                  ].join(' ')}
                >
                  <div className="flex items-center">
                    {col.header}
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-base)]">
            {pageData.map((row, idx) => (
              <tr key={idx} className="hover:bg-[var(--bg-surface)] transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-[var(--text-secondary)]">
                    {col.render ? col.render(row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="rounded-md bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-sm text-[var(--text-muted)]">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="rounded-md bg-[var(--bg-card)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-surface)] disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

export default DataTable;
