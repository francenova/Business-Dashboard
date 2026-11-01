'use client';

import React, { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { motion } from 'motion/react';
import { SupplierPicker } from '@/components/dashboard/SupplierPicker';
import { InventorySearchPicker } from '@/components/dashboard/InventorySearchPicker';
import { TextAutosuggest } from '@/components/dashboard/TextAutosuggest';
import { Glasses, Eye, Droplet, Contact, Pill, X, ArrowLeft } from 'lucide-react';

type StockCategory = 'Frame' | 'Lens' | 'Solution' | 'Contact Lens' | 'Medicine';
type MedicineSubCategory = 'Eye Drops' | 'Tablets' | 'Ointment' | 'Capsules';
type FrameCategory = 'Regular Frame' | 'Reading Glass';

const CATEGORY_CARDS: { category: StockCategory; icon: React.ElementType; description: string }[] = [
  { category: 'Frame', icon: Glasses, description: 'Regular Frame or Reading Glass' },
  { category: 'Lens', icon: Eye, description: 'Add ophthalmic lens stock' },
  { category: 'Solution', icon: Droplet, description: 'Add solution stock' },
  { category: 'Contact Lens', icon: Contact, description: 'Add contact lens stock' },
  { category: 'Medicine', icon: Pill, description: 'Add medicine stock' },
];

const READING_POWERS = ['+0.50', '+0.75', '+1.00', '+1.25', '+1.50', '+1.75', '+2.00', '+2.25', '+2.50', '+2.75', '+3.00', '+3.25', '+3.50', '+3.75', '+4.00'];
const LENS_TYPE_CHIPS = ['Single Vision', 'Kryptok Bifocal', 'D-Bifocal', 'Progressive', 'BlueCut'];

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

const emptyFrameForm = {
  date: todayStr(),
  brand: '',
  name: '',
  code: '',
  frameType: 'Full Rim',
  quantity: '1',
  purchasePrice: '',
  sellingPrice: '',
  supplier: '',
  referenceNumber: '',
  notes: '',
  paymentMade: '',
};

const emptyReadingGlassForm = {
  date: todayStr(),
  variant: 'Pen Type' as 'Pen Type' | 'Pouch Type',
  brand: '',
  name: '',
  code: '',
  readingPower: '+1.00',
  quantity: '1',
  purchasePrice: '',
  sellingPrice: '',
  supplier: '',
  referenceNumber: '',
  notes: '',
  paymentMade: '',
};

const emptyLensForm = {
  date: todayStr(),
  lensType: '',
  brand: '',
  name: '',
  code: '',
  blueCut: false,
  photochromic: false,
  antiGlare: false,
  quantity: '1',
  purchasePrice: '',
  sellingPrice: '',
  supplier: '',
  referenceNumber: '',
  notes: '',
  paymentMade: '',
};

const emptyContactLensForm = {
  date: todayStr(),
  brand: '',
  name: '',
  power: '',
  baseCurve: '',
  diameter: '',
  code: '',
  quantity: '1',
  purchasePrice: '',
  sellingPrice: '',
  supplier: '',
  referenceNumber: '',
  notes: '',
  paymentMade: '',
};

const emptySolutionForm = {
  date: todayStr(),
  brand: '',
  product: '',
  packSize: '120 ml',
  code: '',
  quantity: '1',
  purchasePrice: '',
  sellingPrice: '',
  discount: '0',
  supplier: '',
  referenceNumber: '',
  notes: '',
  paymentMade: '',
};

const emptyMedicineForm = {
  name: '',
  brand: '',
  category: 'Eye Drops' as MedicineSubCategory,
  batchNumber: '',
  rackNumber: '',
  expiryDate: '',
  availableStock: '1',
  minimumStock: '',
  purchasePrice: '',
  sellingPrice: '',
  hsnSac: '',
  taxRate: '',
  supplier: '',
  referenceNumber: '',
  notes: '',
  paymentMade: '',
};

// Payment Made Now can be left blank (fully paid, the existing default
// behavior) or set below the transaction total to record a partial/on-credit
// purchase — clamped to [0, total] so a stray value can't look like this one
// purchase created an advance (an overall advance across many purchases can
// still happen, tracked on the Supplier Details page).
function parsePaidAmount(raw: string, total: number): number | undefined {
  if (!raw.trim()) return undefined;
  const n = parseFloat(raw);
  if (isNaN(n)) return undefined;
  return Math.max(0, Math.min(n, total));
}

function PaymentField({ total, value, onChange }: { total: number; value: string; onChange: (v: string) => void }) {
  const paid = parsePaidAmount(value, total) ?? total;
  const outstanding = Math.max(0, total - paid);
  return (
    <div>
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Payment Made Now (₹)</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`Full amount (₹${total.toLocaleString('en-IN')}) if left blank`}
        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
      />
      {outstanding > 0 && (
        <p className="mt-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">Outstanding to this supplier after this payment: ₹{outstanding.toLocaleString('en-IN')}</p>
      )}
    </div>
  );
}

