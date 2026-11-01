'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { motion } from 'motion/react';
import { ConfirmModal } from '@/components/dashboard/ConfirmModal';
import { Supplier } from '@/lib/types';
import { ChevronDown, Search, Plus, Building2, X, Trash2, User, Phone, MapPin, ReceiptText, Landmark, Hash } from 'lucide-react';

const emptySupplierForm = {
  name: '',
  phone: '',
  address: '',
  gstin: '',
  state: '',
  stateCode: '',
};

export const SupplierPicker: React.FC<{ value: string; onChange: (name: string) => void }> = ({ value, onChange }) => {
  const { suppliers, addSupplier, deleteSupplier } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState(emptySupplierForm);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fieldRefs = useRef<(HTMLInputElement | HTMLTextAreaElement | null)[]>([]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const recentSuppliers = suppliers.slice(0, 3);
  const filteredSuppliers = search.trim()
    ? suppliers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase().trim()))
    : recentSuppliers;

  const handleSelect = (name: string) => {
    onChange(name);
    setIsOpen(false);
    setSearch('');
  };

  const openAddSupplierForm = () => {
    setSupplierForm({ ...emptySupplierForm, name: search.trim() });
    setIsFormOpen(true);
    setIsOpen(false);
  };

  const handleSaveSupplier = async () => {
    if (!supplierForm.name.trim()) return;
    setIsSaving(true);
    try {
      const created = await addSupplier({
        name: supplierForm.name.trim(),
        phone: supplierForm.phone.trim() || undefined,
        address: supplierForm.address.trim() || undefined,
        gstin: supplierForm.gstin.trim() || undefined,
        state: supplierForm.state.trim() || undefined,
        stateCode: supplierForm.stateCode.trim() || undefined,
      });
      if (created) {
        onChange(created.name);
        setIsFormOpen(false);
        setSupplierForm(emptySupplierForm);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Enter moves focus to the next field instead of doing nothing (inputs) or
  // inserting a newline (the Address textarea) — on the last field it
  // submits the form, matching how a quick single-column entry form should feel.
  const handleFieldKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey) return;
    e.preventDefault();
    const next = fieldRefs.current[index + 1];
    if (next) {
      next.focus();
      if ('select' in next) (next as HTMLInputElement).select();
    } else {
      handleSaveSupplier();
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Supplier / Vendor</label>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-left"
      >
        <span className={value ? 'text-slate-900 dark:text-white font-medium' : 'text-slate-400'}>
          {value || 'Select or add a supplier'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1.5 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search suppliers..."
                className="w-full pl-8 pr-2 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="max-h-40 overflow-y-auto">
            {!search.trim() && suppliers.length > 0 && (
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">Recently Added</p>
            )}
            {filteredSuppliers.length === 0 ? (
              <p className="px-3 py-3 text-xs text-slate-400 text-center">
                {suppliers.length === 0 ? 'No suppliers yet.' : 'No matching suppliers.'}
              </p>
            ) : (
              filteredSuppliers.map((s) => (
                <div key={s.id} className="group flex items-center hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors">
                  <button
                    type="button"
                    onClick={() => handleSelect(s.name)}
                    className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2 text-left"
                  >
                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{s.name}</p>
                      {(s.phone || s.state) && (
                        <p className="text-[10px] text-slate-400 truncate">{[s.phone, s.state].filter(Boolean).join(' • ')}</p>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingSupplier(s);
                    }}
                    className="p-1.5 mr-1.5 text-slate-300 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                    title="Delete supplier"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={openAddSupplierForm}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 border-t border-slate-100 dark:border-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add New Supplier
          </button>
        </div>
      )}

      {isFormOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-sm w-full overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-indigo-500">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-white/15 rounded-lg">
                  <Building2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white leading-tight">New Supplier</h3>
                  <p className="text-[10px] text-indigo-100">Press Enter to jump to the next field</p>
                </div>
              </div>
              <button type="button" onClick={() => setIsFormOpen(false)} className="p-1 text-indigo-100 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Supplier Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={(el) => { fieldRefs.current[0] = el; }}
                    type="text"
                    autoFocus
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })}
                    onKeyDown={handleFieldKeyDown(0)}
                    placeholder="e.g. Sun Pharma Distributors"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-medium outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Phone Number</label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={(el) => { fieldRefs.current[1] = el; }}
                    type="text"
                    value={supplierForm.phone}
                    onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                    onKeyDown={handleFieldKeyDown(1)}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Address</label>
                <div className="relative">
                  <MapPin className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <textarea
                    ref={(el) => { fieldRefs.current[2] = el; }}
                    value={supplierForm.address}
                    onChange={(e) => setSupplierForm({ ...supplierForm, address: e.target.value })}
                    onKeyDown={handleFieldKeyDown(2)}
                    rows={2}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">GSTIN / UIN</label>
                <div className="relative">
                  <ReceiptText className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={(el) => { fieldRefs.current[3] = el; }}
                    type="text"
                    value={supplierForm.gstin}
                    onChange={(e) => setSupplierForm({ ...supplierForm, gstin: e.target.value })}
                    onKeyDown={handleFieldKeyDown(3)}
                    placeholder="e.g. 27ABCDE1234F1Z5"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">State</label>
                  <div className="relative">
                    <Landmark className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={(el) => { fieldRefs.current[4] = el; }}
                      type="text"
                      value={supplierForm.state}
                      onChange={(e) => setSupplierForm({ ...supplierForm, state: e.target.value })}
                      onKeyDown={handleFieldKeyDown(4)}
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">State Code</label>
                  <div className="relative">
                    <Hash className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      ref={(el) => { fieldRefs.current[5] = el; }}
                      type="text"
                      value={supplierForm.stateCode}
                      onChange={(e) => setSupplierForm({ ...supplierForm, stateCode: e.target.value })}
                      onKeyDown={handleFieldKeyDown(5)}
                      placeholder="27"
                      className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm font-mono outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button type="button" onClick={handleSaveSupplier} disabled={isSaving} className="flex-1 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50">
                  {isSaving ? 'Saving...' : 'Add Supplier'}
                </button>
                <button type="button" onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all active:scale-95">
                  Cancel
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      <ConfirmModal
        isOpen={deletingSupplier !== null}
        title="Delete this supplier?"
        message={deletingSupplier ? `${deletingSupplier.name} will be removed from your supplier list. Past expenses and stock purchases already recorded under this name are not affected.` : 'This action cannot be undone.'}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deletingSupplier) deleteSupplier(deletingSupplier.id);
        }}
        onCancel={() => setDeletingSupplier(null)}
      />
    </div>
  );
};
