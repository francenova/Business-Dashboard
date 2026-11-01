'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/formatDate';
import { exportToExcel } from '@/lib/excelExport';
import { generateGstReportPDF } from '@/lib/gstReportPdf';
import { useSalesRegister, fetchAllSalesRows, fetchSalesSummary, SalesRegisterFilters } from '@/hooks/useSalesRegister';
import { Prescription } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import {
  Percent,
  Search,
  Printer,
  Download,
  FileSpreadsheet,
  IndianRupee,
  FileText,
  Loader2,
  AlertTriangle,
  Inbox,
  Settings as SettingsIcon,
  ChevronRight,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

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

function getPeriodHeading(period: Period, from: string, to: string): string {
  if (period === 'today') return formatDate(from);
  if (period === 'week') return `${formatDate(from)} – ${formatDate(to)}`;
  if (period === 'month') return new Date(from).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  if (period === 'year') return new Date(from).getFullYear().toString();
  return `${formatDate(from)} – ${formatDate(to)}`;
}

const money = (n?: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export const GstReportPage: React.FC = () => {
  const router = useRouter();
  const { settings, taxRateConfig, navigateTo, addToast } = useApp();

  const [period, setPeriod] = useState<Period>('month');
  const todayStr = toDateStr(new Date());
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { from, to } = useMemo(() => getRangeForPeriod(period, customFrom, customTo), [period, customFrom, customTo]);
  const periodHeading = useMemo(() => getPeriodHeading(period, from, to), [period, from, to]);

  // Summary must reflect the whole period (not just tax-bearing rows) so
  // it matches DSR/Report & Analysis's own GST numbers exactly — the same
  // accumulateSummary reducer, never a second calculation.
  const summaryFilters: SalesRegisterFilters = useMemo(
    () => ({ dateFrom: from, dateTo: to, search: '', paymentMethod: 'all', paymentStatus: 'all', category: 'all' }),
    [from, to]
  );
  const summaryQuery = useQuery({
    queryKey: ['gst-report-summary', summaryFilters],
    queryFn: () => fetchSalesSummary(summaryFilters),
  });
  const summary = summaryQuery.data;

  // The row table only needs invoices that actually carry tax — reuses the
  // same taxStatus='gst' filter already built for TSR/Invoice Management.
  const rowFilters: SalesRegisterFilters = useMemo(
    () => ({ dateFrom: from, dateTo: to, search, paymentMethod: 'all', paymentStatus: 'all', category: 'all', taxStatus: 'gst', sortBy: 'date', sortDir: 'desc' }),
    [from, to, search]
  );
  const { rows, totalCount, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage } = useSalesRegister(rowFilters);

  const [exportBusy, setExportBusy] = useState<'print' | 'pdf' | 'excel' | null>(null);
  const [printRows, setPrintRows] = useState<Prescription[] | null>(null);

  const handlePrint = async () => {
    setExportBusy('print');
    try {
      const all = await fetchAllSalesRows(rowFilters);
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
    if (!summary) return;
    setExportBusy('pdf');
    try {
      const allRows = await fetchAllSalesRows(rowFilters);
      await generateGstReportPDF({ settings, periodHeading, summary, rows: allRows, taxRateConfig });
      addToast('PDF Downloaded', 'GST report PDF saved successfully!', 'success');
    } catch (err) {
      console.error('GST report PDF error:', err);
      addToast('PDF Failed', 'Could not generate the GST report PDF.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const handleExportExcel = async () => {
    setExportBusy('excel');
    try {
      const allRows = await fetchAllSalesRows(rowFilters);
      const exportRows = allRows.map((rx) => ({
        Date: formatDate(rx.date),
        'Invoice No': rx.payment?.invoiceNumber || rx.displayId,
        Patient: rx.patientName,
        'Place of Supply': rx.payment?.placeOfSupply || '-',
        'Taxable Amount (₹)': rx.payment?.taxableAmount || 0,
        'CGST Rate (%)': rx.payment?.cgstRate || 0,
        'CGST (₹)': rx.payment?.cgstAmount || 0,
        'SGST Rate (%)': rx.payment?.sgstRate || 0,
        'SGST (₹)': rx.payment?.sgstAmount || 0,
        'IGST Rate (%)': rx.payment?.igstRate || 0,
        'IGST (₹)': rx.payment?.igstAmount || 0,
        'Total Tax (₹)': rx.payment?.totalTax || 0,
        'Grand Total (₹)': rx.payment?.grandTotal || 0,
      }));
      if (exportRows.length === 0) {
        addToast('No Data', 'No GST invoices for this period.', 'error');
        return;
      }
      await exportToExcel(exportRows, `GST_Report_${periodHeading.replace(/\s+/g, '_')}`, 'GST Report');
      addToast('Excel Exported', 'Downloaded GST report spreadsheet!');
    } catch {
      addToast('Export Error', 'Failed to generate Excel export.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const goToSettings = () => {
    navigateTo('settings');
    router.push('/');
  };

  const summaryCards = [
    { label: 'Taxable Amount', value: money(summary?.taxableAmount), icon: IndianRupee, iconWrap: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600', valueText: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'CGST', value: money(summary?.cgstTotal), icon: Percent, iconWrap: 'bg-blue-50 dark:bg-blue-950 text-blue-600', valueText: 'text-blue-600 dark:text-blue-400' },
    { label: 'SGST', value: money(summary?.sgstTotal), icon: Percent, iconWrap: 'bg-purple-50 dark:bg-purple-950 text-purple-600', valueText: 'text-purple-600 dark:text-purple-400' },
    { label: 'IGST', value: money(summary?.igstTotal), icon: Percent, iconWrap: 'bg-amber-50 dark:bg-amber-950 text-amber-600', valueText: 'text-amber-600 dark:text-amber-400' },
    { label: 'Total GST', value: money(summary?.totalTax), icon: Percent, iconWrap: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600', valueText: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'GST Invoices', value: String(totalCount), icon: FileText, iconWrap: 'bg-rose-50 dark:bg-rose-950 text-rose-600', valueText: 'text-rose-600 dark:text-rose-400' },
  ];

  const taxSplitChart = summary && summary.totalTax > 0
    ? [{ name: periodHeading, CGST: summary.cgstTotal, SGST: summary.sgstTotal, IGST: summary.igstTotal }]
    : [];

  return (
    <motion.div
      id="gst-report-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans"
    >
      {/* HEADER + CONTROLS */}
      <div className="print:hidden backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 text-white rounded-2xl shadow-md shadow-indigo-500/20">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">GST / Tax Report</h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Taxable sales, CGST/SGST/IGST breakdown — {periodHeading}
              </p>
            </div>
          </div>

          {settings.gstEnabled && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handlePrint}
                disabled={exportBusy !== null}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={exportBusy !== null || !summary}
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
          )}
        </div>

        {settings.gstEnabled && (
          <>
            {/* Period selector */}
            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'This Week' },
                  { key: 'month', label: 'This Month' },
                  { key: 'year', label: 'This Year' },
                  { key: 'custom', label: 'Custom Range' },
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

            {/* Search */}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice number or patient..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          </>
        )}
      </div>

      {!settings.gstEnabled ? (
        <div className="print:hidden p-10 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-center gap-3 text-center">
          <Percent className="w-10 h-10 text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">GST is not enabled for this clinic yet</p>
          <p className="text-xs text-slate-500 max-w-sm">
            Turn it on and set your business state and tax rates in Settings — this report will start showing real
            numbers for every invoice created after that.
          </p>
          <button
            onClick={goToSettings}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
            Go to GST Settings
          </button>
        </div>
      ) : isError ? (
        <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="w-10 h-10 text-rose-500" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Unable to load GST data</p>
          <p className="text-xs text-slate-500 max-w-sm">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
          <button onClick={() => window.location.reload()} className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="print:hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {!summary
              ? [...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />)
              : summaryCards.map((card) => {
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
                    </div>
                  );
                })}
          </div>

          <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* CGST vs SGST vs IGST CHART */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">CGST / SGST / IGST Split</h3>
              {taxSplitChart.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-bold text-slate-400">No GST collected for this period.</p>
                </div>
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={taxSplitChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3341551a" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v: any) => money(Number(v))} />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                      <Bar dataKey="CGST" fill="#6366f1" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="SGST" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="IGST" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* CATEGORY TAX RATE REFERENCE */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Category Tax Rates</h3>
                <button onClick={goToSettings} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  Edit in Settings <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                      <th className="p-3">Category</th>
                      <th className="p-3">HSN/SAC</th>
                      <th className="p-3 text-right">Rate</th>
                      <th className="p-3 text-center">Taxable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {taxRateConfig.map((r) => (
                      <tr key={r.category}>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{r.category}</td>
                        <td className="p-3 font-mono text-slate-500">{r.hsnSac || '-'}</td>
                        <td className="p-3 text-right font-mono">{r.taxRate}%</td>
                        <td className="p-3 text-center">{r.isTaxable ? 'Yes' : 'No'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400">Medicines use their own per-item rate, set in Medicine Inventory.</p>
            </div>
          </div>

          {/* GST INVOICE TABLE */}
          <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">GST Invoices</h3>
            {isLoading ? (
              <div className="space-y-2 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}</div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No GST invoices found</p>
                <p className="text-xs text-slate-400 max-w-sm">No tax-bearing invoices were recorded for {periodHeading}.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                        <th className="p-3">Date</th>
                        <th className="p-3">Invoice No</th>
                        <th className="p-3">Patient</th>
                        <th className="p-3 text-right">Taxable</th>
                        <th className="p-3 text-right">CGST</th>
                        <th className="p-3 text-right">SGST</th>
                        <th className="p-3 text-right">IGST</th>
                        <th className="p-3 text-right">Total Tax</th>
                        <th className="p-3 text-right">Grand Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                      {rows.map((rx) => (
                        <tr key={rx.id} onClick={() => router.push(`/prescription/${rx.id}`)} className="hover:bg-indigo-50/40 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
                          <td className="p-3 text-slate-600 dark:text-slate-300 font-semibold">{formatDate(rx.date)}</td>
                          <td className="p-3 font-mono font-black text-indigo-600 dark:text-indigo-400">{rx.payment?.invoiceNumber || rx.displayId}</td>
                          <td className="p-3 font-black text-slate-900 dark:text-white">{rx.patientName}</td>
                          <td className="p-3 text-right font-mono">{money(rx.payment?.taxableAmount)}</td>
                          <td className="p-3 text-right font-mono">{money(rx.payment?.cgstAmount)}</td>
                          <td className="p-3 text-right font-mono">{money(rx.payment?.sgstAmount)}</td>
                          <td className="p-3 text-right font-mono">{money(rx.payment?.igstAmount)}</td>
                          <td className="p-3 text-right font-mono font-bold text-purple-600">{money(rx.payment?.totalTax)}</td>
                          <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{money(rx.payment?.grandTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-slate-400 font-semibold">Showing {rows.length} of {totalCount} GST invoice{totalCount === 1 ? '' : 's'}</p>
                  {hasNextPage && (
                    <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage} className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50">
                      {isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Load More</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* PRINTABLE DOCUMENT */}
      {settings.gstEnabled && summary && printRows && (
        <div id="printable-gst-report" className="hidden print:block">
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-4">
            <div className="flex items-center gap-3">
              {settings.showLogoOnDocuments && settings.logoUrl && (
                <img src={settings.logoUrl} alt={settings.clinicName} className="w-12 h-12 object-contain shrink-0" />
              )}
              <div>
                <h2 className="text-xl font-black">{settings.clinicName || 'Royal Opticals'}</h2>
                <p className="text-xs text-slate-600 mt-0.5">{[settings.address, settings.phone, settings.email].filter(Boolean).join('  •  ')}</p>
                {settings.gstin && <p className="text-xs text-slate-600">GSTIN: {settings.gstin}</p>}
              </div>
            </div>
            <div className="text-right">
              <h3 className="text-base font-black tracking-wide">GST / TAX REPORT</h3>
              <p className="text-xs text-slate-600 mt-0.5">Period: {periodHeading}</p>
            </div>
          </div>

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Summary</h4>
            <div className="grid grid-cols-5 gap-2 text-center text-[10px] border-2 border-slate-900 p-3">
              <div><p className="text-slate-500">Taxable</p><p className="font-black text-sm mt-0.5">{money(summary.taxableAmount)}</p></div>
              <div><p className="text-slate-500">CGST</p><p className="font-black text-sm mt-0.5">{money(summary.cgstTotal)}</p></div>
              <div><p className="text-slate-500">SGST</p><p className="font-black text-sm mt-0.5">{money(summary.sgstTotal)}</p></div>
              <div><p className="text-slate-500">IGST</p><p className="font-black text-sm mt-0.5">{money(summary.igstTotal)}</p></div>
              <div><p className="text-slate-500">Total GST</p><p className="font-black text-sm mt-0.5">{money(summary.totalTax)}</p></div>
            </div>
          </div>

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Category Tax Rates</h4>
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-1 text-left font-bold">Category</th>
                  <th className="p-1 text-left font-bold">HSN/SAC</th>
                  <th className="p-1 text-right font-bold">Rate</th>
                  <th className="p-1 text-center font-bold">Taxable</th>
                </tr>
              </thead>
              <tbody>
                {taxRateConfig.length === 0 ? (
                  <tr><td colSpan={4} className="p-3 text-center text-slate-500 italic">No category tax rates configured.</td></tr>
                ) : (
                  taxRateConfig.map((r) => (
                    <tr key={r.category} className="border-b border-slate-200">
                      <td className="p-1">{r.category}</td>
                      <td className="p-1 font-mono">{r.hsnSac || '-'}</td>
                      <td className="p-1 text-right">{r.taxRate}%</td>
                      <td className="p-1 text-center">{r.isTaxable ? 'Yes' : 'No'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mb-4">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">GST Invoices</h4>
            <table className="w-full text-[8.5px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-1 text-center font-bold">#</th>
                  <th className="p-1 text-left font-bold">Date</th>
                  <th className="p-1 text-left font-bold">Invoice No</th>
                  <th className="p-1 text-left font-bold">Patient</th>
                  <th className="p-1 text-right font-bold">Taxable</th>
                  <th className="p-1 text-right font-bold">CGST</th>
                  <th className="p-1 text-right font-bold">SGST</th>
                  <th className="p-1 text-right font-bold">IGST</th>
                  <th className="p-1 text-right font-bold">Total Tax</th>
                  <th className="p-1 text-right font-bold">Grand Total</th>
                </tr>
              </thead>
              <tbody>
                {printRows.length === 0 ? (
                  <tr><td colSpan={10} className="p-4 text-center text-slate-500 italic">No GST invoices found for {periodHeading}.</td></tr>
                ) : (
                  printRows.map((rx, idx) => (
                    <tr key={rx.id} className="border-b border-slate-200">
                      <td className="p-1 text-center">{idx + 1}</td>
                      <td className="p-1">{formatDate(rx.date)}</td>
                      <td className="p-1 font-mono">{rx.payment?.invoiceNumber || rx.displayId}</td>
                      <td className="p-1">{rx.patientName}</td>
                      <td className="p-1 text-right">{money(rx.payment?.taxableAmount)}</td>
                      <td className="p-1 text-right">{money(rx.payment?.cgstAmount)}</td>
                      <td className="p-1 text-right">{money(rx.payment?.sgstAmount)}</td>
                      <td className="p-1 text-right">{money(rx.payment?.igstAmount)}</td>
                      <td className="p-1 text-right">{money(rx.payment?.totalTax)}</td>
                      <td className="p-1 text-right">{money(rx.payment?.grandTotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-auto pt-5 flex items-center justify-between text-[10px] break-inside-avoid">
            <div className="flex items-center gap-2">
              <span className="font-bold">Prepared By:</span>
              <span className="inline-block w-32 border-b border-slate-500">&nbsp;</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">Authorized Signature:</span>
              <span className="inline-block w-32 border-b border-slate-500">&nbsp;</span>
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
