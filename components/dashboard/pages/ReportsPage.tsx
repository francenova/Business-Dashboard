'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/formatDate';
import { exportToExcel } from '@/lib/excelExport';
import { generateReportAnalysisPDF } from '@/lib/reportAnalysisPdf';
import { fetchSalesSummary, SalesRegisterFilters } from '@/hooks/useSalesRegister';
import { fetchExpenseSummary, ExpenseFilters } from '@/hooks/useExpenses';
import { useReportAnalysis, getPreviousPeriodRange, pctChange, ReportAnalysisFilters } from '@/hooks/useReportAnalysis';
import { motion } from 'motion/react';
import {
  BarChart3,
  Printer,
  Download,
  FileSpreadsheet,
  IndianRupee,
  Wallet,
  TrendingDown,
  Percent,
  FileText,
  Clock,
  AlertTriangle,
  Inbox,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Users,
  UserPlus,
  Repeat,
  Stethoscope,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

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
const PIE_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6'];

const CATEGORY_ICON_COLOR: Record<string, string> = {
  Frame: '#6366f1',
  Lens: '#10b981',
  'Reading Glass': '#8b5cf6',
  Solution: '#06b6d4',
  'Contact Lens': '#14b8a6',
  Medicines: '#f59e0b',
  Consultation: '#ec4899',
};

const EmptySection: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
    <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700" />
    <p className="text-xs font-bold text-slate-400">{label}</p>
  </div>
);

const ChangeChip: React.FC<{ label: string; current: number; previous: number }> = ({ label, current, previous }) => {
  const change = pctChange(current, previous);
  return (
    <div className="p-3.5 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
      <p className="text-[11px] font-bold text-slate-500">{label} vs previous period</p>
      {change ? (
        <p
          className={`text-sm font-black flex items-center gap-1 mt-1 ${
            change.direction === 'up'
              ? 'text-emerald-600 dark:text-emerald-400'
              : change.direction === 'down'
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-slate-500'
          }`}
        >
          {change.direction === 'up' ? (
            <ArrowUpRight className="w-3.5 h-3.5" />
          ) : change.direction === 'down' ? (
            <ArrowDownRight className="w-3.5 h-3.5" />
          ) : (
            <Minus className="w-3.5 h-3.5" />
          )}
          {change.value > 0 ? '+' : ''}
          {change.value.toFixed(1)}%
        </p>
      ) : (
        <p className="text-xs font-bold text-slate-400 mt-1">No previous-period comparison</p>
      )}
    </div>
  );
};

