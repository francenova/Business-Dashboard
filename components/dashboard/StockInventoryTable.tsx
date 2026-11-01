'use client';

import React from 'react';
import { Medicine } from '@/lib/types';
import { AlertCircle, AlertTriangle, Pill } from 'lucide-react';
import { InventoryTrackingInfo } from '@/hooks/useInventoryTracking';

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PLAIN_MEDICINE_CATEGORIES = new Set(['Eye Drops', 'Tablets', 'Ointment', 'Capsules']);

// Same "90% common" idea as StockTransactionTable, applied to *current
// stock* instead of purchase history: one column set for every category.
// "Code" is the barcode for Frame/Lens/Solution/Contact Lens/Reading Glass,
// or the batch number for plain medicines (which have no barcode field).
// "Specification" is the stored specification string for the optical
// categories (already composed by Add Stock), or a Category + Rack + Expiry
// summary computed on the fly for plain medicines (whose `specification`
// column is never populated, since Batch/Rack/Expiry already cover that
// ground on the medicines table itself).
function codeFor(m: Medicine): string {
  if (PLAIN_MEDICINE_CATEGORIES.has(m.category)) return m.batchNumber || '-';
  return m.barcode || '-';
}

function specificationFor(m: Medicine): string {
  if (PLAIN_MEDICINE_CATEGORIES.has(m.category)) {
    return [m.category, m.rackNumber ? `Rack ${m.rackNumber}` : '', m.expiryDate ? `Exp ${m.expiryDate}` : '']
      .filter(Boolean)
      .join(' • ');
  }
  return m.specification || '-';
}

// Same idea as StockTransactionTable's categoryDisplay — main product type,
// with a small secondary line for Frame's two sub-types (plain text, not a
// control) and for a plain medicine's specific sub-category.
function categoryDisplay(m: Medicine): { main: string; secondary?: string } {
  if (m.category === 'Frame') return { main: 'Frame', secondary: 'Regular Frame' };
  if (m.category === 'Reading Glass') return { main: 'Frame', secondary: 'Reading Glass' };
  if (PLAIN_MEDICINE_CATEGORIES.has(m.category)) return { main: 'Medicine', secondary: m.category };
  return { main: m.category };
}

function stockStatus(m: Medicine): 'Out of Stock' | 'Low Stock' | 'In Stock' {
  if (m.availableStock === 0) return 'Out of Stock';
  if (m.availableStock <= m.minimumStock) return 'Low Stock';
  return 'In Stock';
}

const StatusBadge: React.FC<{ status: ReturnType<typeof stockStatus> }> = ({ status }) => {
  if (status === 'Out of Stock') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 font-bold text-[11px] flex items-center gap-1 w-max">
        <AlertCircle className="w-3 h-3" /> Out of Stock
      </span>
    );
  }
  if (status === 'Low Stock') {
    return (
      <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold text-[11px] flex items-center gap-1 w-max">
        <AlertTriangle className="w-3 h-3" /> Low Stock
      </span>
    );
  }
  return <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[11px] w-max">In Stock</span>;
};

export const StockInventoryTable: React.FC<{
  items: Medicine[];
  showStockValue?: boolean;
  onRowClick?: (m: Medicine) => void;
  renderActions?: (m: Medicine) => React.ReactNode;
  emptyLabel?: string;
  // Optional "Last Restocked" / "Total Sold" columns, computed all-time from
  // stock_movements (see hooks/useInventoryTracking.ts) — opt-in so existing
  // callers (Inventory Report, Supplier Details) render unchanged.
  tracking?: Record<string, InventoryTrackingInfo>;
  showTrackingColumns?: boolean;
}> = ({
  items,
  showStockValue = false,
  onRowClick,
  renderActions,
  emptyLabel = 'No matching items in inventory',
  tracking,
  showTrackingColumns = false,
}) => {
  const colCount = 10 + (showStockValue ? 1 : 0) + (showTrackingColumns ? 2 : 0) + (renderActions ? 1 : 0);
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800/80">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 uppercase text-[10px] font-bold tracking-wider border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="py-3.5 px-4">Product Name</th>
            <th className="py-3.5 px-4">Category</th>
            <th className="py-3.5 px-4">Brand</th>
            <th className="py-3.5 px-4">Code</th>
            <th className="py-3.5 px-4">Specification</th>
            <th className="py-3.5 px-4 text-right">Available Stock</th>
            <th className="py-3.5 px-4">Status</th>
            <th className="py-3.5 px-4 text-right">Purchase Price</th>
            <th className="py-3.5 px-4 text-right">Selling Price</th>
            {showStockValue && <th className="py-3.5 px-4 text-right">Stock Value</th>}
            <th className="py-3.5 px-4">Supplier</th>
            {showTrackingColumns && <th className="py-3.5 px-4">Last Restocked</th>}
            {showTrackingColumns && <th className="py-3.5 px-4 text-right">Total Sold</th>}
            {renderActions && <th className="py-3.5 px-4 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.length === 0 ? (
            <tr>
              <td colSpan={colCount} className="py-12 text-center text-slate-400">
                <Pill className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">{emptyLabel}</p>
              </td>
            </tr>
          ) : (
            items.map((m) => {
              const status = stockStatus(m);
              const cat = categoryDisplay(m);
              return (
                <tr
                  key={m.id}
                  onClick={onRowClick ? () => onRowClick(m) : undefined}
                  className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/40 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                >
                  <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">{m.name}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-slate-800 dark:text-slate-100">{cat.main}</div>
                    {cat.secondary && <div className="text-[10px] text-slate-400 font-semibold">{cat.secondary}</div>}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{m.brand || '-'}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-500">{codeFor(m)}</td>
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-[14rem] truncate" title={specificationFor(m)}>{specificationFor(m)}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800 dark:text-slate-100">{m.availableStock}</td>
                  <td className="py-3.5 px-4"><StatusBadge status={status} /></td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-500">₹{m.purchasePrice.toLocaleString('en-IN')}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">₹{m.sellingPrice.toLocaleString('en-IN')}</td>
                  {showStockValue && (
                    <td className="py-3.5 px-4 text-right font-mono font-black text-teal-600 dark:text-teal-400">
                      ₹{(m.availableStock * m.sellingPrice).toLocaleString('en-IN')}
                    </td>
                  )}
                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">{m.supplier || '-'}</td>
                  {showTrackingColumns && (
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      {tracking?.[m.id]?.lastRestockedAt ? formatDate(tracking[m.id].lastRestockedAt!) : '-'}
                    </td>
                  )}
                  {showTrackingColumns && (
                    <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-700 dark:text-slate-200">
                      {tracking?.[m.id]?.totalSold ?? 0}
                    </td>
                  )}
                  {renderActions && (
                    <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">{renderActions(m)}</div>
                    </td>
                  )}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};
