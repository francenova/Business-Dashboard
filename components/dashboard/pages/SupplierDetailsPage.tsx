'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupplierDetails } from '@/hooks/useSupplierDetails';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/formatDate';
import { exportToExcel } from '@/lib/excelExport';
import { generateSupplierDetailsPDF } from '@/lib/supplierDetailsPdf';
import { StockInventoryTable } from '@/components/dashboard/StockInventoryTable';
import { StockTransactionTable } from '@/components/dashboard/StockTransactionTable';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Building2,
  Phone,
  MapPin,
  ReceiptText,
  Landmark,
  Printer,
  Download,
  FileSpreadsheet,
  Loader2,
  Boxes,
  Receipt,
  IndianRupee,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  ShieldOff,
} from 'lucide-react';

const money = (n?: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export const SupplierDetailsPage: React.FC<{ id: string }> = ({ id }) => {
  const router = useRouter();
  const { settings, addToast } = useApp();
  const { data, isLoading, isError } = useSupplierDetails(id);
  const [exportBusy, setExportBusy] = useState<'print' | 'pdf' | 'excel' | null>(null);
  const [showPrintable, setShowPrintable] = useState(false);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
        <p>Loading supplier details...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>Supplier not found or error loading.</p>
        <button onClick={() => router.push('/expenses')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold">
          Back to Expense Management
        </button>
      </div>
    );
  }

  const { supplier, products, transactions, paymentStatus } = data;

  const handlePrint = async () => {
    setExportBusy('print');
    try {
      setShowPrintable(true);
      await new Promise((resolve) => setTimeout(resolve, 60));
      window.print();
    } finally {
      setExportBusy(null);
    }
  };

  const handleDownloadPDF = async () => {
    setExportBusy('pdf');
    try {
      await generateSupplierDetailsPDF({ settings, supplier, products, transactions, paymentStatus });
      addToast('PDF Downloaded', 'Supplier statement PDF saved successfully!', 'success');
    } catch (err) {
      console.error('Supplier details PDF error:', err);
      addToast('PDF Failed', 'Could not generate the supplier statement PDF.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const handleExportExcel = async () => {
    setExportBusy('excel');
    try {
      const exportRows = transactions.map((t) => {
        const paid = t.paidAmount ?? t.amount;
        return {
          Date: formatDate(t.date),
          'Expense ID': t.displayId || '-',
          Category: t.category,
          Description: t.description || '-',
          Reference: t.referenceNumber || '-',
          'Amount (₹)': t.amount,
          'Paid (₹)': paid,
          'Balance (₹)': t.amount - paid,
        };
      });
      if (exportRows.length === 0) {
        addToast('No Data', 'No transactions found for this supplier.', 'error');
        return;
      }
      await exportToExcel(exportRows, `Supplier_${supplier.name.replace(/\s+/g, '_')}_Transactions`, 'Transactions');
      addToast('Excel Exported', 'Downloaded supplier transaction spreadsheet!');
    } catch {
      addToast('Export Error', 'Failed to generate Excel export.', 'error');
    } finally {
      setExportBusy(null);
    }
  };

  const statCards = [
    { label: 'Total Purchased', value: money(paymentStatus.totalPurchased), icon: IndianRupee, iconWrap: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600', valueText: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Total Paid', value: money(paymentStatus.totalPaid), icon: Wallet, iconWrap: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600', valueText: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Outstanding (Payable)', value: money(paymentStatus.outstanding), icon: AlertTriangle, iconWrap: 'bg-amber-50 dark:bg-amber-950 text-amber-600', valueText: 'text-amber-600 dark:text-amber-400' },
    { label: 'Advance Paid', value: money(paymentStatus.advance), icon: CheckCircle2, iconWrap: 'bg-teal-50 dark:bg-teal-950 text-teal-600', valueText: 'text-teal-600 dark:text-teal-400' },
  ];

  return (
    <motion.div
      id="supplier-details-page"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto"
    >
      {/* Top bar */}
      <div className="print:hidden flex items-center justify-between gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700/80 rounded-xl transition-all active:scale-95 shadow-2xs"
        >
          <ArrowLeft className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span>Back</span>
        </button>

        <div className="flex items-center gap-2">
          <button onClick={handlePrint} disabled={exportBusy !== null} className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50">
            {exportBusy === 'print' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            <span>Print</span>
          </button>
          <button onClick={handleDownloadPDF} disabled={exportBusy !== null} className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50">
            {exportBusy === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            <span>PDF</span>
          </button>
          <button onClick={handleExportExcel} disabled={exportBusy !== null} className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all active:scale-95 disabled:opacity-50">
            {exportBusy === 'excel' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Header card */}
      <div className="print:hidden bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-lg shadow-slate-200/30 dark:shadow-none overflow-hidden">
        {/* Identity strip */}
        <div className="p-6 flex items-center gap-4 bg-gradient-to-r from-rose-50 via-orange-50 to-amber-50 dark:from-rose-950/30 dark:via-orange-950/20 dark:to-amber-950/20 border-b border-slate-200/80 dark:border-slate-700/80">
          <div className="w-14 h-14 shrink-0 flex items-center justify-center bg-gradient-to-tr from-rose-600 via-orange-500 to-amber-500 text-white rounded-2xl shadow-md shadow-orange-500/20 text-lg font-black">
            {supplier.name
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((w) => w[0]?.toUpperCase())
              .join('') || <Building2 className="w-6 h-6" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">{supplier.name}</h1>
              {supplier.isActive === false && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-full shrink-0">
                  <ShieldOff className="w-3 h-3" /> Deleted
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Supplier since {supplier.createdAt ? formatDate(supplier.createdAt) : '-'}</p>
          </div>
        </div>

        {/* Labeled detail fields */}
        <div className="p-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Phone className="w-3 h-3" /> Phone Number
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{supplier.phone || '—'}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <MapPin className="w-3 h-3" /> Address
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">{supplier.address || '—'}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <ReceiptText className="w-3 h-3" /> GSTIN / GST ID
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 font-mono">{supplier.gstin || '—'}</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              <Landmark className="w-3 h-3" /> State / Location
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
              {supplier.state || '—'}
              {supplier.stateCode && <span className="ml-1.5 text-xs font-mono text-slate-400">({supplier.stateCode})</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Payment status */}
      <div className="print:hidden grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {statCards.map((card) => {
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

      {/* Stock / Products supplied */}
      <div className="print:hidden p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Boxes className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          Stock / Products Supplied
        </h3>
        <StockInventoryTable items={products} emptyLabel="No stock currently on file from this supplier." />
      </div>

      {/* Transaction history */}
      <div className="print:hidden p-6 bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-lg shadow-slate-200/30 dark:shadow-none space-y-4">
        <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Receipt className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          Transaction History
        </h3>
        <StockTransactionTable rows={transactions} emptyLabel="No transactions found for this supplier." />
      </div>

      {/* PRINTABLE DOCUMENT */}
      {showPrintable && (
        <div id="printable-supplier-details" className="hidden print:block">
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
              <h3 className="text-base font-black tracking-wide">SUPPLIER STATEMENT</h3>
              <p className="text-xs text-slate-600 mt-0.5">{supplier.name}</p>
              <p className="text-xs text-slate-600">Generated: {formatDate(new Date().toISOString())}</p>
            </div>
          </div>

          <div className="mb-4 border-2 border-slate-900 p-3 grid grid-cols-4 gap-2 text-[10px]">
            <div><span className="text-slate-600">Total Purchased: </span><span className="font-bold">{money(paymentStatus.totalPurchased)}</span></div>
            <div><span className="text-slate-600">Total Paid: </span><span className="font-bold">{money(paymentStatus.totalPaid)}</span></div>
            <div><span className="text-slate-600">Outstanding: </span><span className="font-bold">{money(paymentStatus.outstanding)}</span></div>
            <div><span className="text-slate-600">Advance: </span><span className="font-bold">{money(paymentStatus.advance)}</span></div>
          </div>

          <h4 className="font-black text-xs uppercase tracking-wide mb-2">Stock / Products Supplied</h4>
          <table className="w-full text-[9px] border-collapse mb-4">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-1 text-left font-bold">Product</th>
                <th className="p-1 text-left font-bold">Brand</th>
                <th className="p-1 text-left font-bold">Category</th>
                <th className="p-1 text-right font-bold">Stock</th>
                <th className="p-1 text-right font-bold">Purchase</th>
                <th className="p-1 text-right font-bold">Selling</th>
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-500 italic">No stock currently on file from this supplier.</td></tr>
              ) : (
                products.map((m) => (
                  <tr key={m.id} className="border-b border-slate-200">
                    <td className="p-1">{m.name}</td>
                    <td className="p-1">{m.brand}</td>
                    <td className="p-1">{m.category}</td>
                    <td className="p-1 text-right">{m.availableStock}</td>
                    <td className="p-1 text-right">{money(m.purchasePrice)}</td>
                    <td className="p-1 text-right">{money(m.sellingPrice)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <h4 className="font-black text-xs uppercase tracking-wide mb-2">Transaction History</h4>
          <table className="w-full text-[9px] border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-1 text-left font-bold">Date</th>
                <th className="p-1 text-left font-bold">Expense ID</th>
                <th className="p-1 text-left font-bold">Category</th>
                <th className="p-1 text-left font-bold">Description</th>
                <th className="p-1 text-left font-bold">Reference</th>
                <th className="p-1 text-right font-bold">Amount</th>
                <th className="p-1 text-right font-bold">Paid</th>
                <th className="p-1 text-right font-bold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr><td colSpan={8} className="p-4 text-center text-slate-500 italic">No transactions found for this supplier.</td></tr>
              ) : (
                transactions.map((t) => {
                  const paid = t.paidAmount ?? t.amount;
                  return (
                    <tr key={t.id} className="border-b border-slate-200">
                      <td className="p-1">{formatDate(t.date)}</td>
                      <td className="p-1 font-mono">{t.displayId || '-'}</td>
                      <td className="p-1">{t.category}</td>
                      <td className="p-1">{t.description || '-'}</td>
                      <td className="p-1">{t.referenceNumber || '-'}</td>
                      <td className="p-1 text-right">{money(t.amount)}</td>
                      <td className="p-1 text-right">{money(paid)}</td>
                      <td className="p-1 text-right">{money(t.amount - paid)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          <div className="mt-4 pt-2 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
            <span>{settings.clinicName || 'Royal Opticals'}</span>
            <span>Computer Generated Statement</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
