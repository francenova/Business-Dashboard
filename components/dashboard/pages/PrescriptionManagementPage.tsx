'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDate } from '@/lib/formatDate';
import { useSalesRegister, SalesRegisterFilters, PaymentStatusFilter, SortDir } from '@/hooks/useSalesRegister';
import { motion } from 'motion/react';
import {
  FileText,
  Search,
  Eye,
  Printer,
  Download,
  UserRound,
  Loader2,
  AlertTriangle,
  Inbox,
  ArrowUpDown,
} from 'lucide-react';

type Period = 'today' | 'week' | 'month' | 'year' | 'custom';

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getRangeForPeriod(period: Period, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  if (period === 'today') {
    const s = toDateStr(today);
    return { from: s, to: s };
  }
  if (period === 'week') {
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toDateStr(monday), to: toDateStr(sunday) };
  }
  if (period === 'month') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: toDateStr(first), to: toDateStr(last) };
  }
  if (period === 'year') {
    return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
  }
  return { from: customFrom || toDateStr(today), to: customTo || toDateStr(today) };
}

const periodLabelFor = (period: Period, from: string, to: string): string => {
  if (period === 'today') return formatDate(from);
  if (period === 'month') return new Date(from).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  if (period === 'year') return new Date(from).getFullYear().toString();
  return `${formatDate(from)} – ${formatDate(to)}`;
};

export const PrescriptionManagementPage: React.FC = () => {
  const router = useRouter();

  const [period, setPeriod] = useState<Period>('month');
  const todayStr = toDateStr(new Date());
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<PaymentStatusFilter>('all');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { from, to } = useMemo(() => getRangeForPeriod(period, customFrom, customTo), [period, customFrom, customTo]);
  const periodLabel = useMemo(() => periodLabelFor(period, from, to), [period, from, to]);

  const filters: SalesRegisterFilters = useMemo(
    () => ({
      dateFrom: from,
      dateTo: to,
      search,
      paymentMethod: 'all',
      paymentStatus: status,
      category: 'all',
      sortBy: 'date',
      sortDir,
    }),
    [from, to, search, status, sortDir]
  );

  const { rows, totalCount, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage } = useSalesRegister(filters);

  return (
    <motion.div
      id="prescription-management-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans"
    >
      {/* HEADER + FILTERS */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 text-white rounded-2xl shadow-md shadow-indigo-500/20">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Prescription Management</h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              View, search, print and manage patient prescriptions — {periodLabel}
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'year', label: 'This Year' },
              { key: 'custom', label: 'Custom Date' },
            ] as { key: Period; label: string }[]
          ).map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === p.key
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {p.label}
            </button>
          ))}
          {period === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500" />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500" />
            </>
          )}
        </div>

        {/* Search + status + sort */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search prescriptions..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PaymentStatusFilter)}
            className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Pending">Pending</option>
          </select>
          <button
            onClick={() => setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95"
            title="Toggle newest/oldest first"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span>{sortDir === 'desc' ? 'Newest First' : 'Oldest First'}</span>
          </button>
        </div>
      </div>

      {/* PRESCRIPTION LIST */}
      <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
        {isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-500" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Unable to load prescriptions</p>
            <p className="text-xs text-slate-500 max-w-sm">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              Retry
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No prescriptions found.</p>
            <p className="text-xs text-slate-400 max-w-sm">No prescriptions match the current filters for {periodLabel}.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                    <th className="p-3.5">Prescription ID</th>
                    <th className="p-3.5">Patient</th>
                    <th className="p-3.5">Patient ID / Phone</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Lens Type</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {rows.map((rx) => (
                    <tr
                      key={rx.id}
                      onClick={() => router.push(`/prescription/${rx.id}`)}
                      className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="p-3.5 font-mono font-black text-indigo-600 dark:text-indigo-400">{rx.displayId}</td>
                      <td className="p-3.5 font-black text-slate-900 dark:text-white">{rx.patientName}</td>
                      <td className="p-3.5 text-slate-500 font-mono">
                        {rx.patientDisplayId || '-'}
                        <span className="block text-[10px] text-slate-400 font-sans font-semibold mt-0.5">{rx.patientPhone}</span>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 font-semibold">{formatDate(rx.date)}</td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 font-semibold">{rx.lens?.lensType || '-'}</td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                            rx.payment?.status === 'Paid'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-900'
                              : rx.payment?.status === 'Partial'
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-900'
                              : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-900'
                          }`}
                        >
                          {rx.payment?.status || 'Pending'}
                        </span>
                      </td>
                      <td className="p-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => router.push(`/prescription/${rx.id}`)}
                            title="View"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => router.push(`/prescription/${rx.id}?action=print`)}
                            title="Print"
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => router.push(`/prescription/${rx.id}?action=download`)}
                            title="Download"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => router.push(`/patients/${rx.patientId}`)}
                            title="View Patient"
                            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <UserRound className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-slate-400 font-semibold">
                Showing {rows.length} of {totalCount} prescription{totalCount === 1 ? '' : 's'}
              </p>
              {hasNextPage && (
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
                >
                  {isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Load More</span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
};
