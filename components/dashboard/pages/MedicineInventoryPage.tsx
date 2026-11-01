'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Medicine } from '@/lib/types';
import { ConfirmModal } from '@/components/dashboard/ConfirmModal';
import { StockInventoryTable } from '@/components/dashboard/StockInventoryTable';
import { useInventoryTracking } from '@/hooks/useInventoryTracking';
import { exportToExcel } from '@/lib/excelExport';
import {
  Pill,
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Download,
  MinusCircle,
} from 'lucide-react';

type InventoryCategoryFilter = 'all' | 'Frame' | 'Reading Glass' | 'Lens' | 'Solution' | 'Contact Lens' | 'Medicines';
const INVENTORY_CATEGORIES: InventoryCategoryFilter[] = ['all', 'Frame', 'Reading Glass', 'Lens', 'Solution', 'Contact Lens', 'Medicines'];

// Reading Glass now gets its own bucket (it used to fall into the generic
// 'Medicines' bucket, which buried it next to Eye Drops/Tablets instead of
// showing it clearly as the distinct Frame-card sub-type it actually is).
// 'Medicines' covers every remaining plain-medicine category (Eye Drops/
// Tablets/Ointment/Capsules).
function categoryBucketOf(category: string): Exclude<InventoryCategoryFilter, 'all'> {
  if (category === 'Frame' || category === 'Reading Glass' || category === 'Lens' || category === 'Solution' || category === 'Contact Lens') return category;
  return 'Medicines';
}

