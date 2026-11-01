'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/formatDate';
import { exportToExcel } from '@/lib/excelExport';
import { generateExpenseReportPDF } from '@/lib/expenseReportPdf';
import { ConfirmModal } from '@/components/dashboard/ConfirmModal';
import { AddStockModal } from '@/components/dashboard/AddStockModal';
import { StockTransactionTable } from '@/components/dashboard/StockTransactionTable';
import {
  useExpenses,
  fetchAllExpenseRows,
  fetchMonthlyBreakdown,
  fetchFixedScopeExpenseSummary,
  fetchSupplierSummary,
  ExpenseFilters,
} from '@/hooks/useExpenses';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, Legend } from 'recharts';
import { Expense, ExpenseCategory, ExpensePaymentMethod, Supplier } from '@/lib/types';
import { motion } from 'motion/react';
import {
  Wallet,
  Search,
  Printer,
  Download,
  FileSpreadsheet,
  Plus,
  X,
  Edit2,
  Trash2,
  IndianRupee,
  Hash,
  TrendingUp,
  Divide,
  Loader2,
  AlertTriangle,
  Inbox,
  PieChart,
  Receipt,
  XCircle,
  CalendarDays,
  CalendarRange,
  Landmark,
  Boxes,
  Building2,
  Phone,
  MapPinned,
} from 'lucide-react';

type Period = 'daily' | 'week' | 'monthly' | 'yearly' | 'custom';

const CATEGORIES: ExpenseCategory[] = [
  'Frame', 'Reading Glass', 'Lens', 'Solution', 'Contact Lens', 'Medical / Clinic Supplies',
  'Rent', 'Electricity', 'Water', 'Internet', 'Staff Salary', 'Transport',
  'Maintenance', 'Cleaning', 'Office Supplies', 'Equipment',
  'Software / Subscription', 'Marketing', 'Purchase', 'Miscellaneous',
];

const PAYMENT_METHODS: ExpensePaymentMethod[] = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function getRange(period: Period, date: string, month: string, year: string, customFrom?: string, customTo?: string) {
  if (period === 'daily') return { from: date, to: date };
  if (period === 'week') {
    const today = new Date(date);
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toDateStr(monday), to: toDateStr(sunday) };
  }
  if (period === 'monthly') {
    const [y, m] = month.split('-').map(Number);
    return { from: toDateStr(new Date(y, m - 1, 1)), to: toDateStr(new Date(y, m, 0)) };
  }
  if (period === 'custom') return { from: customFrom || date, to: customTo || date };
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

function getHeading(period: Period, from: string, to: string): string {
  if (period === 'daily') return formatDate(from);
  if (period === 'week') return `${formatDate(from)} – ${formatDate(to)}`;
  if (period === 'monthly') return new Date(from).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  if (period === 'custom') return `${formatDate(from)} – ${formatDate(to)}`;
  return new Date(from).getFullYear().toString();
}