export const AddStockModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { purchaseStock, addMedicine, addExpense, medicines, settings, addToast } = useApp();
  const [category, setCategory] = useState<StockCategory | null>(null);
  const [frameCategory, setFrameCategory] = useState<FrameCategory>('Regular Frame');
  const [frameForm, setFrameForm] = useState(emptyFrameForm);
  const [readingGlassForm, setReadingGlassForm] = useState(emptyReadingGlassForm);
  const [lensForm, setLensForm] = useState(emptyLensForm);
  const [contactLensForm, setContactLensForm] = useState(emptyContactLensForm);
  const [solutionForm, setSolutionForm] = useState(emptySolutionForm);
  const [medicineForm, setMedicineForm] = useState(emptyMedicineForm);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setCategory(null);
    setFrameCategory('Regular Frame');
    setFrameForm(emptyFrameForm);
    setReadingGlassForm(emptyReadingGlassForm);
    setLensForm(emptyLensForm);
    setContactLensForm(emptyContactLensForm);
    setSolutionForm(emptySolutionForm);
    setMedicineForm({ ...emptyMedicineForm, minimumStock: String(settings.defaultMinimumStock) });
    onClose();
  };

  const handleCategoryClick = (cat: StockCategory) => {
    if (cat === 'Medicine') {
      setMedicineForm({ ...emptyMedicineForm, minimumStock: String(settings.defaultMinimumStock) });
    }
    setCategory(cat);
  };

  const solutionBrands = Array.from(new Set(medicines.filter((m) => m.category === 'Solution').map((m) => m.brand))).filter(Boolean);

  // Brand suggestions + brand-cascaded Name/Product suggestions per category
  // — mirrors Patient Visit's suggestion pattern, so a purchaser sees the
  // existing catalog instead of retyping (and accidentally forking) it.
  const brandOptionsFor = (cat: string) => Array.from(new Set(medicines.filter((m) => m.category === cat).map((m) => m.brand))).filter(Boolean);
  const itemsForCategory = (cat: string, brand: string) =>
    medicines.filter((m) => m.category === cat && (!brand.trim() || m.brand.toLowerCase().includes(brand.trim().toLowerCase())));

  const frameBrandOptions = brandOptionsFor('Frame');
  const frameNameOptions = itemsForCategory('Frame', frameForm.brand);
  const applyFrameFormFromItem = (m: (typeof medicines)[0]) => {
    const validTypes = ['Full Rim', 'Half Rim', 'Rimless', 'Sunglasses', 'Shell', 'Other'];
    setFrameForm((prev) => ({
      ...prev,
      name: m.name,
      brand: m.brand,
      code: m.barcode || prev.code,
      frameType: validTypes.includes(m.specification || '') ? m.specification! : prev.frameType,
      purchasePrice: prev.purchasePrice || String(m.purchasePrice || ''),
      sellingPrice: prev.sellingPrice || String(m.sellingPrice || ''),
    }));
  };

  const readingGlassBrandOptions = brandOptionsFor('Reading Glass');
  const readingGlassNameOptions = itemsForCategory('Reading Glass', readingGlassForm.brand);
  const applyReadingGlassFormFromItem = (m: (typeof medicines)[0]) => {
    setReadingGlassForm((prev) => ({
      ...prev,
      name: m.name,
      brand: m.brand,
      code: m.barcode || prev.code,
      purchasePrice: prev.purchasePrice || String(m.purchasePrice || ''),
      sellingPrice: prev.sellingPrice || String(m.sellingPrice || ''),
    }));
  };

  const lensBrandOptions = brandOptionsFor('Lens');
  const lensNameOptions = itemsForCategory('Lens', lensForm.brand);
  const applyLensFormFromItem = (m: (typeof medicines)[0]) => {
    const lensType = m.specification?.split(' • ')[0]?.trim();
    setLensForm((prev) => ({
      ...prev,
      name: m.name,
      brand: m.brand,
      code: m.barcode || prev.code,
      lensType: lensType || prev.lensType,
      purchasePrice: prev.purchasePrice || String(m.purchasePrice || ''),
      sellingPrice: prev.sellingPrice || String(m.sellingPrice || ''),
    }));
  };

  const contactLensBrandOptions = brandOptionsFor('Contact Lens');
  const contactLensNameOptions = itemsForCategory('Contact Lens', contactLensForm.brand);
  const applyContactLensFormFromItem = (m: (typeof medicines)[0]) => {
    const parts = (m.specification || '').split(' • ').map((p) => p.trim());
    const power = parts.find((p) => p && !p.startsWith('BC ') && !p.startsWith('DIA '));
    const baseCurve = parts.find((p) => p.startsWith('BC '))?.slice(3);
    const diameter = parts.find((p) => p.startsWith('DIA '))?.slice(4);
    setContactLensForm((prev) => ({
      ...prev,
      name: m.name,
      brand: m.brand,
      code: m.barcode || prev.code,
      power: power || prev.power,
      baseCurve: baseCurve || prev.baseCurve,
      diameter: diameter || prev.diameter,
      purchasePrice: prev.purchasePrice || String(m.purchasePrice || ''),
      sellingPrice: prev.sellingPrice || String(m.sellingPrice || ''),
    }));
  };

  const solutionProductOptions = itemsForCategory('Solution', solutionForm.brand);
  const applySolutionFormFromItem = (m: (typeof medicines)[0]) => {
    setSolutionForm((prev) => ({
      ...prev,
      product: m.name,
      brand: m.brand,
      code: m.barcode || prev.code,
      packSize: ['60 ml', '120 ml', '360 ml'].includes(m.specification || '') ? m.specification! : prev.packSize,
      purchasePrice: prev.purchasePrice || String(m.purchasePrice || ''),
      sellingPrice: prev.sellingPrice || String(m.sellingPrice || ''),
    }));
  };

  // Code -> reverse lookup: typing an exact existing barcode re-fills the
  // rest of that category's form, same as picking it from the suggestions.
  const codeLookup = (cat: string, code: string) => medicines.find((m) => m.category === cat && m.barcode && m.barcode.toLowerCase() === code.trim().toLowerCase());

  const handleSaveFrame = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseInt(frameForm.quantity, 10) || 0;
    const purchasePrice = parseFloat(frameForm.purchasePrice) || 0;
    const sellingPrice = parseFloat(frameForm.sellingPrice) || 0;

    if (!frameForm.name.trim() || !frameForm.brand.trim()) {
      addToast('Missing Fields', 'Frame name and brand are required.', 'warning');
      return;
    }
    if (quantity <= 0) {
      addToast('Invalid Quantity', 'Quantity must be greater than 0.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await purchaseStock({
        category: 'Frame',
        name: frameForm.name.trim(),
        brand: frameForm.brand.trim(),
        specification: frameForm.frameType,
        barcode: frameForm.code.trim() || undefined,
        quantity,
        purchasePrice,
        sellingPrice,
        supplier: frameForm.supplier.trim() || undefined,
        date: frameForm.date,
        referenceNumber: frameForm.referenceNumber.trim() || undefined,
        notes: frameForm.notes.trim() || undefined,
        paidAmount: parsePaidAmount(frameForm.paymentMade, purchasePrice * quantity),
      });
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveReadingGlass = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseInt(readingGlassForm.quantity, 10) || 0;
    const purchasePrice = parseFloat(readingGlassForm.purchasePrice) || 0;
    const sellingPrice = parseFloat(readingGlassForm.sellingPrice) || 0;

    if (!readingGlassForm.name.trim() || !readingGlassForm.brand.trim()) {
      addToast('Missing Fields', 'Product name and brand are required.', 'warning');
      return;
    }
    if (quantity <= 0) {
      addToast('Invalid Quantity', 'Quantity must be greater than 0.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await purchaseStock({
        category: 'Reading Glass',
        name: readingGlassForm.name.trim(),
        brand: readingGlassForm.brand.trim(),
        specification: `${readingGlassForm.variant} • ${readingGlassForm.readingPower}`,
        barcode: readingGlassForm.code.trim() || undefined,
        quantity,
        purchasePrice,
        sellingPrice,
        supplier: readingGlassForm.supplier.trim() || undefined,
        date: readingGlassForm.date,
        referenceNumber: readingGlassForm.referenceNumber.trim() || undefined,
        notes: readingGlassForm.notes.trim() || undefined,
        paidAmount: parsePaidAmount(readingGlassForm.paymentMade, purchasePrice * quantity),
      });
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveLens = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseInt(lensForm.quantity, 10) || 0;
    const purchasePrice = parseFloat(lensForm.purchasePrice) || 0;
    const sellingPrice = parseFloat(lensForm.sellingPrice) || 0;

    if (!lensForm.name.trim() || !lensForm.brand.trim()) {
      addToast('Missing Fields', 'Product name and brand are required.', 'warning');
      return;
    }
    if (quantity <= 0) {
      addToast('Invalid Quantity', 'Quantity must be greater than 0.', 'warning');
      return;
    }

    const coatings = [lensForm.blueCut && 'Blue Cut Filter', lensForm.photochromic && 'Photochromic (Transitions)', lensForm.antiGlare && 'Anti-Glare Coating (ARC)'].filter(Boolean);
    const specification = [lensForm.lensType.trim(), coatings.join(', ')].filter(Boolean).join(' • ');

    setIsSaving(true);
    try {
      await purchaseStock({
        category: 'Lens',
        name: lensForm.name.trim(),
        brand: lensForm.brand.trim(),
        specification: specification || undefined,
        barcode: lensForm.code.trim() || undefined,
        quantity,
        purchasePrice,
        sellingPrice,
        supplier: lensForm.supplier.trim() || undefined,
        date: lensForm.date,
        referenceNumber: lensForm.referenceNumber.trim() || undefined,
        notes: lensForm.notes.trim() || undefined,
        paidAmount: parsePaidAmount(lensForm.paymentMade, purchasePrice * quantity),
      });
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveContactLens = async (e: React.FormEvent) => {
    e.preventDefault();
    const quantity = parseInt(contactLensForm.quantity, 10) || 0;
    const purchasePrice = parseFloat(contactLensForm.purchasePrice) || 0;
    const sellingPrice = parseFloat(contactLensForm.sellingPrice) || 0;

    if (!contactLensForm.name.trim() || !contactLensForm.brand.trim()) {
      addToast('Missing Fields', 'Product name and brand are required.', 'warning');
      return;
    }
    if (quantity <= 0) {
      addToast('Invalid Quantity', 'Quantity must be greater than 0.', 'warning');
      return;
    }

    const specification = [
      contactLensForm.power.trim(),
      contactLensForm.baseCurve.trim() ? `BC ${contactLensForm.baseCurve.trim()}` : '',
      contactLensForm.diameter.trim() ? `DIA ${contactLensForm.diameter.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' • ');

    setIsSaving(true);
    try {
      await purchaseStock({
        category: 'Contact Lens',
        name: contactLensForm.name.trim(),
        brand: contactLensForm.brand.trim(),
        specification: specification || undefined,
        barcode: contactLensForm.code.trim() || undefined,
        quantity,
        purchasePrice,
        sellingPrice,
        supplier: contactLensForm.supplier.trim() || undefined,
        date: contactLensForm.date,
        referenceNumber: contactLensForm.referenceNumber.trim() || undefined,
        notes: contactLensForm.notes.trim() || undefined,
        paidAmount: parsePaidAmount(contactLensForm.paymentMade, purchasePrice * quantity),
      });
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSolution = async (e: React.FormEvent) => {
    e.preventDefault();

    const quantity = parseInt(solutionForm.quantity, 10) || 0;
    const purchasePrice = parseFloat(solutionForm.purchasePrice) || 0;
    const sellingPrice = parseFloat(solutionForm.sellingPrice) || 0;
    const discount = parseFloat(solutionForm.discount) || 0;

    if (!solutionForm.product.trim() || !solutionForm.brand.trim()) {
      addToast('Missing Fields', 'Product name and brand are required.', 'warning');
      return;
    }
    if (quantity <= 0) {
      addToast('Invalid Quantity', 'Quantity must be greater than 0.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await purchaseStock({
        category: 'Solution',
        name: solutionForm.product.trim(),
        brand: solutionForm.brand.trim(),
        specification: solutionForm.packSize.trim() || undefined,
        barcode: solutionForm.code.trim() || undefined,
        quantity,
        purchasePrice,
        sellingPrice,
        supplier: solutionForm.supplier.trim() || undefined,
        date: solutionForm.date,
        referenceNumber: solutionForm.referenceNumber.trim() || undefined,
        notes: solutionForm.notes.trim() || undefined,
        discount,
        paidAmount: parsePaidAmount(solutionForm.paymentMade, Math.max(0, purchasePrice * quantity - discount)),
      });
      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();

    const availableStock = parseInt(medicineForm.availableStock, 10) || 0;
    const purchasePrice = parseFloat(medicineForm.purchasePrice) || 0;
    const sellingPrice = parseFloat(medicineForm.sellingPrice) || 0;
    const minimumStock = parseInt(medicineForm.minimumStock, 10) || settings.defaultMinimumStock;
    const taxRate = medicineForm.taxRate.trim() ? parseFloat(medicineForm.taxRate) : undefined;

    if (!medicineForm.name.trim()) {
      addToast('Missing Fields', 'Medicine / Item name is required.', 'warning');
      return;
    }
    if (availableStock <= 0) {
      addToast('Invalid Quantity', 'Available stock must be greater than 0.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      await addMedicine({
        name: medicineForm.name.trim(),
        brand: medicineForm.brand.trim(),
        category: medicineForm.category,
        batchNumber: medicineForm.batchNumber.trim(),
        expiryDate: medicineForm.expiryDate,
        purchasePrice,
        sellingPrice,
        supplier: medicineForm.supplier.trim(),
        availableStock,
        minimumStock,
        barcode: '',
        rackNumber: medicineForm.rackNumber.trim(),
        hsnSac: medicineForm.hsnSac.trim() || undefined,
        taxRate,
        specification: '',
      });

      const medicineSpec = [
        medicineForm.category,
        medicineForm.rackNumber.trim() ? `Rack ${medicineForm.rackNumber.trim()}` : '',
        medicineForm.expiryDate ? `Exp ${medicineForm.expiryDate}` : '',
      ]
        .filter(Boolean)
        .join(' • ');

      await addExpense({
        category: 'Medical / Clinic Supplies',
        description: `Medicine Purchase — ${medicineForm.brand.trim()} ${medicineForm.name.trim()} x${availableStock}`.trim(),
        amount: purchasePrice * availableStock,
        date: todayStr(),
        vendor: medicineForm.supplier.trim() || undefined,
        paymentMethod: 'Cash',
        referenceNumber: medicineForm.referenceNumber.trim() || undefined,
        notes: medicineForm.notes.trim() || undefined,
        paidAmount: parsePaidAmount(medicineForm.paymentMade, purchasePrice * availableStock),
        productDetails: {
          productName: medicineForm.name.trim(),
          brand: medicineForm.brand.trim(),
          code: medicineForm.batchNumber.trim() || undefined,
          specification: medicineSpec || undefined,
          quantity: availableStock,
          unitPurchasePrice: purchasePrice,
          unitSellingPrice: sellingPrice,
        },
      });

      handleClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            {category && (
              <button type="button" onClick={() => setCategory(null)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {category === 'Frame' ? (frameCategory === 'Regular Frame' ? 'Add Frame Stock' : 'Add Reading Glass Stock') : category ? `Add ${category} Stock` : 'Choose what you’re adding'}
            </h3>
          </div>
          <button onClick={handleClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!category ? (
          <div className="grid grid-cols-2 gap-3">
            {CATEGORY_CARDS.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.category}
                  type="button"
                  onClick={() => handleCategoryClick(c.category)}
                  className="flex flex-col items-center gap-2 p-5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-indigo-500 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 transition-all"
                >
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{c.category}</span>
                  <span className="text-[11px] text-slate-400 text-center">{c.description}</span>
                </button>
              );
            })}
          </div>
        ) : category === 'Frame' ? (
          <div className="space-y-4 text-sm">
            {/* Category: Regular Frame vs Reading Glass — mirrors Patient Visit's Frame Selection card */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Regular Frame', 'Reading Glass'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFrameCategory(cat)}
                    className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                      frameCategory === cat
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {frameCategory === 'Regular Frame' ? (
              <form onSubmit={handleSaveFrame} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                    <input type="date" value={frameForm.date} onChange={(e) => setFrameForm({ ...frameForm, date: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" required />
                  </div>
                  <TextAutosuggest
                    id="add-stock-frame-brand"
                    label="Frame Brand"
                    options={frameBrandOptions}
                    value={frameForm.brand}
                    onChange={(brand) => setFrameForm({ ...frameForm, brand })}
                  />
                </div>

                <InventorySearchPicker
                  id="add-stock-frame-name"
                  label="Frame Name"
                  items={frameNameOptions}
                  value={frameForm.name}
                  onSearchChange={(name) => setFrameForm({ ...frameForm, name })}
                  onSelect={applyFrameFormFromItem}
                  placeholder="e.g. Titan Matte Black Rectangular"
                />

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Frame Code</label>
                    <input
                      type="text"
                      value={frameForm.code}
                      onChange={(e) => {
                        const code = e.target.value;
                        const match = codeLookup('Frame', code);
                        if (match) applyFrameFormFromItem(match);
                        else setFrameForm({ ...frameForm, code });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Frame Type</label>
                    <select value={frameForm.frameType} onChange={(e) => setFrameForm({ ...frameForm, frameType: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-medium">
                      <option value="Full Rim">Full Rim</option>
                      <option value="Half Rim">Half Rim</option>
                      <option value="Rimless">Rimless</option>
                      <option value="Sunglasses">Sunglasses</option>
                      <option value="Shell">Shell</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                    <input type="number" min="1" value={frameForm.quantity} onChange={(e) => setFrameForm({ ...frameForm, quantity: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Purchase Price (₹)</label>
                    <input type="number" min="0" step="0.01" value={frameForm.purchasePrice} onChange={(e) => setFrameForm({ ...frameForm, purchasePrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selling Price (₹)</label>
                    <input type="number" min="0" step="0.01" value={frameForm.sellingPrice} onChange={(e) => setFrameForm({ ...frameForm, sellingPrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SupplierPicker value={frameForm.supplier} onChange={(name) => setFrameForm({ ...frameForm, supplier: name })} />
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice / Reference No.</label>
                    <input type="text" value={frameForm.referenceNumber} onChange={(e) => setFrameForm({ ...frameForm, referenceNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                  <textarea value={frameForm.notes} onChange={(e) => setFrameForm({ ...frameForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>

                <PaymentField total={(parseFloat(frameForm.purchasePrice) || 0) * (parseInt(frameForm.quantity, 10) || 0)} value={frameForm.paymentMade} onChange={(v) => setFrameForm({ ...frameForm, paymentMade: v })} />

                <p className="text-[11px] text-slate-400">
                  This will increase Frame stock by {frameForm.quantity || 0} unit(s), log a stock movement, and record a
                  matching Frame expense of ₹{((parseFloat(frameForm.purchasePrice) || 0) * (parseInt(frameForm.quantity, 10) || 0)).toLocaleString('en-IN')}.
                </p>

                <div className="flex items-center gap-2 pt-2">
                  <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Add Stock'}
                  </button>
                  <button type="button" onClick={handleClose} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all active:scale-95">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSaveReadingGlass} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                    <input type="date" value={readingGlassForm.date} onChange={(e) => setReadingGlassForm({ ...readingGlassForm, date: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reading Glass Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['Pen Type', 'Pouch Type'] as const).map((variant) => (
                        <button
                          key={variant}
                          type="button"
                          onClick={() => setReadingGlassForm({ ...readingGlassForm, variant })}
                          className={`px-2 py-2 rounded-xl border text-xs font-semibold transition-all ${
                            readingGlassForm.variant === variant
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {variant}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <TextAutosuggest
                    id="add-stock-reading-glass-brand"
                    label="Brand"
                    options={readingGlassBrandOptions}
                    value={readingGlassForm.brand}
                    onChange={(brand) => setReadingGlassForm({ ...readingGlassForm, brand })}
                  />
                  <InventorySearchPicker
                    id="add-stock-reading-glass-name"
                    label="Product Name"
                    items={readingGlassNameOptions}
                    value={readingGlassForm.name}
                    onSearchChange={(name) => setReadingGlassForm({ ...readingGlassForm, name })}
                    onSelect={applyReadingGlassFormFromItem}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Product Code</label>
                    <input
                      type="text"
                      value={readingGlassForm.code}
                      onChange={(e) => {
                        const code = e.target.value;
                        const match = codeLookup('Reading Glass', code);
                        if (match) applyReadingGlassFormFromItem(match);
                        else setReadingGlassForm({ ...readingGlassForm, code });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Reading Power</label>
                    <select value={readingGlassForm.readingPower} onChange={(e) => setReadingGlassForm({ ...readingGlassForm, readingPower: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono font-semibold">
                      {READING_POWERS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                    <input type="number" min="1" value={readingGlassForm.quantity} onChange={(e) => setReadingGlassForm({ ...readingGlassForm, quantity: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Purchase Price (₹)</label>
                    <input type="number" min="0" step="0.01" value={readingGlassForm.purchasePrice} onChange={(e) => setReadingGlassForm({ ...readingGlassForm, purchasePrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selling Price (₹)</label>
                    <input type="number" min="0" step="0.01" value={readingGlassForm.sellingPrice} onChange={(e) => setReadingGlassForm({ ...readingGlassForm, sellingPrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <SupplierPicker value={readingGlassForm.supplier} onChange={(name) => setReadingGlassForm({ ...readingGlassForm, supplier: name })} />
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice / Reference No.</label>
                    <input type="text" value={readingGlassForm.referenceNumber} onChange={(e) => setReadingGlassForm({ ...readingGlassForm, referenceNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
                  <textarea value={readingGlassForm.notes} onChange={(e) => setReadingGlassForm({ ...readingGlassForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                </div>

                <PaymentField total={(parseFloat(readingGlassForm.purchasePrice) || 0) * (parseInt(readingGlassForm.quantity, 10) || 0)} value={readingGlassForm.paymentMade} onChange={(v) => setReadingGlassForm({ ...readingGlassForm, paymentMade: v })} />

                <p className="text-[11px] text-slate-400">
                  This will increase Reading Glass stock by {readingGlassForm.quantity || 0} unit(s), log a stock movement, and record a
                  matching Purchase expense of ₹{((parseFloat(readingGlassForm.purchasePrice) || 0) * (parseInt(readingGlassForm.quantity, 10) || 0)).toLocaleString('en-IN')}.
                </p>

                <div className="flex items-center gap-2 pt-2">
                  <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Add Stock'}
                  </button>
                  <button type="button" onClick={handleClose} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all active:scale-95">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : category === 'Lens' ? (
          <form onSubmit={handleSaveLens} className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                <input type="date" value={lensForm.date} onChange={(e) => setLensForm({ ...lensForm, date: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Lens Type (Select or Type Custom)</label>
                <input type="text" value={lensForm.lensType} onChange={(e) => setLensForm({ ...lensForm, lensType: e.target.value })} placeholder="e.g. Single Vision" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {LENS_TYPE_CHIPS.map((lt) => (
                <button
                  key={lt}
                  type="button"
                  onClick={() => setLensForm({ ...lensForm, lensType: lt })}
                  className={`px-2.5 py-1 text-[11px] rounded-lg border font-medium transition-colors ${
                    lensForm.lensType.toLowerCase().includes(lt.toLowerCase())
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {lt}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <TextAutosuggest
                id="add-stock-lens-brand"
                label="Brand"
                options={lensBrandOptions}
                value={lensForm.brand}
                onChange={(brand) => setLensForm({ ...lensForm, brand })}
                placeholder="e.g. Essilor"
              />
              <InventorySearchPicker
                id="add-stock-lens-name"
                label="Product / Model Name"
                items={lensNameOptions}
                value={lensForm.name}
                onSearchChange={(name) => setLensForm({ ...lensForm, name })}
                onSelect={applyLensFormFromItem}
                placeholder="e.g. Crizal Prevencia"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Coating Options</label>
              <div className="flex flex-wrap gap-2">
                <label className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer font-medium transition-all ${lensForm.blueCut ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  <input type="checkbox" checked={lensForm.blueCut} onChange={(e) => setLensForm({ ...lensForm, blueCut: e.target.checked })} className="hidden" />
                  Blue Cut Filter
                </label>
                <label className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer font-medium transition-all ${lensForm.photochromic ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  <input type="checkbox" checked={lensForm.photochromic} onChange={(e) => setLensForm({ ...lensForm, photochromic: e.target.checked })} className="hidden" />
                  Photochromic (Transitions)
                </label>
                <label className={`px-3 py-1.5 rounded-xl border text-xs cursor-pointer font-medium transition-all ${lensForm.antiGlare ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                  <input type="checkbox" checked={lensForm.antiGlare} onChange={(e) => setLensForm({ ...lensForm, antiGlare: e.target.checked })} className="hidden" />
                  Anti-Glare Coating (ARC)
                </label>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Code</label>
                <input
                  type="text"
                  value={lensForm.code}
                  onChange={(e) => {
                    const code = e.target.value;
                    const match = codeLookup('Lens', code);
                    if (match) applyLensFormFromItem(match);
                    else setLensForm({ ...lensForm, code });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                <input type="number" min="1" value={lensForm.quantity} onChange={(e) => setLensForm({ ...lensForm, quantity: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Purchase Price (₹)</label>
                <input type="number" min="0" step="0.01" value={lensForm.purchasePrice} onChange={(e) => setLensForm({ ...lensForm, purchasePrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selling Price / Lens Price (₹)</label>
              <input type="number" min="0" step="0.01" value={lensForm.sellingPrice} onChange={(e) => setLensForm({ ...lensForm, sellingPrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SupplierPicker value={lensForm.supplier} onChange={(name) => setLensForm({ ...lensForm, supplier: name })} />
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice / Reference No.</label>
                <input type="text" value={lensForm.referenceNumber} onChange={(e) => setLensForm({ ...lensForm, referenceNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
              <textarea value={lensForm.notes} onChange={(e) => setLensForm({ ...lensForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
            </div>

            <PaymentField total={(parseFloat(lensForm.purchasePrice) || 0) * (parseInt(lensForm.quantity, 10) || 0)} value={lensForm.paymentMade} onChange={(v) => setLensForm({ ...lensForm, paymentMade: v })} />

            <p className="text-[11px] text-slate-400">
              This will increase Lens stock by {lensForm.quantity || 0} unit(s), log a stock movement, and record a
              matching Lens expense of ₹{((parseFloat(lensForm.purchasePrice) || 0) * (parseInt(lensForm.quantity, 10) || 0)).toLocaleString('en-IN')}.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Add Stock'}
              </button>
              <button type="button" onClick={handleClose} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all active:scale-95">
                Cancel
              </button>
            </div>
          </form>
        ) : category === 'Contact Lens' ? (
          <form onSubmit={handleSaveContactLens} className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                <input type="date" value={contactLensForm.date} onChange={(e) => setContactLensForm({ ...contactLensForm, date: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" required />
              </div>
              <TextAutosuggest
                id="add-stock-contact-lens-brand"
                label="Brand"
                options={contactLensBrandOptions}
                value={contactLensForm.brand}
                onChange={(brand) => setContactLensForm({ ...contactLensForm, brand })}
                placeholder="e.g. Bausch & Lomb"
              />
            </div>

            <InventorySearchPicker
              id="add-stock-contact-lens-name"
              label="Product Name"
              items={contactLensNameOptions}
              value={contactLensForm.name}
              onSearchChange={(name) => setContactLensForm({ ...contactLensForm, name })}
              onSelect={applyContactLensFormFromItem}
            />

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Power / Specification</label>
                <input type="text" value={contactLensForm.power} onChange={(e) => setContactLensForm({ ...contactLensForm, power: e.target.value })} placeholder="e.g. -1.00 OD / -1.00 OS" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Base Curve</label>
                <input type="text" value={contactLensForm.baseCurve} onChange={(e) => setContactLensForm({ ...contactLensForm, baseCurve: e.target.value })} placeholder="e.g. 8.6" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Diameter</label>
                <input type="text" value={contactLensForm.diameter} onChange={(e) => setContactLensForm({ ...contactLensForm, diameter: e.target.value })} placeholder="e.g. 14.2" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Code</label>
                <input
                  type="text"
                  value={contactLensForm.code}
                  onChange={(e) => {
                    const code = e.target.value;
                    const match = codeLookup('Contact Lens', code);
                    if (match) applyContactLensFormFromItem(match);
                    else setContactLensForm({ ...contactLensForm, code });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                <input type="number" min="1" value={contactLensForm.quantity} onChange={(e) => setContactLensForm({ ...contactLensForm, quantity: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Purchase Price (₹)</label>
                <input type="number" min="0" step="0.01" value={contactLensForm.purchasePrice} onChange={(e) => setContactLensForm({ ...contactLensForm, purchasePrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Unit / Selling Price (₹)</label>
              <input type="number" min="0" step="0.01" value={contactLensForm.sellingPrice} onChange={(e) => setContactLensForm({ ...contactLensForm, sellingPrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SupplierPicker value={contactLensForm.supplier} onChange={(name) => setContactLensForm({ ...contactLensForm, supplier: name })} />
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice / Reference No.</label>
                <input type="text" value={contactLensForm.referenceNumber} onChange={(e) => setContactLensForm({ ...contactLensForm, referenceNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
              <textarea value={contactLensForm.notes} onChange={(e) => setContactLensForm({ ...contactLensForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
            </div>

            <PaymentField total={(parseFloat(contactLensForm.purchasePrice) || 0) * (parseInt(contactLensForm.quantity, 10) || 0)} value={contactLensForm.paymentMade} onChange={(v) => setContactLensForm({ ...contactLensForm, paymentMade: v })} />

            <p className="text-[11px] text-slate-400">
              This will increase Contact Lens stock by {contactLensForm.quantity || 0} unit(s), log a stock movement, and record a
              matching Contact Lens expense of ₹{((parseFloat(contactLensForm.purchasePrice) || 0) * (parseInt(contactLensForm.quantity, 10) || 0)).toLocaleString('en-IN')}.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Add Stock'}
              </button>
              <button type="button" onClick={handleClose} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all active:scale-95">
                Cancel
              </button>
            </div>
          </form>
        ) : category === 'Solution' ? (
          <form onSubmit={handleSaveSolution} className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Date</label>
                <input type="date" value={solutionForm.date} onChange={(e) => setSolutionForm({ ...solutionForm, date: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" required />
              </div>
              <TextAutosuggest
                id="add-stock-solution-brand"
                label="Brand"
                options={solutionBrands}
                value={solutionForm.brand}
                onChange={(brand) => setSolutionForm({ ...solutionForm, brand })}
                placeholder="e.g. ReNu, Biotrue"
              />
            </div>

            <InventorySearchPicker
              id="add-stock-solution-product"
              label="Product Name"
              items={solutionProductOptions}
              value={solutionForm.product}
              onSearchChange={(product) => setSolutionForm({ ...solutionForm, product })}
              onSelect={applySolutionFormFromItem}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Pack Size</label>
                <input type="text" list="pack-size-datalist" value={solutionForm.packSize} onChange={(e) => setSolutionForm({ ...solutionForm, packSize: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
                <datalist id="pack-size-datalist">
                  <option value="60 ml" />
                  <option value="120 ml" />
                  <option value="360 ml" />
                </datalist>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Product Code / SKU</label>
                <input
                  type="text"
                  value={solutionForm.code}
                  onChange={(e) => {
                    const code = e.target.value;
                    const match = codeLookup('Solution', code);
                    if (match) applySolutionFormFromItem(match);
                    else setSolutionForm({ ...solutionForm, code });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                <input type="number" min="1" value={solutionForm.quantity} onChange={(e) => setSolutionForm({ ...solutionForm, quantity: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Purchase Price (₹)</label>
                <input type="number" min="0" step="0.01" value={solutionForm.purchasePrice} onChange={(e) => setSolutionForm({ ...solutionForm, purchasePrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selling Price (₹)</label>
                <input type="number" min="0" step="0.01" value={solutionForm.sellingPrice} onChange={(e) => setSolutionForm({ ...solutionForm, sellingPrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Purchase Discount (₹)</label>
                <input type="number" min="0" step="0.01" value={solutionForm.discount} onChange={(e) => setSolutionForm({ ...solutionForm, discount: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
              </div>
              <SupplierPicker value={solutionForm.supplier} onChange={(name) => setSolutionForm({ ...solutionForm, supplier: name })} />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice / Reference No.</label>
              <input type="text" value={solutionForm.referenceNumber} onChange={(e) => setSolutionForm({ ...solutionForm, referenceNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
              <textarea value={solutionForm.notes} onChange={(e) => setSolutionForm({ ...solutionForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
            </div>

            <PaymentField total={Math.max(0, (parseFloat(solutionForm.purchasePrice) || 0) * (parseInt(solutionForm.quantity, 10) || 0) - (parseFloat(solutionForm.discount) || 0))} value={solutionForm.paymentMade} onChange={(v) => setSolutionForm({ ...solutionForm, paymentMade: v })} />

            <p className="text-[11px] text-slate-400">
              This will increase Solution stock by {solutionForm.quantity || 0} unit(s), log a stock movement, and record a
              matching Purchase expense of ₹{Math.max(0, (parseFloat(solutionForm.purchasePrice) || 0) * (parseInt(solutionForm.quantity, 10) || 0) - (parseFloat(solutionForm.discount) || 0)).toLocaleString('en-IN')}.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Add Stock'}
              </button>
              <button type="button" onClick={handleClose} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all active:scale-95">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSaveMedicine} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Medicine / Item Name</label>
              <input type="text" value={medicineForm.name} onChange={(e) => setMedicineForm({ ...medicineForm, name: e.target.value })} placeholder="e.g. Moxifloxacin Eye Drops 0.5%" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Brand Name</label>
                <input type="text" value={medicineForm.brand} onChange={(e) => setMedicineForm({ ...medicineForm, brand: e.target.value })} placeholder="e.g. Moxicip (Cipla)" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select value={medicineForm.category} onChange={(e) => setMedicineForm({ ...medicineForm, category: e.target.value as MedicineSubCategory })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <option value="Eye Drops">Eye Drops</option>
                  <option value="Tablets">Tablets</option>
                  <option value="Ointment">Ointment</option>
                  <option value="Capsules">Capsules</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Batch #</label>
                <input type="text" value={medicineForm.batchNumber} onChange={(e) => setMedicineForm({ ...medicineForm, batchNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Rack Location</label>
                <input type="text" value={medicineForm.rackNumber} onChange={(e) => setMedicineForm({ ...medicineForm, rackNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Expiry Date</label>
                <input type="month" value={medicineForm.expiryDate} onChange={(e) => setMedicineForm({ ...medicineForm, expiryDate: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Available Stock</label>
                <input type="number" min="1" value={medicineForm.availableStock} onChange={(e) => setMedicineForm({ ...medicineForm, availableStock: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Minimum Reorder Stock</label>
                <input type="number" min="0" value={medicineForm.minimumStock} onChange={(e) => setMedicineForm({ ...medicineForm, minimumStock: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Purchase Price (₹)</label>
                <input type="number" min="0" step="0.01" value={medicineForm.purchasePrice} onChange={(e) => setMedicineForm({ ...medicineForm, purchasePrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Selling Price (₹)</label>
                <input type="number" min="0" step="0.01" value={medicineForm.sellingPrice} onChange={(e) => setMedicineForm({ ...medicineForm, sellingPrice: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">HSN/SAC <span className="font-normal text-slate-400">(optional)</span></label>
                <input type="text" value={medicineForm.hsnSac} onChange={(e) => setMedicineForm({ ...medicineForm, hsnSac: e.target.value })} placeholder="e.g. 3004" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">GST Rate (%) <span className="font-normal text-slate-400">(optional)</span></label>
                <input type="number" min="0" step="0.01" value={medicineForm.taxRate} onChange={(e) => setMedicineForm({ ...medicineForm, taxRate: e.target.value })} placeholder="Uses default rate if blank" className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SupplierPicker value={medicineForm.supplier} onChange={(name) => setMedicineForm({ ...medicineForm, supplier: name })} />
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice / Reference No.</label>
                <input type="text" value={medicineForm.referenceNumber} onChange={(e) => setMedicineForm({ ...medicineForm, referenceNumber: e.target.value })} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Notes</label>
              <textarea value={medicineForm.notes} onChange={(e) => setMedicineForm({ ...medicineForm, notes: e.target.value })} rows={2} className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl" />
            </div>

            <PaymentField total={(parseFloat(medicineForm.purchasePrice) || 0) * (parseInt(medicineForm.availableStock, 10) || 0)} value={medicineForm.paymentMade} onChange={(v) => setMedicineForm({ ...medicineForm, paymentMade: v })} />

            <p className="text-[11px] text-slate-400">
              This will add {medicineForm.availableStock || 0} unit(s) of this medicine to inventory, log a stock movement, and record a
              matching Medical / Clinic Supplies expense of ₹{((parseFloat(medicineForm.purchasePrice) || 0) * (parseInt(medicineForm.availableStock, 10) || 0)).toLocaleString('en-IN')}.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <button type="submit" disabled={isSaving} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
                {isSaving ? 'Saving...' : 'Add Medicine'}
              </button>
              <button type="button" onClick={handleClose} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all active:scale-95">
                Cancel
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </div>
  );
};