export const MedicineInventoryPage: React.FC = () => {
  const { medicines, addMedicine, updateMedicine, deleteMedicine, issueMedicineStock, settings } = useApp();
  const { trackingByItemId } = useInventoryTracking();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const initialCategory = searchParams.get('category') as InventoryCategoryFilter | null;
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategoryFilter>(
    initialCategory && INVENTORY_CATEGORIES.includes(initialCategory) ? initialCategory : 'all'
  );

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [deletingMedId, setDeletingMedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Issue Stock Modal state
  const [issuingMed, setIssuingMed] = useState<Medicine | null>(null);
  const [issueQtyInput, setIssueQtyInput] = useState<string>('1');
  const issueQty = Math.max(0, parseInt(issueQtyInput, 10) || 0);

  const [formData, setFormData] = useState<Omit<Medicine, 'id'>>({
    name: '',
    brand: '',
    category: 'Eye Drops',
    batchNumber: '',
    expiryDate: '2027-12',
    purchasePrice: 50,
    sellingPrice: 100,
    supplier: 'Sun Pharma Distributors',
    availableStock: 50,
    minimumStock: settings.defaultMinimumStock,
    barcode: '890123456789',
    rackNumber: 'A-01',
    hsnSac: '',
    taxRate: undefined,
    specification: '',
  });

  const handleOpenAdd = () => {
    setEditingMed(null);
    setFormData({
      name: '',
      brand: '',
      category: 'Eye Drops',
      batchNumber: `BAT-${Math.floor(1000 + Math.random() * 9000)}`,
      expiryDate: '2027-12',
      purchasePrice: 60,
      sellingPrice: 110,
      supplier: 'Sun Pharma Distributors',
      availableStock: 50,
      minimumStock: settings.defaultMinimumStock,
      barcode: `890${Math.floor(100000000 + Math.random() * 900000000)}`,
      rackNumber: 'A-01',
      hsnSac: '',
      taxRate: undefined,
      specification: '',
    });
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (m: Medicine) => {
    setEditingMed(m);
    setFormData({
      name: m.name,
      brand: m.brand,
      category: m.category,
      batchNumber: m.batchNumber,
      expiryDate: m.expiryDate,
      purchasePrice: m.purchasePrice,
      sellingPrice: m.sellingPrice,
      supplier: m.supplier,
      availableStock: m.availableStock,
      minimumStock: m.minimumStock,
      specification: m.specification || '',
      barcode: m.barcode,
      rackNumber: m.rackNumber,
      hsnSac: m.hsnSac || '',
      taxRate: m.taxRate,
    });
    setIsDrawerOpen(true);
  };

  // Deep-link from Inventory Reports' "View Item" action (?item=<id>) —
  // opens that item's edit drawer directly instead of leaving the user to
  // find it themselves in the list. Clears the param afterward so it
  // doesn't reopen on a later unrelated visit to this page.
  useEffect(() => {
    const itemId = searchParams.get('item');
    if (!itemId || medicines.length === 0) return;
    const match = medicines.find((m) => m.id === itemId);
    if (match) handleOpenEdit(match);
    router.replace('/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, medicines]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    setIsSubmitting(true);
    try {
      if (editingMed) {
        await updateMedicine(editingMed.id, formData);
      } else {
        await addMedicine(formData);
      }
      setIsDrawerOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMedicines = medicines.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.rackNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.barcode.includes(searchTerm);

    const matchStock =
      stockFilter === 'all'
        ? true
        : stockFilter === 'low'
        ? m.availableStock <= m.minimumStock && m.availableStock > 0
        : m.availableStock === 0;

    const matchCategory = categoryFilter === 'all' || categoryBucketOf(m.category) === categoryFilter;

    return matchSearch && matchStock && matchCategory;
  });

  // Category summary cards — always across the full catalog (not the active
  // search/stock filters), matching section 7's "at-a-glance" framing.
  // 'Medicines' covers every plain-medicine row (Eye Drops/Tablets/Ointment/
  // Capsules) via the same categoryBucketOf() bucketing used for the filter
  // chips, displayed here as "Medicine".
  const categorySummary = (['Frame', 'Reading Glass', 'Lens', 'Solution', 'Contact Lens', 'Medicines'] as const).map((cat) => {
    const items = cat === 'Medicines' ? medicines.filter((m) => categoryBucketOf(m.category) === 'Medicines') : medicines.filter((m) => m.category === cat);
    return {
      category: cat,
      label: cat === 'Medicines' ? 'Medicine' : cat,
      totalStock: items.reduce((s, m) => s + m.availableStock, 0),
      itemCount: items.length,
      lowStock: items.filter((m) => m.availableStock > 0 && m.availableStock <= m.minimumStock).length,
    };
  });

  const handleExportMeds = () => {
    const medRows = filteredMedicines.map((m) => ({
      'Medicine ID': m.id,
      'Medicine Name': m.name,
      Brand: m.brand,
      Category: m.category,
      'Batch #': m.batchNumber,
      'Expiry Date': m.expiryDate,
      'Rack #': m.rackNumber,
      Supplier: m.supplier,
      'Buy Price (₹)': m.purchasePrice,
      'Sell Price (₹)': m.sellingPrice,
      'Available Stock': m.availableStock,
      'Min Reorder Level': m.minimumStock,
      Barcode: m.barcode,
    }));

    exportToExcel(medRows, 'Medicine_Stock_Register_2026', 'Medicine Inventory');
  };

  return (
    <div id="medicine-inventory-page" className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2.5">
            <Pill className="w-7 h-7 text-indigo-600" />
            Medicine & Pharma Inventory
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Realtime stock monitoring, rack locations, batch numbers, and reorder alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="export-medicine-excel-btn"
            onClick={handleExportMeds}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold rounded-xl text-sm shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Export Stock (Excel)</span>
          </button>

          <button
            id="add-medicine-main-btn"
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Stock Item</span>
          </button>
        </div>
      </div>

      {/* Category Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {categorySummary.map((c) => (
          <button
            key={c.category}
            onClick={() => setCategoryFilter(categoryFilter === c.category ? 'all' : c.category)}
            className={`text-left p-4 bg-white dark:bg-slate-800/80 rounded-2xl border shadow-2xs transition-all ${
              categoryFilter === c.category ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200/80 dark:border-slate-700/80'
            }`}
          >
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{c.label}</span>
            <div className="mt-1.5 text-xl font-black text-slate-900 dark:text-white">{c.totalStock} <span className="text-xs font-semibold text-slate-400">in stock</span></div>
            <div className="mt-1 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span>{c.itemCount} item{c.itemCount === 1 ? '' : 's'}</span>
              {c.lowStock > 0 && <span className="text-amber-600 dark:text-amber-400">• {c.lowStock} low</span>}
            </div>
          </button>
        ))}
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-4 bg-white dark:bg-slate-800/80 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            id="inventory-search-input"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search medicine name, brand, rack number, or barcode..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl flex-wrap">
            {INVENTORY_CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                  categoryFilter === c ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-2xs' : 'text-slate-500'
                }`}
              >
                {c === 'all' ? 'All Categories' : c}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                stockFilter === 'all'
                  ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              All Items ({medicines.length})
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                stockFilter === 'low'
                  ? 'bg-white dark:bg-slate-800 text-amber-600 shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              Low Stock
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                stockFilter === 'out'
                  ? 'bg-white dark:bg-slate-800 text-rose-600 shadow-2xs'
                  : 'text-slate-500'
              }`}
            >
              Out of Stock
            </button>
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-slate-800/80 rounded-3xl border border-slate-200/80 dark:border-slate-700/80 shadow-2xs overflow-hidden p-2">
        <StockInventoryTable
          items={filteredMedicines}
          emptyLabel="No matching items in inventory"
          tracking={trackingByItemId}
          showTrackingColumns
          renderActions={(m) => (
            <>
              <button
                id={`issue-med-${m.id}`}
                onClick={() => {
                  setIssuingMed(m);
                  setIssueQtyInput('1');
                }}
                title="Issue / Dispense Stock"
                className="flex items-center gap-1 px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                <MinusCircle className="w-3.5 h-3.5" />
                <span>Issue</span>
              </button>
              <button
                id={`edit-med-${m.id}`}
                onClick={() => handleOpenEdit(m)}
                title="Edit Stock Details"
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                id={`delete-med-${m.id}`}
                onClick={() => setDeletingMedId(m.id)}
                title="Delete Stock Item"
                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        />
      </div>

      {/* ADD / EDIT MEDICINE MODAL */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingMed ? 'Edit Inventory Item' : 'Add New Inventory Stock'}
              </h3>
              <button
                onClick={() => setIsDrawerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Medicine / Item Name *
                </label>
                <input
                  id="med-form-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Moxifloxacin Eye Drops 0.5%"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-medium text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Brand Name
                  </label>
                  <input
                    id="med-form-brand"
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Moxicip (Cipla)"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    id="med-form-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                  >
                    <option value="Eye Drops">Eye Drops</option>
                    <option value="Tablets">Tablets</option>
                    <option value="Ointment">Ointment</option>
                    <option value="Capsules">Capsules</option>
                    <option value="Solution">Solution</option>
                    <option value="Reading Glass">Reading Glass</option>
                    <option value="Frame">Frame</option>
                    <option value="Lens">Lens</option>
                    <option value="Contact Lens">Contact Lens</option>
                  </select>
                </div>
              </div>

              {(formData.category === 'Frame' || formData.category === 'Lens' || formData.category === 'Contact Lens') && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {formData.category === 'Frame' ? 'Frame Type' : formData.category === 'Lens' ? 'Lens Specification' : 'Power / Specification'}
                  </label>
                  <input
                    id="med-form-specification"
                    type="text"
                    value={formData.specification || ''}
                    onChange={(e) => setFormData({ ...formData, specification: e.target.value })}
                    placeholder={formData.category === 'Frame' ? 'e.g. Full Rim' : formData.category === 'Lens' ? 'e.g. Single Vision, 1.56 index' : 'e.g. -1.00 OD / -1.00 OS'}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Batch #
                  </label>
                  <input
                    id="med-form-batch"
                    type="text"
                    value={formData.batchNumber}
                    onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rack Location
                  </label>
                  <input
                    id="med-form-rack"
                    type="text"
                    value={formData.rackNumber}
                    onChange={(e) => setFormData({ ...formData, rackNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expiry Date
                  </label>
                  <input
                    id="med-form-expiry"
                    type="month"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Available Stock
                  </label>
                  <input
                    id="med-form-stock"
                    type="number"
                    value={formData.availableStock}
                    onChange={(e) => setFormData({ ...formData, availableStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Minimum Reorder Stock
                  </label>
                  <input
                    id="med-form-minstock"
                    type="number"
                    value={formData.minimumStock}
                    onChange={(e) => setFormData({ ...formData, minimumStock: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Purchase Price (₹)
                  </label>
                  <input
                    id="med-form-buyprice"
                    type="number"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Selling Price (₹)
                  </label>
                  <input
                    id="med-form-sellprice"
                    type="number"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    HSN/SAC <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="med-form-hsn"
                    type="text"
                    value={formData.hsnSac || ''}
                    onChange={(e) => setFormData({ ...formData, hsnSac: e.target.value })}
                    placeholder="e.g. 3004"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    GST Rate (%) <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <input
                    id="med-form-tax-rate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={formData.taxRate ?? ''}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value === '' ? undefined : parseFloat(e.target.value) || 0 })}
                    placeholder="Uses default rate if blank"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  id="save-medicine-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-md transition-all"
                >
                  {isSubmitting ? 'Saving...' : editingMed ? 'Save Changes' : 'Add Medicine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingMedId)}
        title="Remove Medicine from Inventory?"
        message="Are you sure you want to delete this medicine record?"
        confirmLabel="Remove Stock"
        variant="danger"
        onConfirm={() => {
          if (deletingMedId) deleteMedicine(deletingMedId);
        }}
        onCancel={() => setDeletingMedId(null)}
      />

      {/* QUICK ISSUE / DISPENSE STOCK MODAL */}
      {issuingMed && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MinusCircle className="w-5 h-5 text-amber-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Issue / Dispense Stock
                </h3>
              </div>
              <button
                onClick={() => setIssuingMed(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {issuingMed.name}
                </p>
                <p className="text-[11px] text-slate-500">
                  Current Available Stock: <span className="font-bold text-emerald-600">{issuingMed.availableStock} units</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Quantity to Issue / Deduct
                </label>
                <input
                  id="issue-stock-qty-input"
                  type="number"
                  min={0}
                  max={issuingMed.availableStock}
                  value={issueQtyInput}
                  onChange={(e) => setIssueQtyInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-sm"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 text-xs space-y-1">
                <div className="flex justify-between text-slate-500">
                  <span>Stock Before:</span>
                  <span className="font-bold">{issuingMed.availableStock}</span>
                </div>
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>Deducting:</span>
                  <span>- {issueQty}</span>
                </div>
                <div className="flex justify-between text-indigo-600 dark:text-indigo-400 font-black border-t border-slate-200 dark:border-slate-700 pt-1">
                  <span>Remaining Live Stock:</span>
                  <span>{Math.max(0, issuingMed.availableStock - issueQty)} units</span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIssuingMed(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  id="confirm-issue-stock-btn"
                  type="button"
                  onClick={async () => {
                    if (!issuingMed || issueQty <= 0) return;
                    setIsSubmitting(true);
                    try {
                      issueMedicineStock(issuingMed.id, issueQty);
                      setIssuingMed(null);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
                >
                  {isSubmitting ? 'Processing...' : 'Deduct Live Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
