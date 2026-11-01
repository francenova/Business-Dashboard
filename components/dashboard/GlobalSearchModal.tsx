'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { formatDate } from '@/lib/formatDate';
import { Search, X, User, Pill, FileText, Receipt, Glasses, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const GlobalSearchModal: React.FC = () => {
  const {
    isGlobalSearchOpen,
    setGlobalSearchOpen,
    globalSearchQuery,
    setGlobalSearchQuery,
    patients,
    medicines,
    prescriptions,
    visits,
    settings,
    navigateTo,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState(globalSearchQuery);

  useEffect(() => {
    setSearchQuery(globalSearchQuery);
  }, [globalSearchQuery]);

  if (!isGlobalSearchOpen) return null;

  const query = searchQuery.trim().toLowerCase();

  // Search Patients
  const matchedPatients = query
    ? patients.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.phone.includes(query) ||
          p.id.toLowerCase().includes(query) ||
          p.address.toLowerCase().includes(query)
      )
    : [];

  // Search Medicines
  const matchedMedicines = query
    ? medicines.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.brand.toLowerCase().includes(query) ||
          m.barcode.includes(query) ||
          m.rackNumber.toLowerCase().includes(query)
      )
    : [];

  // Search Prescriptions
  const matchedPrescriptions = query
    ? prescriptions.filter(
        (rx) =>
          rx.id.toLowerCase().includes(query) ||
          rx.patientName.toLowerCase().includes(query) ||
          rx.patientPhone.includes(query) ||
          rx.visitId.toLowerCase().includes(query)
      )
    : [];

  // Search Visits / Invoices / Orders
  const matchedVisits = query
    ? visits.filter(
        (v) =>
          v.id.toLowerCase().includes(query) ||
          v.payment.invoiceNumber.toLowerCase().includes(query) ||
          v.patientName.toLowerCase().includes(query) ||
          (v.frame && v.frame.frameName.toLowerCase().includes(query)) ||
          (v.frame && v.frame.brand.toLowerCase().includes(query))
      )
    : [];

  const handleClose = () => {
    setGlobalSearchOpen(false);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-950/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          transition={{ duration: 0.15 }}
          className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        >
          {/* Top Input Bar */}
          <div className="flex items-center px-4 py-3.5 border-b border-slate-200 dark:border-slate-800 gap-3">
            <Search className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <input
              id="global-search-input"
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setGlobalSearchQuery(e.target.value);
              }}
              placeholder="Search patients, phone #, medicines, prescriptions, invoices, frames..."
              className="flex-1 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 text-base outline-none font-medium"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setGlobalSearchQuery('');
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-flex px-2 py-1 text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-md">
              ESC
            </kbd>
            <button
              id="global-search-modal-close-btn"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
              title="Close search modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {!query ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium">Type to search across {settings.clinicName || 'VisionCare Eye Clinic'}</p>
                <p className="text-xs mt-1">
                  Search by patient name, phone, prescription ID, invoice #, frame brand or medicine name
                </p>
              </div>
            ) : matchedPatients.length === 0 &&
              matchedMedicines.length === 0 &&
              matchedPrescriptions.length === 0 &&
              matchedVisits.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <p className="text-sm font-medium">No results found for &quot;{query}&quot;</p>
                <p className="text-xs mt-1">Try checking for typos or searching by phone number.</p>
              </div>
            ) : (
              <>
                {/* Patients Results */}
                {matchedPatients.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                      Patients ({matchedPatients.length})
                    </div>
                    <div className="space-y-1.5">
                      {matchedPatients.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => {
                            handleClose();
                            navigateTo('patient-profile', { patientId: p.id });
                          }}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white text-sm">
                                {p.name}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                                {p.id}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {p.age} yrs • {p.gender} • Ph: {p.phone}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prescriptions Results */}
                {matchedPrescriptions.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-emerald-500" />
                      Prescriptions ({matchedPrescriptions.length})
                    </div>
                    <div className="space-y-1.5">
                      {matchedPrescriptions.map((rx) => (
                        <div
                          key={rx.id}
                          onClick={() => {
                            handleClose();
                            navigateTo('prescription', {
                              patientId: rx.patientId,
                              visitId: rx.visitId,
                              prescriptionId: rx.id,
                            });
                          }}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white text-sm">
                                {rx.id}
                              </span>
                              <span className="text-xs text-slate-500">• {rx.patientName}</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Date: {formatDate(rx.date)} • Invoice: {rx.payment.invoiceNumber}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Medicines Results */}
                {matchedMedicines.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Pill className="w-3.5 h-3.5 text-rose-500" />
                      Medicines & Supplies ({matchedMedicines.length})
                    </div>
                    <div className="space-y-1.5">
                      {matchedMedicines.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => {
                            handleClose();
                            navigateTo('inventory');
                          }}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white text-sm">
                                {m.name}
                              </span>
                              <span className="text-xs text-slate-500">({m.brand})</span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Stock: {m.availableStock} • Rack: {m.rackNumber} • Price: ₹{m.sellingPrice}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invoices & Orders */}
                {matchedVisits.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Glasses className="w-3.5 h-3.5 text-blue-500" />
                      Visits & Optical Orders ({matchedVisits.length})
                    </div>
                    <div className="space-y-1.5">
                      {matchedVisits.map((v) => (
                        <div
                          key={v.id}
                          onClick={() => {
                            handleClose();
                            navigateTo('prescription', {
                              patientId: v.patientId,
                              visitId: v.id,
                            });
                          }}
                          className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors group"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white text-sm">
                                {v.payment.invoiceNumber}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded font-medium">
                                {v.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Patient: {v.patientName} • Total: ₹{v.payment.grandTotal}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