export const ReportsPage: React.FC = () => {
  const router = useRouter();
  const { settings, addToast } = useApp();

  const [period, setPeriod] = useState<Period>('month');
  const todayStr = toDateStr(new Date());
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);
  const [compareEnabled, setCompareEnabled] = useState(false);

  const { from, to } = useMemo(() => getRangeForPeriod(period, customFrom, customTo), [period, customFrom, customTo]);
  const periodHeading = useMemo(() => getPeriodHeading(period, from, to), [period, from, to]);

  const salesFilters: SalesRegisterFilters = useMemo(
    () => ({ dateFrom: from, dateTo: to, search: '', paymentMethod: 'all', paymentStatus: 'all', category: 'all' }),
    [from, to]
  );
  const expenseFilters: ExpenseFilters = useMemo(
    () => ({ dateFrom: from, dateTo: to, search: '', category: 'all', paymentMethod: 'all' }),
    [from, to]
  );
  const analysisFilters: ReportAnalysisFilters = useMemo(() => ({ dateFrom: from, dateTo: to }), [from, to]);

  const salesQuery = useQuery({
    queryKey: ['report-analysis-sales-summary', salesFilters],
    queryFn: () => fetchSalesSummary(salesFilters),
  });
  const expenseQuery = useQuery({
    queryKey: ['report-analysis-expense-summary', expenseFilters],
    queryFn: () => fetchExpenseSummary(expenseFilters),
  });
  const analysis = useReportAnalysis(analysisFilters);

  const prevRange = useMemo(() => getPreviousPeriodRange(from, to), [from, to]);
  const prevSalesFilters: SalesRegisterFilters = useMemo(
    () => ({
      dateFrom: prevRange.dateFrom,
      dateTo: prevRange.dateTo,
      search: '',
      paymentMethod: 'all',
      paymentStatus: 'all',
      category: 'all',
    }),
    [prevRange]
  );
  const prevExpenseFilters: ExpenseFilters = useMemo(
    () => ({ dateFrom: prevRange.dateFrom, dateTo: prevRange.dateTo, search: '', category: 'all', paymentMethod: 'all' }),
    [prevRange]
  );
  const prevSalesQuery = useQuery({
    queryKey: ['report-analysis-prev-sales-summary', prevSalesFilters],
    queryFn: () => fetchSalesSummary(prevSalesFilters),
    enabled: compareEnabled,
  });
  const prevExpenseQuery = useQuery({
    queryKey: ['report-analysis-prev-expense-summary', prevExpenseFilters],
    queryFn: () => fetchExpenseSummary(prevExpenseFilters),
    enabled: compareEnabled,
  });

  const sales = salesQuery.data;
  const expenses = expenseQuery.data;

  const isLoading = salesQuery.isLoading || expenseQuery.isLoading || analysis.isLoading;
  const isError = salesQuery.isError || expenseQuery.isError || analysis.isError;

  const avgInvoiceValue = sales && sales.totalInvoices > 0 ? sales.grandTotal / sales.totalInvoices : 0;

  const reportTable = useMemo(() => {
    const expenseByKey = new Map(analysis.expenseTrend.map((e) => [e.key, e.amount]));
    return analysis.trend.map((t) => ({
      ...t,
      expense: expenseByKey.get(t.key) || 0,
      pending: Math.max(0, t.sales - t.collection),
    }));
  }, [analysis.trend, analysis.expenseTrend]);

  const [exportBusy, setExportBusy] = useState<'pdf' | 'excel' | null>(null);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    if (!sales || !expenses || !analysis.visits || !analysis.patients) return;
    setExportBusy('pdf');
    try {
      await generateReportAnalysisPDF({
        settings,
        periodHeading,
        from,
        to,
        sales,
        expenses,
        categoryBreakdown: analysis.categoryBreakdown,
        topMedicines: analysis.topMedicines,
        patients: analysis.patients,
        visits: analysis.visits,
        outstandingByCustomer: analysis.outstandingByCustomer,
        reportTable,
        avgInvoiceValue,
      });
      addToast('PDF Downloaded', 'Report & Analysis PDF saved successfully!', 'success');
    } catch (err) {
      console.error('Report Analysis PDF error:', err);
      addToast('PDF Failed', 'Could not generate the report PDF.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const handleExportExcel = async () => {
    setExportBusy('excel');
    try {
      const rows = reportTable.map((r) => ({
        Date: r.label,
        'Sales (₹)': r.sales,
        'Collection (₹)': r.collection,
        'Pending (₹)': r.pending,
        'GST (₹)': r.tax,
        Invoices: r.invoiceCount,
        'Expenses (₹)': r.expense,
      }));
      if (rows.length === 0) {
        addToast('No Data', 'Nothing to export for this period.', 'error');
        return;
      }
      await exportToExcel(rows, `Report_Analysis_${periodHeading.replace(/\s+/g, '_')}`, 'Report & Analysis');
      addToast('Excel Exported', 'Downloaded Report & Analysis spreadsheet!');
    } catch {
      addToast('Export Error', 'Failed to generate Excel export.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const goToSales = (extra?: string) => router.push(`/sales?dateFrom=${from}&dateTo=${to}${extra || ''}`);
  const goToExpenses = () => router.push(`/expenses?dateFrom=${from}&dateTo=${to}`);
  const goToGst = () => router.push(`/sales?mode=daily-report&dateFrom=${from}&dateTo=${to}`);

  const summaryCards = [
    {
      label: 'Total Sales',
      value: money(sales?.grandTotal),
      icon: IndianRupee,
      iconWrap: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600',
      valueText: 'text-indigo-600 dark:text-indigo-400',
      onClick: () => goToSales(),
    },
    {
      label: 'Total Collection',
      value: money(sales?.collected),
      icon: Wallet,
      iconWrap: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600',
      valueText: 'text-emerald-600 dark:text-emerald-400',
      onClick: () => goToSales(),
    },
    {
      label: 'Total Expenses',
      value: money(expenses?.total),
      icon: TrendingDown,
      iconWrap: 'bg-rose-50 dark:bg-rose-950 text-rose-600',
      valueText: 'text-rose-600 dark:text-rose-400',
      onClick: goToExpenses,
    },
    {
      label: 'Pending',
      value: money(sales?.pending),
      icon: Clock,
      iconWrap: 'bg-amber-50 dark:bg-amber-950 text-amber-600',
      valueText: 'text-amber-600 dark:text-amber-400',
      onClick: () => goToSales('&paymentStatus=Pending'),
    },
    settings.gstEnabled
      ? {
          label: 'GST',
          value: money(sales?.totalTax),
          icon: Percent,
          iconWrap: 'bg-purple-50 dark:bg-purple-950 text-purple-600',
          valueText: 'text-purple-600 dark:text-purple-400',
          onClick: goToGst,
        }
      : {
          label: 'GST',
          value: money(0),
          icon: Percent,
          iconWrap: 'bg-slate-100 dark:bg-slate-800 text-slate-500',
          valueText: 'text-slate-500 dark:text-slate-400',
          onClick: goToGst,
          note: 'Not configured',
        },
    {
      label: 'Invoices',
      value: String(sales?.totalInvoices || 0),
      icon: FileText,
      iconWrap: 'bg-blue-50 dark:bg-blue-950 text-blue-600',
      valueText: 'text-blue-600 dark:text-blue-400',
      onClick: () => goToSales(),
    },
  ];

  const expenseCategoryRows = expenses
    ? Object.entries(expenses.byCategory)
        .filter(([, amount]) => (amount || 0) > 0)
        .sort(([, a], [, b]) => (b || 0) - (a || 0))
    : [];

  const paymentMethodPie = sales
    ? (['Cash', 'UPI', 'Card', 'Mixed'] as const)
        .map((m, i) => ({ name: m, value: sales.byPaymentMethod[m].amount, color: PIE_COLORS[i] }))
        .filter((d) => d.value > 0)
    : [];

  const visitWeekdayMax = analysis.visits ? Math.max(1, ...analysis.visits.byWeekday.map((d) => d.count)) : 1;

  return (
    <motion.div
      id="reports-page"
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
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Report &amp; Analysis</h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Understand your business performance — {periodHeading}
              </p>
            </div>
          </div>

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
              disabled={exportBusy !== null || isLoading}
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
          <label className="flex items-center gap-1.5 ml-auto px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => setCompareEnabled(e.target.checked)}
              className="w-3.5 h-3.5 accent-indigo-600"
            />
            Compare With Previous Period
          </label>
        </div>
      </div>

      {isError && (
        <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="w-10 h-10 text-rose-500" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Unable to load report data</p>
          <p className="text-xs text-slate-500 max-w-sm">
            One or more sections failed to load. Try again — your data is unaffected.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {!isError && (
        <>
          {/* COMPARISON STRIP */}
          {compareEnabled && sales && expenses && prevSalesQuery.data && prevExpenseQuery.data && (
            <div className="print:hidden grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ChangeChip label="Sales" current={sales.grandTotal} previous={prevSalesQuery.data.grandTotal} />
              <ChangeChip label="Collection" current={sales.collected} previous={prevSalesQuery.data.collected} />
              <ChangeChip label="Expenses" current={expenses.total} previous={prevExpenseQuery.data.total} />
              <ChangeChip label="Invoices" current={sales.totalInvoices} previous={prevSalesQuery.data.totalInvoices} />
            </div>
          )}

          {/* SUMMARY CARDS */}
          <div className="print:hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {isLoading
              ? [...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />
                ))
              : summaryCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <button
                      key={card.label}
                      onClick={card.onClick}
                      className="text-left p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="text-xs font-semibold">{card.label}</span>
                        <div className={`p-2 rounded-xl ${card.iconWrap}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                      </div>
                      <div className={`mt-3 text-xl font-black ${card.valueText}`}>{card.value}</div>
                      {card.note && <p className="text-[10px] text-slate-400 mt-0.5">{card.note}</p>}
                    </button>
                  );
                })}
          </div>

          {/* SALES TREND */}
          <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Sales Trend</h3>
            {analysis.trend.length === 0 ? (
              <EmptySection label="No sales recorded for this period." />
            ) : (
              <div className="h-64 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analysis.trend}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorCollection" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3341551a" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', fontWeight: 700 }} />
                    <Area type="monotone" dataKey="sales" name="Sales" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                    <Area type="monotone" dataKey="collection" name="Collection" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCollection)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SALES VS COLLECTION */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Sales vs Collection</h3>
              {!sales || sales.totalInvoices === 0 ? (
                <EmptySection label="No sales recorded for this period." />
              ) : (
                <>
                  <div className="h-48 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[{ name: periodHeading, Sales: sales.grandTotal, Collection: sales.collected }]}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3341551a" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fontWeight: 700 }} axisLine={false} tickLine={false} />
                        <Tooltip formatter={(v: any) => money(Number(v))} />
                        <Bar dataKey="Sales" fill="#6366f1" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="Collection" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    <div><p className="text-slate-400 font-bold">Sales</p><p className="font-black text-slate-900 dark:text-white mt-0.5">{money(sales.grandTotal)}</p></div>
                    <div><p className="text-slate-400 font-bold">Collected</p><p className="font-black text-emerald-600 mt-0.5">{money(sales.collected)}</p></div>
                    <div><p className="text-slate-400 font-bold">Pending</p><p className="font-black text-rose-600 mt-0.5">{money(sales.pending)}</p></div>
                  </div>
                </>
              )}
            </div>

            {/* EXPENSE ANALYSIS */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Expense Analysis</h3>
                <button onClick={goToExpenses} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  View ESR <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {expenseCategoryRows.length === 0 ? (
                <EmptySection label="No expenses recorded for this period." />
              ) : (
                <div className="space-y-2">
                  {expenseCategoryRows.map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{category}</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white font-mono">{money(amount)}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-2.5 border-t-2 border-slate-200 dark:border-slate-700 pt-2.5">
                    <span className="text-xs font-black text-slate-900 dark:text-white">Total</span>
                    <span className="text-xs font-black text-rose-600 font-mono">{money(expenses?.total)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* SALES BY CATEGORY */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Sales by Category</h3>
              {analysis.categoryBreakdown.length === 0 ? (
                <EmptySection label="No categorized sales for this period." />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Quantity</th>
                        <th className="p-3 text-right">Sales Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                      {analysis.categoryBreakdown.map((row) => (
                        <tr key={row.category}>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CATEGORY_ICON_COLOR[row.category] || '#94a3b8' }} />
                            {row.category}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{row.quantity}</td>
                          <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{money(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* TOP MEDICINES */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Top Selling Medicines</h3>
              {analysis.topMedicines.length === 0 ? (
                <EmptySection label="No medicines sold for this period." />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                        <th className="p-3">#</th>
                        <th className="p-3">Product</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Qty</th>
                        <th className="p-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                      {analysis.topMedicines.map((row, idx) => (
                        <tr key={row.key}>
                          <td className="p-3 font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{row.name}</td>
                          <td className="p-3 text-slate-500">{row.category}</td>
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{row.quantity}</td>
                          <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{money(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* PAYMENT METHOD */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Payment Method</h3>
              {paymentMethodPie.length === 0 ? (
                <EmptySection label="No payments recorded for this period." />
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentMethodPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={5}>
                        {paymentMethodPie.map((entry, index) => (
                          <Cell key={`pay-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => money(Number(v))} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* GST SUMMARY */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">GST Summary</h3>
                <button onClick={goToGst} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                  View Details <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              {!settings.gstEnabled ? (
                <EmptySection label="GST is not configured for this clinic yet." />
              ) : (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800"><p className="text-slate-400 font-bold">Taxable Sales</p><p className="font-black text-slate-900 dark:text-white mt-1">{money(sales?.taxableAmount)}</p></div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800"><p className="text-slate-400 font-bold">Total GST</p><p className="font-black text-purple-600 mt-1">{money(sales?.totalTax)}</p></div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800"><p className="text-slate-400 font-bold">CGST</p><p className="font-black text-slate-900 dark:text-white mt-1">{money(sales?.cgstTotal)}</p></div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800"><p className="text-slate-400 font-bold">SGST</p><p className="font-black text-slate-900 dark:text-white mt-1">{money(sales?.sgstTotal)}</p></div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/60 dark:border-slate-800 col-span-2"><p className="text-slate-400 font-bold">IGST</p><p className="font-black text-slate-900 dark:text-white mt-1">{money(sales?.igstTotal)}</p></div>
                </div>
              )}
            </div>
          </div>

          <div className="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* INVOICE ANALYSIS */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Invoice Analysis</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-slate-500 font-bold">Total Invoices</span><span className="font-black text-slate-900 dark:text-white">{sales?.totalInvoices || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-bold">Paid</span><span className="font-black text-emerald-600">{sales?.byStatus.Paid || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-bold">Partially Paid</span><span className="font-black text-amber-600">{sales?.byStatus.Partial || 0}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 font-bold">Pending</span><span className="font-black text-rose-600">{sales?.byStatus.Pending || 0}</span></div>
                <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800"><span className="text-slate-500 font-bold">Avg Invoice Value</span><span className="font-black text-slate-900 dark:text-white">{money(avgInvoiceValue)}</span></div>
              </div>
            </div>

            {/* PATIENT ANALYSIS */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2"><Users className="w-4 h-4 text-indigo-600" /> Patient Analysis</h3>
              {!analysis.patients ? (
                <div className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500 font-bold">Total Patients</span><span className="font-black text-slate-900 dark:text-white">{analysis.patients.totalPatients}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-bold flex items-center gap-1"><UserPlus className="w-3 h-3" /> New (this period)</span><span className="font-black text-indigo-600">{analysis.patients.newPatients}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-bold flex items-center gap-1"><Repeat className="w-3 h-3" /> Returning (this period)</span><span className="font-black text-emerald-600">{analysis.patients.returningPatients}</span></div>
                </div>
              )}
            </div>

            {/* VISIT ANALYSIS */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2"><Stethoscope className="w-4 h-4 text-indigo-600" /> Visit Analysis</h3>
              {!analysis.visits ? (
                <div className="h-20 bg-slate-100 dark:bg-slate-800/60 rounded-xl animate-pulse" />
              ) : analysis.visits.totalVisits === 0 ? (
                <EmptySection label="No visits recorded for this period." />
              ) : (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500 font-bold">Total Visits</span><span className="font-black text-slate-900 dark:text-white">{analysis.visits.totalVisits}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-bold">Completed</span><span className="font-black text-emerald-600">{analysis.visits.byStatus.Completed}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-bold">Pending Delivery</span><span className="font-black text-amber-600">{analysis.visits.byStatus['Pending Delivery']}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-bold">Ready Order</span><span className="font-black text-blue-600">{analysis.visits.byStatus['Ready Order']}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500 font-bold">In Progress</span><span className="font-black text-slate-600 dark:text-slate-300">{analysis.visits.byStatus['In Progress']}</span></div>
                </div>
              )}
            </div>
          </div>

          {/* OUTSTANDING BY CUSTOMER */}
          <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Outstanding by Customer</h3>
            {analysis.outstandingByCustomer.length === 0 ? (
              <EmptySection label="No outstanding balances." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                      <th className="p-3">Customer</th>
                      <th className="p-3 text-right">Pending</th>
                      <th className="p-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {analysis.outstandingByCustomer.map((row) => (
                      <tr key={row.patientId}>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{row.patientName}</td>
                        <td className="p-3 text-right font-mono font-black text-rose-600">{money(row.pending)}</td>
                        <td className="p-3 text-right">
                          <button onClick={() => router.push(`/ledger?patientId=${row.patientId}`)} className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
                            View Ledger
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* REPORT TABLE */}
          <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Report Table</h3>
            {reportTable.length === 0 ? (
              <EmptySection label="No data available for this period." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                      <th className="p-3">Date</th>
                      <th className="p-3 text-right">Sales</th>
                      <th className="p-3 text-right">Collection</th>
                      <th className="p-3 text-right">Expenses</th>
                      <th className="p-3 text-right">GST</th>
                      <th className="p-3 text-right">Invoices</th>
                      <th className="p-3 text-right">Pending</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {reportTable.map((row) => (
                      <tr key={row.key}>
                        <td className="p-3 font-semibold text-slate-700 dark:text-slate-200">{row.label}</td>
                        <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-200">{money(row.sales)}</td>
                        <td className="p-3 text-right font-mono text-emerald-600">{money(row.collection)}</td>
                        <td className="p-3 text-right font-mono text-rose-600">{money(row.expense)}</td>
                        <td className="p-3 text-right font-mono text-purple-600">{money(row.tax)}</td>
                        <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{row.invoiceCount}</td>
                        <td className="p-3 text-right font-mono text-amber-600">{money(row.pending)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* PRINTABLE DOCUMENT */}
      {!isError && sales && expenses && (
        <div id="printable-report-analysis" className="hidden print:block">
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
              <h3 className="text-base font-black tracking-wide">REPORT &amp; ANALYSIS</h3>
              <p className="text-xs text-slate-600 mt-0.5">Period: {formatDate(from)} to {formatDate(to)}</p>
            </div>
          </div>

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Summary</h4>
            <div className="grid grid-cols-6 gap-2 text-center text-[10px] border-2 border-slate-900 p-3">
              <div><p className="text-slate-500">Sales</p><p className="font-black text-sm mt-0.5">{money(sales.grandTotal)}</p></div>
              <div><p className="text-slate-500">Collection</p><p className="font-black text-sm mt-0.5">{money(sales.collected)}</p></div>
              <div><p className="text-slate-500">Expenses</p><p className="font-black text-sm mt-0.5">{money(expenses.total)}</p></div>
              <div><p className="text-slate-500">Pending</p><p className="font-black text-sm mt-0.5">{money(sales.pending)}</p></div>
              <div><p className="text-slate-500">GST</p><p className="font-black text-sm mt-0.5">{money(sales.totalTax)}</p></div>
              <div><p className="text-slate-500">Invoices</p><p className="font-black text-sm mt-0.5">{sales.totalInvoices}</p></div>
            </div>
          </div>

          {reportTable.length > 0 && (
            <div className="mb-4 break-inside-avoid">
              <h4 className="font-black text-xs uppercase tracking-wide mb-2">Sales Analysis</h4>
              <table className="w-full text-[9px] border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-1 text-left font-bold">Date</th>
                    <th className="p-1 text-right font-bold">Sales</th>
                    <th className="p-1 text-right font-bold">Collection</th>
                    <th className="p-1 text-right font-bold">Expenses</th>
                    <th className="p-1 text-right font-bold">GST</th>
                    <th className="p-1 text-right font-bold">Invoices</th>
                    <th className="p-1 text-right font-bold">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {reportTable.map((row) => (
                    <tr key={row.key} className="border-b border-slate-200">
                      <td className="p-1">{row.label}</td>
                      <td className="p-1 text-right">{money(row.sales)}</td>
                      <td className="p-1 text-right">{money(row.collection)}</td>
                      <td className="p-1 text-right">{money(row.expense)}</td>
                      <td className="p-1 text-right">{money(row.tax)}</td>
                      <td className="p-1 text-right">{row.invoiceCount}</td>
                      <td className="p-1 text-right">{money(row.pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {expenseCategoryRows.length > 0 && (
            <div className="mb-4 break-inside-avoid">
              <h4 className="font-black text-xs uppercase tracking-wide mb-2">Expense Analysis</h4>
              <div className="grid grid-cols-4 gap-2 text-[10px]">
                {expenseCategoryRows.map(([category, amount]) => (
                  <div key={category} className="border border-slate-300 rounded p-1.5">
                    <p className="text-slate-500">{category}</p>
                    <p className="font-black">{money(amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">GST Summary</h4>
            <div className="grid grid-cols-5 gap-2 text-center text-[10px] border border-slate-300 p-2">
              <div><p className="text-slate-500">Taxable</p><p className="font-black">{money(sales.taxableAmount)}</p></div>
              <div><p className="text-slate-500">CGST</p><p className="font-black">{money(sales.cgstTotal)}</p></div>
              <div><p className="text-slate-500">SGST</p><p className="font-black">{money(sales.sgstTotal)}</p></div>
              <div><p className="text-slate-500">IGST</p><p className="font-black">{money(sales.igstTotal)}</p></div>
              <div><p className="text-slate-500">Total GST</p><p className="font-black">{money(sales.totalTax)}</p></div>
            </div>
          </div>

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Payment Analysis</h4>
            <div className="grid grid-cols-4 gap-2 text-[10px]">
              {(['Cash', 'UPI', 'Card', 'Mixed'] as const).map((m) => (
                <div key={m} className="border border-slate-300 rounded p-1.5">
                  <p className="text-slate-500">{m} ({sales.byPaymentMethod[m].count})</p>
                  <p className="font-black">{money(sales.byPaymentMethod[m].amount)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Invoice Analysis</h4>
            <div className="grid grid-cols-5 gap-2 text-center text-[10px] border border-slate-300 p-2">
              <div><p className="text-slate-500">Total</p><p className="font-black">{sales.totalInvoices}</p></div>
              <div><p className="text-slate-500">Paid</p><p className="font-black">{sales.byStatus.Paid}</p></div>
              <div><p className="text-slate-500">Partial</p><p className="font-black">{sales.byStatus.Partial}</p></div>
              <div><p className="text-slate-500">Pending</p><p className="font-black">{sales.byStatus.Pending}</p></div>
              <div><p className="text-slate-500">Avg Value</p><p className="font-black">{money(avgInvoiceValue)}</p></div>
            </div>
          </div>

          {analysis.categoryBreakdown.length > 0 && (
            <div className="mb-4 break-inside-avoid">
              <h4 className="font-black text-xs uppercase tracking-wide mb-2">Category Analysis</h4>
              <table className="w-full text-[9px] border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-1 text-left font-bold">Category</th>
                    <th className="p-1 text-right font-bold">Quantity</th>
                    <th className="p-1 text-right font-bold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.categoryBreakdown.map((row) => (
                    <tr key={row.category} className="border-b border-slate-200">
                      <td className="p-1">{row.category}</td>
                      <td className="p-1 text-right">{row.quantity}</td>
                      <td className="p-1 text-right">{money(row.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
