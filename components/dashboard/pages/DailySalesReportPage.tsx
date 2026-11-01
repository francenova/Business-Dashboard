'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/formatDate';
import { exportToExcel } from '@/lib/excelExport';
import { generateDSRPDF } from '@/lib/dsrPdf';
import {
  useSalesRegister,
  fetchAllSalesRows,
  deriveSaleDescription,
  SalesRegisterFilters,
  PaymentMethodFilter,
} from '@/hooks/useSalesRegister';
import { Prescription } from '@/lib/types';
import { motion } from 'motion/react';
import {
  CalendarDays,
  Search,
  Printer,
  Download,
  FileSpreadsheet,
  RefreshCw,
  IndianRupee,
  FileText,
  Wallet,
  Percent,
  Clock,
  Loader2,
  AlertTriangle,
  Inbox,
  Receipt as ReceiptIcon,
} from 'lucide-react';

type DsrPeriod = 'daily' | 'monthly' | 'yearly' | 'custom';

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getRangeForDsrPeriod(
  period: DsrPeriod,
  selectedDate: string,
  selectedMonth: string,
  selectedYear: string,
  customFrom?: string,
  customTo?: string
) {
  if (period === 'daily') {
    return { from: selectedDate, to: selectedDate };
  }
  if (period === 'monthly') {
    const [y, m] = selectedMonth.split('-').map(Number);
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    return { from: toDateStr(first), to: toDateStr(last) };
  }
  if (period === 'custom') return { from: customFrom || selectedDate, to: customTo || selectedDate };
  return { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` };
}

function getDsrHeading(period: DsrPeriod, from: string, to: string): string {
  if (period === 'daily') return formatDate(from);
  if (period === 'monthly') return new Date(from).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  if (period === 'custom') return `${formatDate(from)} – ${formatDate(to)}`;
  return new Date(from).getFullYear().toString();
}

const money = (n?: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export const DailySalesReportPage: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings, addToast } = useApp();

  const initialDateFrom = searchParams.get('dateFrom');
  const initialDateTo = searchParams.get('dateTo');

  const todayStr = toDateStr(new Date());
  const [period, setPeriod] = useState<DsrPeriod>(initialDateFrom && initialDateTo ? 'custom' : 'daily');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(todayStr.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [customFrom, setCustomFrom] = useState(initialDateFrom || todayStr);
  const [customTo, setCustomTo] = useState(initialDateTo || todayStr);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodFilter>('all');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { from, to } = useMemo(
    () => getRangeForDsrPeriod(period, selectedDate, selectedMonth, selectedYear, customFrom, customTo),
    [period, selectedDate, selectedMonth, selectedYear, customFrom, customTo]
  );
  const heading = useMemo(() => getDsrHeading(period, from, to), [period, from, to]);

  const filters: SalesRegisterFilters = useMemo(
    () => ({ dateFrom: from, dateTo: to, search, paymentMethod, paymentStatus: 'all', category: 'all' }),
    [from, to, search, paymentMethod]
  );

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

  const reportNumber = useMemo(() => {
    const d = new Date();
    const suffix = Math.floor(100 + Math.random() * 900);
    return `DSR-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${suffix}`;
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
      await generateDSRPDF(all, summary, { settings, reportNumber, heading });
      addToast('PDF Downloaded', 'Daily Sales Report PDF saved successfully!', 'success');
    } catch (err) {
      console.error('DSR PDF error:', err);
      addToast('PDF Failed', 'Could not generate the DSR PDF.', 'error');
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
        'Patient ID': rx.patientDisplayId || '-',
        Patient: rx.patientName,
        Items: deriveSaleDescription(rx),
        'Subtotal (₹)': rx.payment?.subtotal || 0,
        'Discount (₹)': rx.payment?.discount || 0,
        'Taxable (₹)': rx.payment?.taxableAmount || rx.payment?.grandTotal || 0,
        'GST/Tax (₹)': rx.payment?.totalTax || 0,
        'Grand Total (₹)': rx.payment?.grandTotal || 0,
        'Paid (₹)': rx.payment?.advance || 0,
        'Pending (₹)': rx.payment?.balance || 0,
        'Payment Method': rx.payment?.paymentMethod || '-',
      }));
      await exportToExcel(exportRows, `Daily_Sales_Report_${heading.replace(/\s+/g, '_')}_${reportNumber}`, 'Daily Sales Report');
      addToast('Excel Exported', 'Downloaded Daily Sales Report spreadsheet!');
    } catch {
      addToast('Export Error', 'Failed to generate Excel export.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const paymentMethods: Array<'Cash' | 'UPI' | 'Card' | 'Mixed'> = ['Cash', 'UPI', 'Card', 'Mixed'];
  const usedPaymentMethods = paymentMethods.filter((m) => summary.byPaymentMethod[m].count > 0);

  return (
    <motion.div
      id="dsr-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans"
    >
      {/* HEADER + FILTERS */}
      <div className="print:hidden backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-blue-600 via-indigo-500 to-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-500/20">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Daily Sales Report</h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Daily sales, payment and tax summary — {heading}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => window.location.reload()}
              disabled={exportBusy !== null}
              title="Refresh"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
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

        {/* Period selector + date picker */}
        <div className="flex flex-wrap items-center gap-2">
          {(['daily', 'monthly', 'yearly', 'custom'] as DsrPeriod[]).map((p) => (
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

          {period === 'daily' && (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
            />
          )}
          {period === 'monthly' && (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
            />
          )}
          {period === 'yearly' && (
            <input
              type="number"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              min="2000"
              max="2100"
              className="w-24 px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500"
            />
          )}
          {period === 'custom' && (
            <>
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
            </>
          )}
        </div>

        {/* Search + payment method */}
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
        </div>
      </div>

      {/* SUMMARY CARDS */}
      <div className="print:hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[
          { label: 'Total Invoices', value: String(summary.totalInvoices), icon: FileText, iconWrap: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600', valueText: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Total Sales', value: money(summary.grossSales), icon: IndianRupee, iconWrap: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600', valueText: 'text-emerald-600 dark:text-emerald-400' },
          settings.gstEnabled
            ? { label: 'GST/Tax', value: money(summary.totalTax), icon: Percent, iconWrap: 'bg-purple-50 dark:bg-purple-950 text-purple-600', valueText: 'text-purple-600 dark:text-purple-400' }
            : { label: 'GST/Tax', value: money(0), icon: Percent, iconWrap: 'bg-slate-100 dark:bg-slate-800 text-slate-500', valueText: 'text-slate-500 dark:text-slate-400', note: 'Not configured' },
          { label: 'Discount', value: money(summary.discount), icon: Percent, iconWrap: 'bg-amber-50 dark:bg-amber-950 text-amber-600', valueText: 'text-amber-600 dark:text-amber-400' },
          { label: 'Paid', value: money(summary.collected), icon: Wallet, iconWrap: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600', valueText: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Pending', value: money(summary.pending), icon: Clock, iconWrap: 'bg-rose-50 dark:bg-rose-950 text-rose-600', valueText: 'text-rose-600 dark:text-rose-400' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">{card.label}</span>
                <div className={`p-2 rounded-xl ${card.iconWrap}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className={`mt-3 text-xl font-black ${card.valueText}`}>{card.value}</div>
              {card.note && <p className="text-[10px] text-slate-400 mt-0.5">{card.note}</p>}
            </div>
          );
        })}
      </div>

      {/* DSR TABLE */}
      <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
        {isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-500" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Unable to load sales report</p>
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
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No Sales Found</p>
            <p className="text-xs text-slate-400 max-w-sm">No sales were recorded for {heading}.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                    <th className="p-3">S.No</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Invoice No</th>
                    <th className="p-3">Patient</th>
                    <th className="p-3">Items</th>
                    <th className="p-3 text-right">Subtotal</th>
                    <th className="p-3 text-right">Discount</th>
                    <th className="p-3 text-right">Taxable</th>
                    <th className="p-3 text-right">GST</th>
                    <th className="p-3 text-right">Grand Total</th>
                    <th className="p-3 text-right">Paid</th>
                    <th className="p-3 text-right">Pending</th>
                    <th className="p-3 text-center">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {rows.map((rx, idx) => (
                    <tr
                      key={rx.id}
                      onClick={() => router.push(`/prescription/${rx.id}`)}
                      className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-semibold">{formatDate(rx.date)}</td>
                      <td className="p-3 font-mono font-black text-indigo-600 dark:text-indigo-400">{rx.payment?.invoiceNumber || rx.displayId}</td>
                      <td className="p-3 font-black text-slate-900 dark:text-white">
                        {rx.patientName}
                        <span className="block text-[10px] text-slate-400 font-mono font-semibold mt-0.5">{rx.patientDisplayId || '-'}</span>
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300 font-semibold">{deriveSaleDescription(rx)}</td>
                      <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{money(rx.payment?.subtotal)}</td>
                      <td className="p-3 text-right font-mono text-amber-600 dark:text-amber-400">{money(rx.payment?.discount)}</td>
                      <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{money(rx.payment?.taxableAmount || rx.payment?.grandTotal)}</td>
                      <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{money(rx.payment?.totalTax)}</td>
                      <td className="p-3 text-right font-mono font-black text-slate-800 dark:text-slate-100">{money(rx.payment?.grandTotal)}</td>
                      <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{money(rx.payment?.advance)}</td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">{money(rx.payment?.balance)}</td>
                      <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-200">{rx.payment?.paymentMethod || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100/90 dark:bg-slate-950/90 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                    <td className="p-3" colSpan={5}>
                      TOTAL ({summary.totalInvoices} invoice{summary.totalInvoices === 1 ? '' : 's'})
                    </td>
                    <td className="p-3 text-right font-mono">{money(summary.grossSales)}</td>
                    <td className="p-3 text-right font-mono text-amber-600 dark:text-amber-400">{money(summary.discount)}</td>
                    <td className="p-3 text-right font-mono">{money(summary.taxableAmount || summary.grandTotal)}</td>
                    <td className="p-3 text-right font-mono">{money(summary.totalTax)}</td>
                    <td className="p-3 text-right font-mono">{money(summary.grandTotal)}</td>
                    <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{money(summary.collected)}</td>
                    <td className="p-3 text-right font-mono text-rose-600 dark:text-rose-400">{money(summary.pending)}</td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
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

      {/* PAYMENT METHOD SUMMARY */}
      {!isLoading && !isError && rows.length > 0 && (
        <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none">
          <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 mb-4">
            <ReceiptIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            Payment Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {usedPaymentMethods.map((m) => (
              <div key={m} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                <p className="text-[11px] font-bold text-slate-500">{m} ({summary.byPaymentMethod[m].count})</p>
                <p className="text-base font-black text-slate-900 dark:text-white mt-1">{money(summary.byPaymentMethod[m].amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PRINTABLE DOCUMENT */}
      {printRows && (
        <div id="printable-dsr" className="hidden print:block">
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-center gap-3">
              {settings.showLogoOnDocuments && settings.logoUrl && (
                <img src={settings.logoUrl} alt={settings.clinicName} className="w-12 h-12 object-contain shrink-0" />
              )}
              <div>
                <h2 className="text-xl font-black">{settings.clinicName || 'Royal Opticals'}</h2>
                <p className="text-xs text-slate-600 mt-0.5">{[settings.address, settings.phone, settings.email].filter(Boolean).join('  •  ')}</p>
                {settings.registrationNumber && <p className="text-xs text-slate-600">Reg. No: {settings.registrationNumber}</p>}
                {settings.gstin && <p className="text-xs text-slate-600">GSTIN: {settings.gstin}</p>}
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-base font-black tracking-wide">DAILY SALES REPORT</h3>
              <p className="text-xs text-slate-600 mt-0.5">Report No: {reportNumber}</p>
              <p className="text-xs text-slate-600">Report Date: {heading}</p>
            </div>
          </div>

          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-1 text-left font-bold">S.No</th>
                <th className="p-1 text-left font-bold">Date</th>
                <th className="p-1 text-left font-bold">Invoice No</th>
                <th className="p-1 text-left font-bold">Patient</th>
                <th className="p-1 text-left font-bold">Items</th>
                <th className="p-1 text-right font-bold">Subtotal</th>
                <th className="p-1 text-right font-bold">Discount</th>
                <th className="p-1 text-right font-bold">Taxable</th>
                <th className="p-1 text-right font-bold">GST</th>
                <th className="p-1 text-right font-bold">Grand Total</th>
                <th className="p-1 text-right font-bold">Paid</th>
                <th className="p-1 text-right font-bold">Pending</th>
                <th className="p-1 text-center font-bold">Method</th>
              </tr>
            </thead>
            <tbody>
              {printRows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="p-4 text-center text-slate-500 italic">No sales were recorded for {heading}.</td>
                </tr>
              ) : (
                printRows.map((rx, idx) => (
                  <tr key={rx.id} className="border-b border-slate-200">
                    <td className="p-1">{idx + 1}</td>
                    <td className="p-1">{formatDate(rx.date)}</td>
                    <td className="p-1 font-mono">{rx.payment?.invoiceNumber || rx.displayId}</td>
                    <td className="p-1">{rx.patientName}</td>
                    <td className="p-1">{deriveSaleDescription(rx)}</td>
                    <td className="p-1 text-right">{money(rx.payment?.subtotal)}</td>
                    <td className="p-1 text-right">{money(rx.payment?.discount)}</td>
                    <td className="p-1 text-right">{money(rx.payment?.taxableAmount || rx.payment?.grandTotal)}</td>
                    <td className="p-1 text-right">{money(rx.payment?.totalTax)}</td>
                    <td className="p-1 text-right">{money(rx.payment?.grandTotal)}</td>
                    <td className="p-1 text-right">{money(rx.payment?.advance)}</td>
                    <td className="p-1 text-right">{money(rx.payment?.balance)}</td>
                    <td className="p-1 text-center">{rx.payment?.paymentMethod || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <div className="mt-4 border-2 border-slate-900 p-3 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Total Summary</h4>
            <div className="grid grid-cols-6 gap-2 text-center text-[10px]">
              <div><p className="text-slate-500">Invoices</p><p className="font-black text-sm mt-0.5">{summary.totalInvoices}</p></div>
              <div><p className="text-slate-500">Subtotal</p><p className="font-black text-sm mt-0.5">{money(summary.grossSales)}</p></div>
              <div><p className="text-slate-500">Discount</p><p className="font-black text-sm mt-0.5">{money(summary.discount)}</p></div>
              <div><p className="text-slate-500">GST</p><p className="font-black text-sm mt-0.5">{money(summary.totalTax)}</p></div>
              <div><p className="text-slate-500">Grand Total</p><p className="font-black text-sm mt-0.5">{money(summary.grandTotal)}</p></div>
              <div><p className="text-slate-500">Pending</p><p className="font-black text-sm mt-0.5">{money(summary.pending)}</p></div>
            </div>
          </div>

          {usedPaymentMethods.length > 0 && (
            <div className="mt-3 break-inside-avoid">
              <h4 className="font-black text-xs uppercase tracking-wide mb-1.5">Payment Summary</h4>
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                {usedPaymentMethods.map((m) => (
                  <div key={m} className="border border-slate-300 rounded p-1.5">
                    <p className="text-slate-500">{m} ({summary.byPaymentMethod[m].count})</p>
                    <p className="font-black">{money(summary.byPaymentMethod[m].amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 pt-2 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
            <span>{settings.clinicName || 'Royal Opticals'}</span>
            <span>Computer Generated Report</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
