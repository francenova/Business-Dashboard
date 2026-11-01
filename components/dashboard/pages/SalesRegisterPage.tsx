'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/formatDate';
import { exportToExcel } from '@/lib/excelExport';
import { generateSalesRegisterPDF } from '@/lib/salesRegisterPdf';
import {
  useSalesRegister,
  fetchAllSalesRows,
  deriveSaleDescription,
  SalesRegisterFilters,
  SalesCategory,
  PaymentMethodFilter,
  PaymentStatusFilter,
  TaxStatusFilter,
  SortField,
  SortDir,
} from '@/hooks/useSalesRegister';
import { Prescription } from '@/lib/types';
import { motion } from 'motion/react';
import {
  Receipt,
  Search,
  Printer,
  Download,
  FileSpreadsheet,
  IndianRupee,
  FileText,
  Wallet,
  TrendingDown,
  Percent,
  Clock,
  Loader2,
  AlertTriangle,
  Inbox,
  Eye,
  BookOpen,
  UserRound,
  ArrowUpDown,
  CheckCircle2,
  XCircle,
  Plus,
} from 'lucide-react';

type Period = 'daily' | 'monthly' | 'yearly' | 'custom';

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getRangeForPeriod(period: Period, customFrom: string, customTo: string): { from: string; to: string } {
  const today = new Date();
  if (period === 'daily') {
    const s = toDateStr(today);
    return { from: s, to: s };
  }
  if (period === 'monthly') {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: toDateStr(first), to: toDateStr(last) };
  }
  if (period === 'yearly') {
    return { from: `${today.getFullYear()}-01-01`, to: `${today.getFullYear()}-12-31` };
  }
  return { from: customFrom || toDateStr(today), to: customTo || toDateStr(today) };
}

// Human-readable heading for the printed/PDF report — different phrasing
// per period type, e.g. "Daily (14 Aug 2026)" / "Monthly (August 2026)" /
// "Yearly (2026)" / a plain date range for Custom.
function getPeriodHeading(period: Period, from: string, to: string): string {
  if (period === 'daily') return `Daily (${formatDate(from)})`;
  if (period === 'monthly') {
    const label = new Date(from).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return `Monthly (${label})`;
  }
  if (period === 'yearly') return `Yearly (${new Date(from).getFullYear()})`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}

const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

// Recognized so Report & Analysis's drill-down links land with the exact
// filter already applied, instead of opening this page unfiltered.
const VALID_PAYMENT_STATUSES: PaymentStatusFilter[] = ['all', 'Paid', 'Partial', 'Pending'];

