'use client';

import React from 'react';
import { Expense, ExpenseCategory } from '@/lib/types';
import { formatDate } from '@/lib/formatDate';
import { Edit2, Trash2, Inbox } from 'lucide-react';

const money = (n?: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

// Category shows the main product type, with a small secondary line for
// Frame's two sub-types (plain text, never a control — Regular Frame vs
// Reading Glass is just informational here, selecting between them only
// happens in Add Stock/Patient Visit). Medicine rows get the same treatment
// using the sub-category Add Stock already saved into productDetails.specification.
function categoryDisplay(category: ExpenseCategory, specification?: string): { main: string; secondary?: string } {
  if (category === 'Frame') return { main: 'Frame', secondary: 'Regular Frame' };
  if (category === 'Reading Glass') return { main: 'Frame', secondary: 'Reading Glass' };
  if (category === 'Medical / Clinic Supplies') return { main: 'Medicine', secondary: specification?.split(' • ')[0] };
  return { main: category };
}

// Same Total/Paid/Pending convention already used everywhere else money
// changes hands in this app (TSR's Total/Advance/Pending, Ledger's
// debit/credit) — Paid is exactly the "Payment Made Now" value captured in
// Add Stock (undefined means fully paid, the default for a plain expense).
function paymentBreakdown(amount: number, paidAmount?: number) {
  const paid = paidAmount ?? amount;
  const pending = Math.max(0, amount - paid);
  return { paid, pending };
}

const StatusBadge: React.FC<{ pending: number }> = ({ pending }) =>
  pending <= 0 ? (
    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">Paid</span>
  ) : (
    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900">Partial</span>
  );

// The "90% common" unified table — same 13 columns for every expense row,
// stock purchase or plain expense alike, so there's exactly one table
// structure across all of Expense Management regardless of which category
// filter is active. Rows with productDetails (Add Stock purchases) show
// real Brand/Code/Specification/Qty/Selling Price; plain expenses (Rent,
// Electricity, a manual "+ Add Expense" entry) fall back to their
// description in the Product Name column and "–" for the product-only
// cells — nothing is hidden, the shape never changes.
// "Code" shows the item's barcode/SKU for everything except Medicine
// (where it shows the batch number instead — Medicine has no barcode
// field), and "Specification" shows whatever compact descriptor Add Stock
// composed for that category (Frame Type, Lens Type + coatings, Pack Size,
// Power/BC/DIA, or Medicine's Category + Rack + Expiry).
export const StockTransactionTable: React.FC<{
  rows: Expense[];
  codeLabel?: string;
  onEdit?: (exp: Expense) => void;
  onDelete?: (exp: Expense) => void;
  emptyLabel?: string;
}> = ({ rows, codeLabel = 'Code', onEdit, onDelete, emptyLabel = 'No expense records were found for this period and category.' }) => {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700" />
        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">No Records Found</p>
        <p className="text-xs text-slate-400 max-w-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
      <table className="w-full text-xs text-left border-collapse">
        <thead>
          <tr className="bg-slate-100/90 dark:bg-slate-950/90 text-slate-600 dark:text-slate-400 uppercase font-black tracking-wider border-b border-slate-200/80 dark:border-slate-800/80">
            <th className="p-3">Date</th>
            <th className="p-3">Expense ID</th>
            <th className="p-3">Category</th>
            <th className="p-3">Product Name</th>
            <th className="p-3">Brand</th>
            <th className="p-3">{codeLabel}</th>
            <th className="p-3">Specification</th>
            <th className="p-3 text-right">Qty</th>
            <th className="p-3 text-right">Purchase Price</th>
            <th className="p-3 text-right">Selling Price</th>
            <th className="p-3">Supplier</th>
            <th className="p-3">Reference</th>
            <th className="p-3 text-right">Total</th>
            <th className="p-3 text-right">Paid</th>
            <th className="p-3 text-right">Pending</th>
            {(onEdit || onDelete) && <th className="p-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
          {rows.map((exp) => {
            const d = exp.productDetails;
            const { paid, pending } = paymentBreakdown(exp.amount, exp.paidAmount);
            const cat = categoryDisplay(exp.category, d?.specification);
            return (
              <tr key={exp.id} onClick={onEdit ? () => onEdit(exp) : undefined} className={`hover:bg-indigo-50/40 dark:hover:bg-slate-800/40 transition-colors ${onEdit ? 'cursor-pointer' : ''}`}>
                <td className="p-3 text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">{formatDate(exp.date)}</td>
                <td className="p-3 font-mono font-black text-rose-600 dark:text-rose-400 whitespace-nowrap">{exp.displayId || '-'}</td>
                <td className="p-3">
                  <div className="font-bold text-slate-800 dark:text-slate-100">{cat.main}</div>
                  {cat.secondary && <div className="text-[10px] text-slate-400 font-semibold">{cat.secondary}</div>}
                </td>
                <td className="p-3 font-bold text-slate-900 dark:text-white max-w-[12rem] truncate" title={d?.productName || exp.description}>{d?.productName || exp.description || '-'}</td>
                <td className="p-3 text-slate-600 dark:text-slate-300">{d?.brand || '-'}</td>
                <td className="p-3 font-mono text-slate-500">{d?.code || '-'}</td>
                <td className="p-3 text-slate-600 dark:text-slate-300 max-w-[14rem] truncate" title={d?.specification}>{d?.specification || '-'}</td>
                <td className="p-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100">{d?.quantity ?? '-'}</td>
                <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{d ? money(d.unitPurchasePrice) : money(exp.amount)}</td>
                <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-300">{d ? money(d.unitSellingPrice) : '-'}</td>
                <td className="p-3 text-slate-600 dark:text-slate-300">{exp.vendor || '-'}</td>
                <td className="p-3 font-mono text-slate-500">{exp.referenceNumber || '-'}</td>
                <td className="p-3 text-right font-mono font-black text-slate-900 dark:text-white">{money(exp.amount)}</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">{money(paid)}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <span className={`font-mono font-bold ${pending > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>{money(pending)}</span>
                    <StatusBadge pending={pending} />
                  </div>
                </td>
                {(onEdit || onDelete) && (
                  <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {onEdit && (
                        <button onClick={() => onEdit(exp)} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors" title="Edit">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={() => onDelete(exp)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors" title="Delete">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-100/90 dark:bg-slate-950/90 font-black text-slate-900 dark:text-white border-t-2 border-slate-300 dark:border-slate-700">
            <td className="p-3" colSpan={12}>TOTAL ({rows.length} entr{rows.length === 1 ? 'y' : 'ies'})</td>
            <td className="p-3 text-right font-mono">{money(rows.reduce((s, r) => s + r.amount, 0))}</td>
            <td className="p-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
              {money(rows.reduce((s, r) => s + paymentBreakdown(r.amount, r.paidAmount).paid, 0))}
            </td>
            <td className="p-3 text-right font-mono text-rose-600 dark:text-rose-400">
              {money(rows.reduce((s, r) => s + paymentBreakdown(r.amount, r.paidAmount).pending, 0))}
            </td>
            {(onEdit || onDelete) && <td className="p-3"></td>}
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
