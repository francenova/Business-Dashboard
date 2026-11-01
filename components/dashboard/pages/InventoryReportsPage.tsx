'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/formatDate';
import { exportToExcel } from '@/lib/excelExport';
import { generateInventoryReportsPDF } from '@/lib/inventoryReportsPdf';
import { categoryLabel, codeFor, typeSpecFor, stockStatusLabel, buildMovementTotals } from '@/lib/inventoryReportHelpers';
import { useInventoryReports, InventoryCategory } from '@/hooks/useInventoryReports';
import { StockInventoryTable } from '@/components/dashboard/StockInventoryTable';
import { motion } from 'motion/react';
import {
  Boxes,
  Search,
  Printer,
  Download,
  FileSpreadsheet,
  Package,
  Layers,
  AlertTriangle,
  XCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  IndianRupee,
  Inbox,
  Loader2,
  RefreshCw,
  Eye,
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
// 'Reading Glasses' is deliberately not a flat top-level chip — it's reached
// via the Frames chip's sub-toggle below (Regular Frame / Reading Glass),
// mirroring Add Stock's own Frame category grouping instead of sitting as
// an unrelated sibling next to Lenses/Solutions/Contact Lens.
const CATEGORIES: InventoryCategory[] = ['all', 'Frames', 'Lenses', 'Medicines', 'Solutions', 'Contact Lens'];
const FRAME_FAMILY: InventoryCategory[] = ['Frames', 'Reading Glasses'];

const EmptySection: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
    <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700" />
    <p className="text-xs font-bold text-slate-400">{label}</p>
  </div>
);