export const SalesRegisterPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, addToast } = useApp();

  const initialDateFrom = searchParams.get('dateFrom');
  const initialDateTo = searchParams.get('dateTo');
  const initialPaymentStatusParam = searchParams.get('paymentStatus') as PaymentStatusFilter | null;
  const initialPaymentStatus =
    initialPaymentStatusParam && VALID_PAYMENT_STATUSES.includes(initialPaymentStatusParam)
      ? initialPaymentStatusParam
      : 'all';

  const [period, setPeriod] = useState<Period>(initialDateFrom && initialDateTo ? 'custom' : 'daily');
  const todayStr = toDateStr(new Date());
  const [customFrom, setCustomFrom] = useState(initialDateFrom || todayStr);
  const [customTo, setCustomTo] = useState(initialDateTo || todayStr);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodFilter>('all');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>(initialPaymentStatus);
  const [category, setCategory] = useState<SalesCategory>('all');
  const [taxStatus, setTaxStatus] = useState<TaxStatusFilter>('all');
  const [sortBy, setSortBy] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Debounce the search box so every keystroke doesn't fire a query.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { from, to } = useMemo(() => getRangeForPeriod(period, customFrom, customTo), [period, customFrom, customTo]);

  const filters: SalesRegisterFilters = useMemo(
    () => ({ dateFrom: from, dateTo: to, search, paymentMethod, paymentStatus, category, taxStatus, sortBy, sortDir }),
    [from, to, search, paymentMethod, paymentStatus, category, taxStatus, sortBy, sortDir]
  );

  const hasActiveFilters = search !== '' || paymentMethod !== 'all' || paymentStatus !== 'all' || category !== 'all' || taxStatus !== 'all';
  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setPaymentMethod('all');
    setPaymentStatus('all');
    setCategory('all');
    setTaxStatus('all');
  };

  const periodLabel = from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
  const periodHeading = useMemo(() => getPeriodHeading(period, from, to), [period, from, to]);

  const {
    rows,
    totalCount,
    summary,
    isLoading,
    isError,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useSalesRegister(filters);

  const [exportBusy, setExportBusy] = useState<'print' | 'pdf' | 'excel' | null>(null);
  const [printRows, setPrintRows] = useState<Prescription[] | null>(null);
  const [notes, setNotes] = useState('');

  // "Prepared by" is pulled from the logged-in staff session — never a
  // fabricated name. Auth is currently bypassed app-wide (middleware.ts),
  // so there is no active session yet and this stays null until login is
  // re-enabled; the report simply omits the line rather than showing a
  // placeholder.
  const [preparedBy, setPreparedBy] = useState<string | null>(null);
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        const user = data?.user;
        const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || null;
        setPreparedBy(name);
      })
      .catch(() => setPreparedBy(null));
  }, []);

  const reportNumber = useMemo(() => {
    const d = new Date();
    const suffix = Math.floor(100 + Math.random() * 900);
    return `TSR-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${suffix}`;
  }, []);

  const handlePrint = async () => {
    setExportBusy('print');
    try {
      const all = await fetchAllSalesRows(filters);
      setPrintRows(all);
      await new Promise((resolve) => setTimeout(resolve, 60));
      window.print();
    } catch {
      addToast('Error', 'Failed to prepare the print view.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const handleDownloadPDF = async () => {
    setExportBusy('pdf');
    try {
      const all = await fetchAllSalesRows(filters);
      await generateSalesRegisterPDF(all, summary, {
        settings,
        reportNumber,
        periodHeading,
        preparedBy,
        notes,
      });
      addToast('PDF Downloaded', 'Sales register PDF saved successfully!', 'success');
    } catch (err) {
      console.error('Sales register PDF error:', err);
      addToast('PDF Failed', 'Could not generate the sales register PDF.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const handleExportExcel = async () => {
    setExportBusy('excel');
    try {
      const all = await fetchAllSalesRows(filters);
      const exportRows = all.map((rx, idx) => ({
        'S.No': idx + 1,
        Date: formatDate(rx.date),
        'Invoice No': rx.payment?.invoiceNumber || rx.displayId,
        Customer: rx.patientName,
        Phone: rx.patientPhone,
        Description: deriveSaleDescription(rx),
        'Subtotal (₹)': rx.payment?.subtotal || 0,
        'Discount (₹)': rx.payment?.discount || 0,
        'Taxable Amount (₹)': rx.payment?.taxableAmount || rx.payment?.grandTotal || 0,
        'CGST (₹)': rx.payment?.cgstAmount || 0,
        'SGST (₹)': rx.payment?.sgstAmount || 0,
        'IGST (₹)': rx.payment?.igstAmount || 0,
        'Total Tax (₹)': rx.payment?.totalTax || 0,
        'Grand Total (₹)': rx.payment?.grandTotal || 0,
        'Paid (₹)': rx.payment?.advance || 0,
        'Pending (₹)': rx.payment?.balance || 0,
        'Payment Method': rx.payment?.paymentMethod || '-',
        Status: rx.payment?.status || '-',
      }));
      await exportToExcel(
        exportRows,
        `Sales_Register_${periodLabel.replace(/\s+/g, '_')}_${reportNumber}`,
        'Sales Register'
      );
      addToast('Excel Exported', 'Downloaded sales register spreadsheet!');
    } catch (err) {
      addToast('Export Error', 'Failed to generate Excel export.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  return (
    <motion.div
      id="sales-register-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans"
    >
      {/* HEADER + FILTERS (hidden while printing — the printable doc below is used instead) */}
      <div className="print:hidden backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 text-white rounded-2xl shadow-md shadow-indigo-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Sales Register (TSR)</h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{periodLabel}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => router.push('/visit/new')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 hover:from-indigo-700 hover:via-indigo-600 hover:to-blue-600 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md shadow-indigo-500/20"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Invoice</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={exportBusy !== null}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              {exportBusy === 'print' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={exportBusy !== null}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              {exportBusy === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>PDF</span>
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exportBusy !== null}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              {exportBusy === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
              <span>Excel</span>
            </button>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex flex-wrap items-center gap-2">
          {(['daily', 'monthly', 'yearly', 'custom'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                period === p
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {p}
            </button>
          ))}

          {period === 'custom' && (
            <div className="flex items-center gap-2 ml-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search invoice number or patient..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>

          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethodFilter)}
            className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
          >
            <option value="all">All Payment Methods</option>
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Card">Card</option>
            <option value="Mixed">Mixed</option>
          </select>

          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value as PaymentStatusFilter)}
            className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="Paid">Paid</option>
            <option value="Partial">Partial</option>
            <option value="Pending">Pending</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as SalesCategory)}
            className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
          >
            <option value="all">All Categories</option>
            <option value="Frame">Frames</option>
            <option value="Lens">Lenses</option>
            <option value="Reading Glass">Reading Glass</option>
            <option value="Solution">Solutions</option>
            <option value="Contact Lens">Contact Lens</option>
            <option value="Medicines">Medicines</option>
            <option value="Consultation">Consultation Only</option>
          </select>

          {settings.gstEnabled && (
            <select
              value={taxStatus}
              onChange={(e) => setTaxStatus(e.target.value as TaxStatusFilter)}
              className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
            >
              <option value="all">GST + Non-GST</option>
              <option value="gst">GST Only</option>
              <option value="non-gst">Non-GST Only</option>
            </select>
          )}

          <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl px-1">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="px-2 py-2 bg-transparent text-xs font-semibold outline-none"
            >
              <option value="date">Sort: Date</option>
              <option value="invoiceNumber">Sort: Invoice No</option>
              <option value="grandTotal">Sort: Total</option>
              <option value="advance">Sort: Paid</option>
              <option value="balance">Sort: Pending</option>
            </select>
            <button
              type="button"
              onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
              title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
              className="p-1.5 text-slate-500 hover:text-indigo-600 transition-colors"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
            </button>
          </div>

          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors">
              <XCircle className="w-3.5 h-3.5" />
              Clear Filters
            </button>
          )}
        </div>

        {/* Notes — optional, included in the printed/PDF report's Notes line when filled in */}
        <div>
          <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
            Notes for printed report <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. UPI settlement pending confirmation"
            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
      </div>

      {/* SUMMARY CARDS (hidden while printing — the printable doc has its own summary block) */}
      <div className={`print:hidden grid grid-cols-2 sm:grid-cols-3 ${settings.gstEnabled ? 'lg:grid-cols-7' : 'lg:grid-cols-6'} gap-3.5`}>
        {[
          {
            label: 'Total Invoices',
            value: String(summary.totalInvoices),
            icon: FileText,
            iconWrap: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600',
            valueText: 'text-indigo-600 dark:text-indigo-400',
          },
          {
            label: 'Gross Sales',
            value: money(summary.grossSales),
            icon: IndianRupee,
            iconWrap: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600',
            valueText: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Discount',
            value: money(summary.discount),
            icon: Percent,
            iconWrap: 'bg-amber-50 dark:bg-amber-950 text-amber-600',
            valueText: 'text-amber-600 dark:text-amber-400',
          },
          ...(settings.gstEnabled
            ? [{
                label: 'Total GST',
                value: money(summary.totalTax),
                icon: Percent,
                iconWrap: 'bg-purple-50 dark:bg-purple-950 text-purple-600',
                valueText: 'text-purple-600 dark:text-purple-400',
              }]
            : []),
          {
            label: 'Grand Total',
            value: money(summary.grandTotal),
            icon: Wallet,
            iconWrap: 'bg-blue-50 dark:bg-blue-950 text-blue-600',
            valueText: 'text-blue-600 dark:text-blue-400',
          },
          {
            label: 'Collected',
            value: money(summary.collected),
            icon: IndianRupee,
            iconWrap: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600',
            valueText: 'text-emerald-600 dark:text-emerald-400',
          },
          {
            label: 'Pending',
            value: money(summary.pending),
            icon: Clock,
            iconWrap: 'bg-rose-50 dark:bg-rose-950 text-rose-600',
            valueText: 'text-rose-600 dark:text-rose-400',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">{card.label}</span>
                <div className={`p-2 rounded-xl ${card.iconWrap}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className={`mt-3 text-xl font-black ${card.valueText}`}>{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* INVOICE STATUS BREAKDOWN — counts, distinct from the amount-based
          cards above (that "Pending" card is an amount; these are counts). */}
      <div className="print:hidden flex flex-wrap items-center gap-3">
        <button
          onClick={() => setPaymentStatus(paymentStatus === 'Paid' ? 'all' : 'Paid')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
            paymentStatus === 'Paid' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-emerald-400'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Paid: {summary.byStatus.Paid}
        </button>
        <button
          onClick={() => setPaymentStatus(paymentStatus === 'Partial' ? 'all' : 'Partial')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
            paymentStatus === 'Partial' ? 'bg-amber-600 border-amber-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-amber-400'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Partially Paid: {summary.byStatus.Partial}
        </button>
        <button
          onClick={() => setPaymentStatus(paymentStatus === 'Pending' ? 'all' : 'Pending')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
            paymentStatus === 'Pending' ? 'bg-rose-600 border-rose-600 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-rose-400'
          }`}
        >
          <XCircle className="w-3.5 h-3.5" />
          Pending: {summary.byStatus.Pending}
        </button>
      </div>

      {/* SALES TABLE (screen — paginated) */}
      <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
        {isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-500" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Failed to load sales data</p>
            <p className="text-xs text-slate-500 max-w-sm">
              {error instanceof Error ? error.message : 'An unexpected database error occurred.'}
            </p>
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-bold text-slate-500">Loading sales register…</p>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No sales in this period</p>
            <p className="text-xs text-slate-400 max-w-sm">
              Try a wider date range or clear the active search/filters.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                    <th className="p-3.5">S.No</th>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Invoice No</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5 text-right">Total</th>
                    <th className="p-3.5 text-right">Paid</th>
                    <th className="p-3.5 text-right">Pending</th>
                    <th className="p-3.5 text-center">Method</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {rows.map((rx, idx) => (
                    <tr
                      key={rx.id}
                      onClick={() => router.push(`/prescription/${rx.id}`)}
                      className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="p-3.5 font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 font-semibold">{formatDate(rx.date)}</td>
                      <td className="p-3.5 font-mono font-black text-indigo-600 dark:text-indigo-400">
                        {rx.payment?.invoiceNumber || rx.displayId}
                      </td>
                      <td className="p-3.5 font-black text-slate-900 dark:text-white">
                        {rx.patientName}
                        <span className="block text-[10px] text-slate-400 font-semibold mt-0.5">{rx.patientPhone}</span>
                      </td>
                      <td className="p-3.5 text-slate-600 dark:text-slate-300 font-semibold">{deriveSaleDescription(rx)}</td>
                      <td className="p-3.5 text-right font-mono font-black text-slate-800 dark:text-slate-100">
                        {money(rx.payment?.grandTotal)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {money(rx.payment?.advance)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                        {money(rx.payment?.balance)}
                      </td>
                      <td className="p-3.5 text-center font-bold text-slate-700 dark:text-slate-200">
                        {rx.payment?.paymentMethod || '-'}
                      </td>
                      <td className="p-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
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
                            title="View / Print / Download Invoice"
                            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {rx.visitId ? (
                            <button
                              onClick={() => router.push(`/visit/${rx.visitId}`)}
                              title="Record Payment (opens the existing visit edit form)"
                              className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              disabled
                              title="This is a standalone order with no linked visit — payment editing isn't available for these yet"
                              className="p-1.5 text-slate-200 dark:text-slate-700 cursor-not-allowed rounded-lg"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => router.push(`/ledger?patientId=${rx.patientId}`)}
                            title="View Customer Ledger"
                            className="p-1.5 text-slate-400 hover:text-teal-600 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40 transition-colors"
                          >
                            <BookOpen className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => router.push(`/patients/${rx.patientId}`)}
                            title="View Patient Profile"
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
                Showing {rows.length} of {totalCount} sale{totalCount === 1 ? '' : 's'}
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

      {/* PRINTABLE DOCUMENT — hidden on screen, shown only via window.print().
          Note: browsers give us no reliable way to swap in a "continued"
          header on page 2+ of a plain print (only <thead> repetition is
          well-supported) — that differentiated per-page header only exists
          in the hand-built PDF (lib/salesRegisterPdf.ts). This view is the
          best a native browser print can do; prefer "Download PDF" when the
          continuation-page header matters. */}
      {printRows && (
        <div id="printable-sales-register" className="hidden print:block">
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-center gap-3">
              {settings.showLogoOnDocuments && settings.logoUrl && (
                <img src={settings.logoUrl} alt={settings.clinicName} className="w-12 h-12 object-contain shrink-0" />
              )}
              <div>
                <h2 className="text-xl font-black">{settings.clinicName || 'Royal Opticals'}</h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {[settings.address, settings.phone, settings.email].filter(Boolean).join('  •  ')}
                </p>
                {settings.registrationNumber && (
                  <p className="text-xs text-slate-600">Reg. No: {settings.registrationNumber}</p>
                )}
                {settings.gstin && <p className="text-xs text-slate-600">GSTIN: {settings.gstin}</p>}
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-base font-black tracking-wide">SALES REGISTER</h3>
              <p className="text-xs text-slate-600 mt-0.5">Report No: {reportNumber}</p>
              <p className="text-xs text-slate-600">Period: {periodHeading}</p>
              {preparedBy && <p className="text-xs text-slate-600">Prepared by: {preparedBy}</p>}
            </div>
          </div>

          <table className="w-full text-[10px] border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-1.5 text-left font-bold">S.No</th>
                <th className="p-1.5 text-left font-bold">Date</th>
                <th className="p-1.5 text-left font-bold">Invoice No</th>
                <th className="p-1.5 text-left font-bold">Customer</th>
                <th className="p-1.5 text-left font-bold">Description</th>
                <th className="p-1.5 text-right font-bold">Total</th>
                <th className="p-1.5 text-right font-bold">Paid</th>
                <th className="p-1.5 text-right font-bold">Pending</th>
                <th className="p-1.5 text-center font-bold">Method</th>
                <th className="p-1.5 text-center font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {printRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-slate-500 italic">
                    No sales in this period.
                  </td>
                </tr>
              ) : (
                printRows.map((rx, idx) => (
                  <tr key={rx.id} className="border-b border-slate-300">
                    <td className="p-1.5">{idx + 1}</td>
                    <td className="p-1.5">{formatDate(rx.date)}</td>
                    <td className="p-1.5 font-mono">{rx.payment?.invoiceNumber || rx.displayId}</td>
                    <td className="p-1.5">{rx.patientName}</td>
                    <td className="p-1.5">{deriveSaleDescription(rx)}</td>
                    <td className="p-1.5 text-right font-mono">{money(rx.payment?.grandTotal)}</td>
                    <td className="p-1.5 text-right font-mono">{money(rx.payment?.advance)}</td>
                    <td className="p-1.5 text-right font-mono">{money(rx.payment?.balance)}</td>
                    <td className="p-1.5 text-center">{rx.payment?.paymentMethod || '-'}</td>
                    <td className="p-1.5 text-center">{rx.payment?.status || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-auto pt-5 break-inside-avoid">
            <div className="border border-slate-900 p-3">
              <h4 className="font-black text-xs uppercase tracking-wide mb-2.5">Summary</h4>
              <div className={`grid gap-2 text-center text-[10px] ${summary.totalTax > 0 ? 'grid-cols-7' : 'grid-cols-6'}`}>
                <div>
                  <p className="text-slate-500">Total Invoices</p>
                  <p className="font-black text-sm mt-0.5">{summary.totalInvoices}</p>
                </div>
                <div>
                  <p className="text-slate-500">Gross Sales</p>
                  <p className="font-black text-sm mt-0.5">{money(summary.grossSales)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Discount</p>
                  <p className="font-black text-sm mt-0.5">{money(summary.discount)}</p>
                </div>
                {summary.totalTax > 0 && (
                  <div>
                    <p className="text-slate-500">Total GST</p>
                    <p className="font-black text-sm mt-0.5">{money(summary.totalTax)}</p>
                  </div>
                )}
                <div>
                  <p className="text-slate-500">Grand Total</p>
                  <p className="font-black text-sm mt-0.5">{money(summary.grandTotal)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Collected</p>
                  <p className="font-black text-sm mt-0.5">{money(summary.collected)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Pending</p>
                  <p className="font-black text-sm mt-0.5">{money(summary.pending)}</p>
                </div>
              </div>
            </div>

            {notes.trim() && (
              <p className="text-[10px] text-slate-700 mt-3">
                <span className="font-bold">Notes:</span> {notes.trim()}
              </p>
            )}

            <div className="flex items-center justify-between mt-8 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="font-bold">Prepared By:</span>
                <span className="inline-block w-32 border-b border-slate-500">&nbsp;</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Authorized Signature:</span>
                <span className="inline-block w-32 border-b border-slate-500">&nbsp;</span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-2 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
            <span>{settings.clinicName || 'Royal Opticals'}</span>
            <span>Computer Generated Report</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