const money = (n?: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

const emptyFormData = {
  date: toDateStr(new Date()),
  category: 'Miscellaneous' as ExpenseCategory,
  description: '',
  amount: '',
  paymentMethod: 'Cash' as ExpensePaymentMethod,
  vendor: '',
  referenceNumber: '',
  notes: '',
};

export const ExpenseReportPage: React.FC = () => {
  const { settings, suppliers, addExpense, updateExpense, deleteExpense, deleteSupplier, addToast } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialDateFrom = searchParams.get('dateFrom');
  const initialDateTo = searchParams.get('dateTo');

  const todayStr = toDateStr(new Date());
  const [period, setPeriod] = useState<Period>(initialDateFrom && initialDateTo ? 'custom' : 'daily');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [selectedMonth, setSelectedMonth] = useState(todayStr.slice(0, 7));
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [customFrom, setCustomFrom] = useState(initialDateFrom || todayStr);
  const [customTo, setCustomTo] = useState(initialDateTo || todayStr);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ExpenseCategory | 'all'>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<ExpensePaymentMethod | 'all'>('all');

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { from, to } = useMemo(
    () => getRange(period, selectedDate, selectedMonth, selectedYear, customFrom, customTo),
    [period, selectedDate, selectedMonth, selectedYear, customFrom, customTo]
  );
  const heading = useMemo(() => getHeading(period, from, to), [period, from, to]);

  const filters: ExpenseFilters = useMemo(
    () => ({ dateFrom: from, dateTo: to, search, category: categoryFilter, paymentMethod: paymentMethodFilter }),
    [from, to, search, categoryFilter, paymentMethodFilter]
  );

  const { rows, totalCount, summary, isLoading, isError, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } = useExpenses(filters);

  // Always-current, independent of the active date/category/payment filters
  // above — same real-time subscription pattern useDashboardStats already
  // uses, so "Today's Expenses" here always matches the Dashboard card.
  const fixedSummaryQuery = useQuery({
    queryKey: ['expense-fixed-scope-summary'],
    queryFn: fetchFixedScopeExpenseSummary,
  });
  const fixedSummary = fixedSummaryQuery.data;

  // Supplier-wise spend for the currently selected period (from/to) —
  // independent of the category/payment/search filters below, matching
  // "below the Day/Week/Monthly/Yearly/Custom filters" placement.
  const supplierSummaryQuery = useQuery({
    queryKey: ['expense-supplier-summary', from, to],
    queryFn: () => fetchSupplierSummary(from, to),
  });
  const supplierSummary = supplierSummaryQuery.data || [];
  const supplierSummaryByName = new Map(supplierSummary.map((s) => [s.vendor.toLowerCase(), s]));

  const hasActiveFilters = search !== '' || categoryFilter !== 'all' || paymentMethodFilter !== 'all';
  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setCategoryFilter('all');
    setPaymentMethodFilter('all');
  };

  const [monthlyBreakdown, setMonthlyBreakdown] = useState<{ month: number; total: number }[] | null>(null);
  useEffect(() => {
    if (period === 'yearly') {
      fetchMonthlyBreakdown(selectedYear).then(setMonthlyBreakdown).catch(() => setMonthlyBreakdown(null));
    } else {
      setMonthlyBreakdown(null);
    }
  }, [period, selectedYear]);

  // ── Add / Edit form ─────────────────────────────────────────────────────
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState(emptyFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);

  const openAddForm = () => {
    setEditingExpense(null);
    setFormData({ ...emptyFormData, date: period === 'daily' ? selectedDate : todayStr });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditForm = (exp: Expense) => {
    setEditingExpense(exp);
    setFormData({
      date: exp.date.split('T')[0],
      category: exp.category,
      description: exp.description || '',
      amount: String(exp.amount),
      paymentMethod: exp.paymentMethod || 'Cash',
      vendor: exp.vendor || '',
      referenceNumber: exp.referenceNumber || '',
      notes: exp.notes || '',
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};
    if (!formData.date) errors.date = 'Expense date is required.';
    if (!formData.category) errors.category = 'Category is required.';
    const amountNum = parseFloat(formData.amount);
    if (!formData.amount || isNaN(amountNum) || amountNum <= 0) errors.amount = 'Amount must be greater than 0.';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setIsSaving(true);
    const payload = {
      date: formData.date,
      category: formData.category,
      description: formData.description,
      amount: amountNum,
      paymentMethod: formData.paymentMethod,
      vendor: formData.vendor || undefined,
      referenceNumber: formData.referenceNumber || undefined,
      notes: formData.notes || undefined,
    };

    try {
      if (editingExpense) {
        await updateExpense(editingExpense.id, payload);
      } else {
        await addExpense(payload);
      }
      setIsFormOpen(false);
      refetch();
      fixedSummaryQuery.refetch();
    } catch {
      addToast('Error', 'Expense could not be saved.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = () => {
    if (deletingExpense) {
      deleteExpense(deletingExpense.id);
      setTimeout(() => {
        refetch();
        fixedSummaryQuery.refetch();
      }, 300);
    }
  };

  const handleConfirmDeleteSupplier = () => {
    if (deletingSupplier) {
      deleteSupplier(deletingSupplier.id);
    }
  };

  // ── Export ──────────────────────────────────────────────────────────────
  const [exportBusy, setExportBusy] = useState<'print' | 'pdf' | 'excel' | null>(null);
  const [printRows, setPrintRows] = useState<Expense[] | null>(null);

  const reportNumber = useMemo(() => {
    const d = new Date();
    const suffix = Math.floor(100 + Math.random() * 900);
    return `ESR-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${suffix}`;
  }, []);

  const handlePrint = async () => {
    setExportBusy('print');
    try {
      const all = await fetchAllExpenseRows(filters);
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
      const all = await fetchAllExpenseRows(filters);
      await generateExpenseReportPDF(all, { settings, reportNumber, heading, summary, supplierSummary, monthlyBreakdown });
      addToast('PDF Downloaded', 'Expense report PDF saved successfully!', 'success');
    } catch (err) {
      console.error('Expense report PDF error:', err);
      addToast('PDF Failed', 'Could not generate the expense report PDF.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const handleExportExcel = async () => {
    setExportBusy('excel');
    try {
      const all = await fetchAllExpenseRows(filters);
      const exportRows = all.map((exp, idx) => ({
        'S.No': idx + 1,
        Date: formatDate(exp.date),
        'Expense ID': exp.displayId || '-',
        Category: exp.category,
        Description: exp.description || '-',
        Vendor: exp.vendor || '-',
        Reference: exp.referenceNumber || '-',
        'Payment Method': exp.paymentMethod || '-',
        'Amount (₹)': exp.amount,
        'Paid (₹)': exp.paidAmount ?? exp.amount,
        'Pending (₹)': Math.max(0, exp.amount - (exp.paidAmount ?? exp.amount)),
        Notes: exp.notes || '-',
      }));
      await exportToExcel(exportRows, `Expense_Report_${heading.replace(/\s+/g, '_')}_${reportNumber}`, 'Expense Report');
      addToast('Excel Exported', 'Downloaded expense report spreadsheet!');
    } catch {
      addToast('Export Error', 'Failed to generate Excel export.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const categoryEntries = Object.entries(summary.byCategory) as [ExpenseCategory, number][];
  const paymentEntries = Object.entries(summary.byPaymentMethod) as [ExpensePaymentMethod, { count: number; amount: number }][];

  return (
    <motion.div
      id="esr-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans"
    >
      {/* HEADER + CONTROLS */}
      <div className="print:hidden backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 p-5 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-rose-600 via-orange-500 to-amber-500 text-white rounded-2xl shadow-md shadow-orange-500/20">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Expense Management</h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Track daily expenses, categories and business spending — {heading}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={openAddForm}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
            <button
              onClick={() => setIsAddStockOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95"
              title="Record a Frame, Lens, Solution, or Contact Lens purchase — updates inventory stock too"
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Add Stock</span>
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
          {(['daily', 'week', 'monthly', 'yearly', 'custom'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all ${
                period === p
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {p}
            </button>
          ))}
          {period === 'daily' && (
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500" />
          )}
          {period === 'monthly' && (
            <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500" />
          )}
          {period === 'yearly' && (
            <input type="number" value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} min="2000" max="2100" className="w-24 px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500" />
          )}
          {period === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500" />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500" />
            </>
          )}
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search description, vendor, or expense ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
            />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as ExpenseCategory | 'all')} className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500">
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value as ExpensePaymentMethod | 'all')} className="px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500">
            <option value="all">All Payment Methods</option>
            {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors">
              <XCircle className="w-3.5 h-3.5" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* SUPPLIERS + SUPPLIER-WISE TRACKING — scoped to the period selected above */}
      <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            Suppliers
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Spend and purchase activity per supplier — {heading}</p>
        </div>

        {suppliers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-700" />
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">No suppliers added yet</p>
            <p className="text-[11px] text-slate-400 max-w-xs">Add one from the Supplier field inside "+ Add Stock" — it'll show up here automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...suppliers]
              .sort((a, b) => (supplierSummaryByName.get(b.name.toLowerCase())?.totalAmount || 0) - (supplierSummaryByName.get(a.name.toLowerCase())?.totalAmount || 0))
              .map((s) => {
                const activity = supplierSummaryByName.get(s.name.toLowerCase());
                return (
                  <div
                    key={s.id}
                    onClick={() => router.push(`/suppliers/${s.id}`)}
                    className="p-3.5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-rose-500/50 cursor-pointer transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{s.name}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingSupplier(s);
                        }}
                        className="p-1 -m-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                        title="Delete supplier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {s.phone && (
                        <p className="flex items-center gap-1 text-[11px] text-slate-500"><Phone className="w-3 h-3" />{s.phone}</p>
                      )}
                      {s.state && (
                        <p className="flex items-center gap-1 text-[11px] text-slate-500"><MapPinned className="w-3 h-3" />{s.state}{s.stateCode ? ` (${s.stateCode})` : ''}</p>
                      )}
                    </div>
                    <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-500">{activity ? `${activity.count} entr${activity.count === 1 ? 'y' : 'ies'}` : 'No activity'}</span>
                      <span className="text-sm font-mono font-black text-slate-900 dark:text-white">{money(activity?.totalAmount)}</span>
                    </div>
                    {activity && activity.outstanding !== 0 && (
                      <p className={`mt-1 text-[10px] font-bold ${activity.outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {activity.outstanding > 0 ? `Outstanding: ${money(activity.outstanding)}` : `Advance: ${money(-activity.outstanding)}`}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* FIXED-SCOPE SUMMARY CARDS — always current, independent of the filters below */}
      <div className="print:hidden grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { label: "Today's Expenses", value: fixedSummary ? money(fixedSummary.today) : '…', icon: CalendarDays, iconWrap: 'bg-orange-50 dark:bg-orange-950 text-orange-600', valueText: 'text-orange-600 dark:text-orange-400' },
          { label: 'This Month', value: fixedSummary ? money(fixedSummary.thisMonth) : '…', icon: CalendarRange, iconWrap: 'bg-amber-50 dark:bg-amber-950 text-amber-600', valueText: 'text-amber-600 dark:text-amber-400' },
          { label: 'This Year', value: fixedSummary ? money(fixedSummary.thisYear) : '…', icon: Wallet, iconWrap: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600', valueText: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Total Expenses (All-Time)', value: fixedSummary ? money(fixedSummary.allTime) : '…', icon: Landmark, iconWrap: 'bg-rose-50 dark:bg-rose-950 text-rose-600', valueText: 'text-rose-600 dark:text-rose-400' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">{card.label}</span>
                <div className={`p-2 rounded-xl ${card.iconWrap}`}><Icon className="w-4 h-4" /></div>
              </div>
              <div className={`mt-3 text-xl font-black ${card.valueText}`}>{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* FILTERED-PERIOD SUMMARY CARDS */}
      <div className="print:hidden grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {[
          { label: 'Total Expenses', value: money(summary.total), icon: IndianRupee, iconWrap: 'bg-rose-50 dark:bg-rose-950 text-rose-600', valueText: 'text-rose-600 dark:text-rose-400' },
          { label: 'Expense Entries', value: String(summary.count), icon: Hash, iconWrap: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600', valueText: 'text-indigo-600 dark:text-indigo-400' },
          { label: 'Largest Expense', value: money(summary.largest), icon: TrendingUp, iconWrap: 'bg-amber-50 dark:bg-amber-950 text-amber-600', valueText: 'text-amber-600 dark:text-amber-400' },
          { label: 'Average Expense', value: money(summary.average), icon: Divide, iconWrap: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600', valueText: 'text-emerald-600 dark:text-emerald-400' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold">{card.label}</span>
                <div className={`p-2 rounded-xl ${card.iconWrap}`}><Icon className="w-4 h-4" /></div>
              </div>
              <div className={`mt-3 text-xl font-black ${card.valueText}`}>{card.value}</div>
            </div>
          );
        })}
      </div>

      {/* EXPENSE TABLE */}
      <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
        {isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="w-10 h-10 text-rose-500" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Unable to load expenses</p>
            <p className="text-xs text-slate-500 max-w-sm">{error instanceof Error ? error.message : 'An unexpected error occurred.'}</p>
            <button onClick={() => refetch()} className="mt-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95">Retry</button>
          </div>
        ) : isLoading ? (
          <div className="space-y-2 animate-pulse">
            {[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No Expenses Found</p>
            <p className="text-xs text-slate-400 max-w-sm">No expense records were found for this period.</p>
            <button onClick={openAddForm} className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95">
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </button>
          </div>
        ) : (
          <>
            <StockTransactionTable
              rows={rows}
              codeLabel={categoryFilter === 'Medical / Clinic Supplies' ? 'Batch #' : 'Code'}
              onEdit={openEditForm}
              onDelete={setDeletingExpense}
              emptyLabel="No expense records were found for this period."
            />

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-slate-400 font-semibold">Showing {rows.length} of {totalCount} expense{totalCount === 1 ? '' : 's'}</p>
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

      {/* CATEGORY + PAYMENT SUMMARY */}
      {!isLoading && !isError && rows.length > 0 && (
        <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none">
            <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 mb-4">
              <PieChart className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Expense by Category
            </h3>
            {categoryEntries.length > 0 && (
              <div className="h-48 w-full mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryEntries.map(([cat, amount]) => ({ name: cat, Amount: amount })).sort((a, b) => b.Amount - a.Amount)} layout="vertical" margin={{ left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#3341551a" />
                    <XAxis type="number" tick={{ fontSize: 10, fontWeight: 700 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fontWeight: 700 }} width={90} />
                    <Tooltip formatter={(v: any) => money(Number(v))} />
                    <Bar dataKey="Amount" fill="#e11d48" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="space-y-2">
              {categoryEntries.sort((a, b) => b[1] - a[1]).map(([cat, amount]) => (
                <div key={cat} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-600 dark:text-slate-300">{cat}</span>
                  <span className="font-mono font-black text-slate-900 dark:text-white">{money(amount)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between text-xs pt-2 mt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="font-black text-slate-900 dark:text-white">Total</span>
                <span className="font-mono font-black text-rose-600 dark:text-rose-400">{money(summary.total)}</span>
              </div>
            </div>
          </div>

          <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none">
            <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 mb-4">
              <Receipt className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              Payment Method Summary
            </h3>
            {paymentEntries.length > 0 && (
              <div className="h-48 w-full mb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={paymentEntries.map(([m, data], i) => ({ name: m, value: data.amount, color: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'][i % 5] }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                    >
                      {paymentEntries.map((_, i) => (
                        <Cell key={i} fill={['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#06b6d4'][i % 5]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => money(Number(v))} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                  </RePieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              {paymentEntries.map(([m, data]) => (
                <div key={m} className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800">
                  <p className="text-[11px] font-bold text-slate-500">{m} ({data.count})</p>
                  <p className="text-base font-black text-slate-900 dark:text-white mt-1">{money(data.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* YEARLY MONTHLY BREAKDOWN */}
      {period === 'yearly' && monthlyBreakdown && (
        <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none">
          <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight mb-4">Monthly Breakdown — {selectedYear}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {monthlyBreakdown.map(({ month, total }) => (
              <div key={month} className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-300">{MONTH_NAMES[month]}</span>
                <span className="font-mono font-black text-slate-900 dark:text-white">{money(total)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-200 dark:border-slate-800">
            <span className="text-sm font-black text-slate-900 dark:text-white">Total Yearly Expense</span>
            <span className="text-base font-mono font-black text-rose-600 dark:text-rose-400">{money(monthlyBreakdown.reduce((s, m) => s + m.total, 0))}</span>
          </div>
        </div>
      )}

      {/* ADD / EDIT MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingExpense ? 'Edit Expense' : 'Add Expense'}</h3>
              <button onClick={() => setIsFormOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Expense Date *</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500" />
                  {formErrors.date && <p className="text-[10px] text-rose-600 mt-1">{formErrors.date}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Category *</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as ExpenseCategory })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="What was this expense for?" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Amount (₹) *</label>
                  <input type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500" />
                  {formErrors.amount && <p className="text-[10px] text-rose-600 mt-1">{formErrors.amount}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Method</label>
                  <select value={formData.paymentMethod} onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as ExpensePaymentMethod })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500">
                    {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Paid By / Vendor</label>
                  <input type="text" value={formData.vendor} onChange={(e) => setFormData({ ...formData, vendor: e.target.value })} placeholder="Optional" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Reference No.</label>
                  <input type="text" value={formData.referenceNumber} onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })} placeholder="Optional" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional" rows={2} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-rose-500 resize-none" />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-xs transition-all active:scale-95">
                  {isSaving ? 'Saving...' : editingExpense ? 'Save Changes' : 'Add Expense'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      <ConfirmModal
        isOpen={deletingExpense !== null}
        title="Delete this expense?"
        message={deletingExpense ? `${money(deletingExpense.amount)} — ${deletingExpense.category}. This action cannot be undone.` : 'This action cannot be undone.'}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingExpense(null)}
      />

      <ConfirmModal
        isOpen={deletingSupplier !== null}
        title="Delete this supplier?"
        message={deletingSupplier ? `${deletingSupplier.name} will be removed from your supplier list. Past expenses and stock purchases already recorded under this name are not affected.` : 'This action cannot be undone.'}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirmDeleteSupplier}
        onCancel={() => setDeletingSupplier(null)}
      />

      <AddStockModal
        isOpen={isAddStockOpen}
        onClose={() => {
          setIsAddStockOpen(false);
          refetch();
          fixedSummaryQuery.refetch();
        }}
      />

      {/* PRINTABLE DOCUMENT */}
      {printRows && (
        <div id="printable-esr" className="hidden print:block">
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
              <h3 className="text-base font-black tracking-wide">EXPENSE REPORT</h3>
              <p className="text-xs text-slate-600 mt-0.5">Report No: {reportNumber}</p>
              <p className="text-xs text-slate-600">Report Period: {heading}</p>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Expense Detail</h4>
            <table className="w-full text-[8.5px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-1 text-left font-bold">S.No</th>
                  <th className="p-1 text-left font-bold">Date</th>
                  <th className="p-1 text-left font-bold">Expense ID</th>
                  <th className="p-1 text-left font-bold">Category</th>
                  <th className="p-1 text-left font-bold">Description</th>
                  <th className="p-1 text-left font-bold">Vendor</th>
                  <th className="p-1 text-left font-bold">Reference</th>
                  <th className="p-1 text-center font-bold">Method</th>
                  <th className="p-1 text-right font-bold">Amount</th>
                  <th className="p-1 text-right font-bold">Paid</th>
                  <th className="p-1 text-right font-bold">Pending</th>
                </tr>
              </thead>
              <tbody>
                {printRows.length === 0 ? (
                  <tr><td colSpan={11} className="p-4 text-center text-slate-500 italic">No expense records were found for this period.</td></tr>
                ) : (
                  printRows.map((exp, idx) => {
                    const paid = exp.paidAmount ?? exp.amount;
                    const pending = Math.max(0, exp.amount - paid);
                    return (
                      <tr key={exp.id} className="border-b border-slate-200">
                        <td className="p-1">{idx + 1}</td>
                        <td className="p-1">{formatDate(exp.date)}</td>
                        <td className="p-1 font-mono">{exp.displayId || '-'}</td>
                        <td className="p-1">{exp.category}</td>
                        <td className="p-1">{exp.description || '-'}</td>
                        <td className="p-1">{exp.vendor || '-'}</td>
                        <td className="p-1 font-mono">{exp.referenceNumber || '-'}</td>
                        <td className="p-1 text-center">{exp.paymentMethod || '-'}</td>
                        <td className="p-1 text-right">{money(exp.amount)}</td>
                        <td className="p-1 text-right">{money(paid)}</td>
                        <td className="p-1 text-right">{money(pending)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Category Summary</h4>
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-1 text-left font-bold">Category</th>
                  <th className="p-1 text-right font-bold">Amount</th>
                  <th className="p-1 text-right font-bold">Share</th>
                </tr>
              </thead>
              <tbody>
                {categoryEntries.length === 0 ? (
                  <tr><td colSpan={3} className="p-3 text-center text-slate-500 italic">No category data available.</td></tr>
                ) : (
                  [...categoryEntries]
                    .sort((a, b) => b[1] - a[1])
                    .map(([cat, amount]) => (
                      <tr key={cat} className="border-b border-slate-200">
                        <td className="p-1">{cat}</td>
                        <td className="p-1 text-right">{money(amount)}</td>
                        <td className="p-1 text-right">{summary.total > 0 ? `${((amount / summary.total) * 100).toFixed(1)}%` : '0%'}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Payment Summary</h4>
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-1 text-left font-bold">Payment Method</th>
                  <th className="p-1 text-right font-bold">Transactions</th>
                  <th className="p-1 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {paymentEntries.length === 0 ? (
                  <tr><td colSpan={3} className="p-3 text-center text-slate-500 italic">No payment data available.</td></tr>
                ) : (
                  [...paymentEntries]
                    .sort((a, b) => b[1].amount - a[1].amount)
                    .map(([m, data]) => (
                      <tr key={m} className="border-b border-slate-200">
                        <td className="p-1">{m}</td>
                        <td className="p-1 text-right">{data.count}</td>
                        <td className="p-1 text-right">{money(data.amount)}</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mb-4">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Supplier / Vendor-wise Summary</h4>
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-1 text-left font-bold">Vendor</th>
                  <th className="p-1 text-right font-bold">Transactions</th>
                  <th className="p-1 text-right font-bold">Total Amount</th>
                  <th className="p-1 text-right font-bold">Total Paid</th>
                  <th className="p-1 text-right font-bold">Outstanding</th>
                  <th className="p-1 text-left font-bold">Last Purchase</th>
                </tr>
              </thead>
              <tbody>
                {supplierSummary.length === 0 ? (
                  <tr><td colSpan={6} className="p-3 text-center text-slate-500 italic">No supplier activity for this period.</td></tr>
                ) : (
                  supplierSummary.map((s) => (
                    <tr key={s.vendor} className="border-b border-slate-200">
                      <td className="p-1 font-bold">{s.vendor}</td>
                      <td className="p-1 text-right">{s.count}</td>
                      <td className="p-1 text-right">{money(s.totalAmount)}</td>
                      <td className="p-1 text-right">{money(s.totalPaid)}</td>
                      <td className="p-1 text-right">{money(s.outstanding)}</td>
                      <td className="p-1">{formatDate(s.lastDate)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {period === 'yearly' && monthlyBreakdown && (
            <div className="mb-4 break-inside-avoid">
              <h4 className="font-black text-xs uppercase tracking-wide mb-2">Monthly Breakdown — {selectedYear}</h4>
              <table className="w-full text-[9px] border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white">
                    <th className="p-1 text-left font-bold">Month</th>
                    <th className="p-1 text-right font-bold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyBreakdown.map(({ month, total }) => (
                    <tr key={month} className="border-b border-slate-200">
                      <td className="p-1">{MONTH_NAMES[month]}</td>
                      <td className="p-1 text-right">{money(total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-auto pt-5 break-inside-avoid">
            <div className="border-2 border-slate-900 p-3">
              <h4 className="font-black text-xs uppercase tracking-wide mb-2.5">Grand Total</h4>
              <div className="grid grid-cols-6 gap-2 text-center text-[9px]">
                <div><p className="text-slate-500">Transactions</p><p className="font-black text-sm mt-0.5">{summary.count}</p></div>
                <div><p className="text-slate-500">Total Expense</p><p className="font-black text-sm mt-0.5">{money(summary.total)}</p></div>
                <div><p className="text-slate-500">Total Paid</p><p className="font-black text-sm mt-0.5">{money(printRows.reduce((s, r) => s + (r.paidAmount ?? r.amount), 0))}</p></div>
                <div><p className="text-slate-500">Total Pending</p><p className="font-black text-sm mt-0.5">{money(printRows.reduce((s, r) => s + Math.max(0, r.amount - (r.paidAmount ?? r.amount)), 0))}</p></div>
                <div><p className="text-slate-500">Avg / Transaction</p><p className="font-black text-sm mt-0.5">{money(summary.average)}</p></div>
                <div><p className="text-slate-500">Largest Expense</p><p className="font-black text-sm mt-0.5">{money(summary.largest)}</p></div>
              </div>
            </div>

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