export const InventoryReportsPage: React.FC = () => {
  const router = useRouter();
  const { settings, navigateTo, addToast } = useApp();

  const [period, setPeriod] = useState<Period>('month');
  const todayStr = toDateStr(new Date());
  const [customFrom, setCustomFrom] = useState(todayStr);
  const [customTo, setCustomTo] = useState(todayStr);
  const [category, setCategory] = useState<InventoryCategory>('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  React.useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { from, to } = useMemo(() => getRangeForPeriod(period, customFrom, customTo), [period, customFrom, customTo]);
  const periodHeading = useMemo(() => getPeriodHeading(period, from, to), [period, from, to]);
  const categoryHeading = category === 'all' ? 'All Categories' : category;

  const filters = useMemo(() => ({ dateFrom: from, dateTo: to, category, search }), [from, to, category, search]);
  const { items, movements, summary, lowStockItems, outOfStockItems, categorySummary, isLoading, isError, refetch } = useInventoryReports(filters);

  const [exportBusy, setExportBusy] = useState<'pdf' | 'excel' | null>(null);

  const handlePrint = () => window.print();

  const handleDownloadPDF = async () => {
    setExportBusy('pdf');
    try {
      await generateInventoryReportsPDF({
        settings,
        periodHeading,
        categoryHeading,
        summary,
        items,
        lowStockItems,
        outOfStockItems,
        categorySummary,
        movements,
      });
      addToast('PDF Downloaded', 'Inventory Reports PDF saved successfully!', 'success');
    } catch (err) {
      console.error('Inventory Reports PDF error:', err);
      addToast('PDF Failed', 'Could not generate the inventory report PDF.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const handleExportExcel = async () => {
    setExportBusy('excel');
    try {
      const rows = items.map((m) => ({
        Item: m.name,
        Category: m.category,
        SKU: m.barcode || '-',
        'Current Stock': m.availableStock,
        'Minimum Stock': m.minimumStock,
        Status: m.availableStock === 0 ? 'Out of Stock' : m.availableStock <= m.minimumStock ? 'Low Stock' : 'In Stock',
        'Unit Price (₹)': m.sellingPrice,
        'Stock Value (₹)': m.availableStock * m.sellingPrice,
      }));
      if (rows.length === 0) {
        addToast('No Data', 'Nothing to export for this filter.', 'error');
        return;
      }
      await exportToExcel(rows, `Inventory_Report_${periodHeading.replace(/\s+/g, '_')}`, 'Inventory Reports');
      addToast('Excel Exported', 'Downloaded Inventory Reports spreadsheet!');
    } catch {
      addToast('Export Error', 'Failed to generate Excel export.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const goToInventory = (itemId?: string) => {
    navigateTo('inventory');
    router.push(itemId ? `/?item=${itemId}` : '/');
  };

  const summaryCards = [
    { label: 'Total Items', value: String(summary.totalItems), icon: Package, iconWrap: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600', valueText: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Total Stock Qty', value: String(summary.totalStockQty), icon: Layers, iconWrap: 'bg-blue-50 dark:bg-blue-950 text-blue-600', valueText: 'text-blue-600 dark:text-blue-400' },
    { label: 'Low Stock', value: String(summary.lowStockCount), icon: AlertTriangle, iconWrap: 'bg-amber-50 dark:bg-amber-950 text-amber-600', valueText: 'text-amber-600 dark:text-amber-400' },
    { label: 'Out of Stock', value: String(summary.outOfStockCount), icon: XCircle, iconWrap: 'bg-rose-50 dark:bg-rose-950 text-rose-600', valueText: 'text-rose-600 dark:text-rose-400' },
    { label: 'Stock In', value: String(summary.stockIn), icon: ArrowDownCircle, iconWrap: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600', valueText: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Stock Out', value: String(summary.stockOut), icon: ArrowUpCircle, iconWrap: 'bg-purple-50 dark:bg-purple-950 text-purple-600', valueText: 'text-purple-600 dark:text-purple-400' },
    { label: 'Inventory Value', value: money(summary.inventoryValue), icon: IndianRupee, iconWrap: 'bg-teal-50 dark:bg-teal-950 text-teal-600', valueText: 'text-teal-600 dark:text-teal-400' },
  ];

  const stockByCategoryChart = categorySummary.filter((c) => c.totalProducts > 0).map((c) => ({ name: c.category, Quantity: c.availableQty }));
  const lowStockByCategoryChart = categorySummary.filter((c) => c.lowStock > 0).map((c) => ({ name: c.category, 'Low Stock': c.lowStock }));
  const stockInOutChart = [{ name: periodHeading, 'Stock In': summary.stockIn, 'Stock Out': summary.stockOut }];

  const inventoryValueRows = [...items].sort((a, b) => b.availableStock * b.sellingPrice - a.availableStock * a.sellingPrice);
  const movementTotals = useMemo(() => buildMovementTotals(movements), [movements]);

  return (
    <motion.div
      id="inventory-reports-page"
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
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Inventory Reports</h1>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Track stock, movement, low-stock items and inventory value — {periodHeading}
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
              <span>Export Report</span>
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
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500" />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500" />
            </>
          )}
        </div>

        {/* Category filter + search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c === 'Frames' && FRAME_FAMILY.includes(category) ? category : c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  (c === 'Frames' ? FRAME_FAMILY.includes(category) : category === c)
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search inventory..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Frame sub-type toggle — only shown once the Frames chip (which
            covers both Frame sub-types) is active, mirroring Add Stock's
            own Regular Frame / Reading Glass grouping exactly. */}
        {FRAME_FAMILY.includes(category) && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Frame Type</span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
              {(['Frames', 'Reading Glasses'] as const).map((sub) => (
                <button
                  key={sub}
                  onClick={() => setCategory(sub)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    category === sub
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  {sub === 'Frames' ? 'Regular Frame' : 'Reading Glass'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isError ? (
        <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 flex flex-col items-center justify-center gap-3 text-center">
          <AlertTriangle className="w-10 h-10 text-rose-500" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Unable to load inventory data</p>
          <button onClick={() => refetch()} className="mt-1 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95">
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* SUMMARY CARDS */}
          <div className="print:hidden grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3.5">
            {isLoading
              ? [...Array(7)].map((_, i) => <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800/60 rounded-2xl animate-pulse" />)
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

          {/* CHARTS */}
          <div className="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Stock by Category</h3>
              {stockByCategoryChart.length === 0 ? (
                <EmptySection label="No stock data available." />
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stockByCategoryChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3341551a" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="Quantity" fill="#6366f1" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Stock In vs Stock Out</h3>
              {summary.stockIn === 0 && summary.stockOut === 0 ? (
                <EmptySection label="No stock movement found for this period." />
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stockInOutChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3341551a" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 700 }} />
                      <Bar dataKey="Stock In" fill="#10b981" radius={[8, 8, 0, 0]} />
                      <Bar dataKey="Stock Out" fill="#ef4444" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">Low Stock by Category</h3>
              {lowStockByCategoryChart.length === 0 ? (
                <EmptySection label="No low-stock items." />
              ) : (
                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lowStockByCategoryChart}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#3341551a" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="Low Stock" fill="#f59e0b" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* STOCK STATUS */}
          <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Stock Status</h3>
            {isLoading ? (
              <div className="space-y-2 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}</div>
            ) : items.length === 0 ? (
              <EmptySection label="No inventory items found." />
            ) : (
              <div className="max-h-[480px] overflow-y-auto">
                <StockInventoryTable items={items} showStockValue onRowClick={(m) => goToInventory(m.id)} emptyLabel="No inventory items found." />
              </div>
            )}
          </div>

          {/* CATEGORY-WISE REPORT */}
          <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Category-wise Report</h3>
            <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Total Products</th>
                    <th className="p-3 text-right">Stock Added</th>
                    <th className="p-3 text-right">In Stock</th>
                    <th className="p-3 text-right">Remaining Qty</th>
                    <th className="p-3 text-right">Low Stock</th>
                    <th className="p-3 text-right">Out of Stock</th>
                    <th className="p-3 text-right">Stock Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                  {categorySummary.map((c) => (
                    <tr key={c.category}>
                      <td className="p-3 font-black text-slate-800 dark:text-slate-100">{c.category}</td>
                      <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{c.totalProducts}</td>
                      <td className="p-3 text-right font-mono text-emerald-600">{c.stockAdded}</td>
                      <td className="p-3 text-right font-mono text-indigo-600">{c.inStockCount}</td>
                      <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{c.availableQty}</td>
                      <td className="p-3 text-right font-mono text-amber-600">{c.lowStock}</td>
                      <td className="p-3 text-right font-mono text-rose-600">{c.outOfStock}</td>
                      <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{money(c.stockValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="print:hidden grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* LOW STOCK REPORT */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Low Stock Report</h3>
              {lowStockItems.length === 0 ? (
                <EmptySection label="No low-stock items." />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                        <th className="p-3">Item</th>
                        <th className="p-3 text-right">Current</th>
                        <th className="p-3 text-right">Min</th>
                        <th className="p-3 text-right">Shortage</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                      {lowStockItems.map((m) => (
                        <tr key={m.id}>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{m.name}<span className="block text-[10px] text-slate-400 font-semibold">{m.category}</span></td>
                          <td className="p-3 text-right font-mono text-amber-600 font-bold">{m.availableStock}</td>
                          <td className="p-3 text-right font-mono text-slate-500">{m.minimumStock}</td>
                          <td className="p-3 text-right font-mono font-black text-rose-600">{Math.max(0, m.minimumStock - m.availableStock)}</td>
                          <td className="p-3 text-right">
                            <button onClick={() => goToInventory(m.id)} className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline ml-auto">
                              <Eye className="w-3 h-3" /> View Item
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* OUT OF STOCK REPORT */}
            <div className="p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Out of Stock Report</h3>
              {outOfStockItems.length === 0 ? (
                <EmptySection label="No out-of-stock items." />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                        <th className="p-3">Item</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3 text-right">Last Known Price</th>
                        <th className="p-3 text-right">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                      {outOfStockItems.map((m) => (
                        <tr key={m.id}>
                          <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{m.name}<span className="block text-[10px] text-slate-400 font-semibold">{m.category}</span></td>
                          <td className="p-3 font-mono text-slate-500">{m.barcode || '-'}</td>
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{money(m.sellingPrice)}</td>
                          <td className="p-3 text-right font-mono font-black text-rose-600">0</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* INVENTORY VALUE */}
          <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
            <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Inventory Value</h3>
            {inventoryValueRows.length === 0 ? (
              <EmptySection label="No inventory items found." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80 max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100/95 dark:bg-slate-950/95 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                      <th className="p-3">Item</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-right">Quantity</th>
                      <th className="p-3 text-right">Unit Value</th>
                      <th className="p-3 text-right">Total Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {inventoryValueRows.map((m) => (
                      <tr key={m.id}>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{m.name}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{m.category}</td>
                        <td className="p-3 text-right font-mono">{m.availableStock}</td>
                        <td className="p-3 text-right font-mono">{money(m.sellingPrice)}</td>
                        <td className="p-3 text-right font-mono font-black text-teal-600">{money(m.availableStock * m.sellingPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100/90 dark:bg-slate-950/90 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
                      <td className="p-3" colSpan={4}>TOTAL INVENTORY VALUE</td>
                      <td className="p-3 text-right font-mono">{money(summary.inventoryValue)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* STOCK MOVEMENT */}
          <div className="print:hidden p-6 backdrop-blur-xl bg-white/70 dark:bg-slate-900/60 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">Stock Movement</h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                Stock In {summary.stockIn} units • Stock Out {summary.stockOut} units, for {periodHeading}
              </p>
            </div>
            {movements.length === 0 ? (
              <EmptySection label="No stock movement found for this period." />
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80 max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-slate-100/95 dark:bg-slate-950/95 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
                      <th className="p-3">Date</th>
                      <th className="p-3">Item</th>
                      <th className="p-3">Category</th>
                      <th className="p-3 text-center">Type</th>
                      <th className="p-3 text-right">Quantity</th>
                      <th className="p-3">Reason</th>
                      <th className="p-3">Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                    {movements.map((m) => (
                      <tr key={m.id}>
                        <td className="p-3 text-slate-600 dark:text-slate-300 font-semibold">{formatDate(m.date)}</td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-100">{m.itemName}</td>
                        <td className="p-3 text-slate-500">{m.category}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 font-black rounded-full text-[10px] border ${m.movementType === 'Stock In' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900' : 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'}`}>
                            {m.movementType}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">{m.quantity}</td>
                        <td className="p-3 text-slate-500">{m.reason || '-'}</td>
                        <td className="p-3 font-mono text-slate-500">{m.reference || '-'}</td>
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
      {!isError && (
        <div id="printable-inventory-reports" className="hidden print:block">
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
              <h3 className="text-base font-black tracking-wide">INVENTORY REPORTS</h3>
              <p className="text-xs text-slate-600 mt-0.5">Period: {periodHeading}</p>
              <p className="text-xs text-slate-600">Category: {categoryHeading}</p>
            </div>
          </div>

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Summary</h4>
            <div className="grid grid-cols-7 gap-2 text-center text-[9px] border-2 border-slate-900 p-3">
              <div><p className="text-slate-500">Items</p><p className="font-black text-sm mt-0.5">{summary.totalItems}</p></div>
              <div><p className="text-slate-500">Stock Qty</p><p className="font-black text-sm mt-0.5">{summary.totalStockQty}</p></div>
              <div><p className="text-slate-500">Low Stock</p><p className="font-black text-sm mt-0.5">{summary.lowStockCount}</p></div>
              <div><p className="text-slate-500">Out of Stock</p><p className="font-black text-sm mt-0.5">{summary.outOfStockCount}</p></div>
              <div><p className="text-slate-500">Stock In</p><p className="font-black text-sm mt-0.5">{summary.stockIn}</p></div>
              <div><p className="text-slate-500">Stock Out</p><p className="font-black text-sm mt-0.5">{summary.stockOut}</p></div>
              <div><p className="text-slate-500">Value</p><p className="font-black text-sm mt-0.5">{money(summary.inventoryValue)}</p></div>
            </div>
          </div>

          <div className="mb-4">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Inventory Detail</h4>
            <table className="w-full text-[8.5px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-1 text-center font-bold">#</th>
                  <th className="p-1 text-left font-bold">Category</th>
                  <th className="p-1 text-left font-bold">Item</th>
                  <th className="p-1 text-left font-bold">Code</th>
                  <th className="p-1 text-left font-bold">Brand</th>
                  <th className="p-1 text-left font-bold">Type / Spec</th>
                  <th className="p-1 text-right font-bold">Stock</th>
                  <th className="p-1 text-right font-bold">Added</th>
                  <th className="p-1 text-right font-bold">Sold</th>
                  <th className="p-1 text-right font-bold">Unit Price</th>
                  <th className="p-1 text-right font-bold">Value</th>
                  <th className="p-1 text-left font-bold">Supplier</th>
                  <th className="p-1 text-center font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={13} className="p-4 text-center text-slate-500 italic">No inventory items found.</td></tr>
                ) : (
                  items.map((m, idx) => {
                    const mv = movementTotals.get(m.id);
                    return (
                      <tr key={m.id} className="border-b border-slate-200">
                        <td className="p-1 text-center">{idx + 1}</td>
                        <td className="p-1">{categoryLabel(m)}</td>
                        <td className="p-1 font-bold">{m.name}</td>
                        <td className="p-1 font-mono">{codeFor(m)}</td>
                        <td className="p-1">{m.brand || '-'}</td>
                        <td className="p-1">{typeSpecFor(m)}</td>
                        <td className="p-1 text-right font-bold">{m.availableStock}</td>
                        <td className="p-1 text-right">{mv?.added ? `+${mv.added}` : '-'}</td>
                        <td className="p-1 text-right">{mv?.sold ? `-${mv.sold}` : '-'}</td>
                        <td className="p-1 text-right">{money(m.sellingPrice)}</td>
                        <td className="p-1 text-right font-bold">{money(m.availableStock * m.sellingPrice)}</td>
                        <td className="p-1">{m.supplier || '-'}</td>
                        <td className="p-1 text-center">{stockStatusLabel(m)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Category-wise Report</h4>
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-1 text-left font-bold">Category</th>
                  <th className="p-1 text-right font-bold">Products</th>
                  <th className="p-1 text-right font-bold">Available Qty</th>
                  <th className="p-1 text-right font-bold">Low Stock</th>
                  <th className="p-1 text-right font-bold">Out of Stock</th>
                  <th className="p-1 text-right font-bold">Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {categorySummary.map((c) => (
                  <tr key={c.category} className="border-b border-slate-200">
                    <td className="p-1">{c.category}</td>
                    <td className="p-1 text-right">{c.totalProducts}</td>
                    <td className="p-1 text-right">{c.availableQty}</td>
                    <td className="p-1 text-right">{c.lowStock}</td>
                    <td className="p-1 text-right">{c.outOfStock}</td>
                    <td className="p-1 text-right">{money(c.stockValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Low Stock Report</h4>
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-1 text-left font-bold">Item</th>
                  <th className="p-1 text-left font-bold">Category</th>
                  <th className="p-1 text-left font-bold">Brand</th>
                  <th className="p-1 text-left font-bold">Code</th>
                  <th className="p-1 text-right font-bold">Current</th>
                  <th className="p-1 text-right font-bold">Minimum</th>
                  <th className="p-1 text-right font-bold">Shortage</th>
                  <th className="p-1 text-left font-bold">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.length === 0 ? (
                  <tr><td colSpan={8} className="p-3 text-center text-slate-500 italic">No low-stock items.</td></tr>
                ) : (
                  lowStockItems.map((m) => (
                    <tr key={m.id} className="border-b border-slate-200">
                      <td className="p-1 font-bold">{m.name}</td>
                      <td className="p-1">{categoryLabel(m)}</td>
                      <td className="p-1">{m.brand || '-'}</td>
                      <td className="p-1 font-mono">{codeFor(m)}</td>
                      <td className="p-1 text-right">{m.availableStock}</td>
                      <td className="p-1 text-right">{m.minimumStock}</td>
                      <td className="p-1 text-right">{Math.max(0, m.minimumStock - m.availableStock)}</td>
                      <td className="p-1">{m.supplier || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mb-4 break-inside-avoid">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Out of Stock Report</h4>
            <table className="w-full text-[9px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-1 text-left font-bold">Item</th>
                  <th className="p-1 text-left font-bold">Category</th>
                  <th className="p-1 text-left font-bold">Brand</th>
                  <th className="p-1 text-left font-bold">Code</th>
                  <th className="p-1 text-right font-bold">Last Known Price</th>
                  <th className="p-1 text-left font-bold">Supplier</th>
                </tr>
              </thead>
              <tbody>
                {outOfStockItems.length === 0 ? (
                  <tr><td colSpan={6} className="p-3 text-center text-slate-500 italic">No out-of-stock items.</td></tr>
                ) : (
                  outOfStockItems.map((m) => (
                    <tr key={m.id} className="border-b border-slate-200">
                      <td className="p-1 font-bold">{m.name}</td>
                      <td className="p-1">{categoryLabel(m)}</td>
                      <td className="p-1">{m.brand || '-'}</td>
                      <td className="p-1 font-mono">{codeFor(m)}</td>
                      <td className="p-1 text-right">{money(m.sellingPrice)}</td>
                      <td className="p-1">{m.supplier || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mb-4">
            <h4 className="font-black text-xs uppercase tracking-wide mb-2">Stock Movement</h4>
            <table className="w-full text-[8.5px] border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="p-1 text-left font-bold">Date</th>
                  <th className="p-1 text-left font-bold">Item</th>
                  <th className="p-1 text-left font-bold">Category</th>
                  <th className="p-1 text-center font-bold">Type</th>
                  <th className="p-1 text-right font-bold">Qty</th>
                  <th className="p-1 text-left font-bold">Reason</th>
                  <th className="p-1 text-left font-bold">Reference</th>
                </tr>
              </thead>
              <tbody>
                {movements.length === 0 ? (
                  <tr><td colSpan={7} className="p-3 text-center text-slate-500 italic">No stock movement found for this period.</td></tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="border-b border-slate-200">
                      <td className="p-1">{formatDate(m.date)}</td>
                      <td className="p-1 font-bold">{m.itemName}</td>
                      <td className="p-1">{m.category}</td>
                      <td className="p-1 text-center">{m.movementType}</td>
                      <td className="p-1 text-right">{m.quantity}</td>
                      <td className="p-1">{m.reason || '-'}</td>
                      <td className="p-1 font-mono">{m.reference || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 pt-2 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
            <span>{settings.clinicName || 'Royal Opticals'}</span>
            <span>Computer Generated Report</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
